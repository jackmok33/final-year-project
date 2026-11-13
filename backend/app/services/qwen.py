"""Stateless vLLM HTTP client. No agents, scoring, cloud lifecycle or model loading."""

import base64
import json
import math
import struct
from dataclasses import dataclass
from typing import Annotated, Literal

import anyio
import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.inference_config import QwenSettings

MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_IMAGE_BYTES = 2 * 1024 * 1024
MAX_PROMPT_CHARACTERS = 16000
MAX_OUTPUT_TOKENS = 512


class InferenceError(RuntimeError):
    def __init__(self, code: str, message: str, status_code: int = 502):
        self.code = code
        self.status_code = status_code
        super().__init__(message)


@dataclass(frozen=True)
class Generation:
    model: str
    text: str
    data: dict | None
    usage: dict[str, int] | None


class _Message(BaseModel):
    role: Literal["assistant"]
    content: str


class _Choice(BaseModel):
    message: _Message
    finish_reason: str


class _Usage(BaseModel):
    model_config = ConfigDict(strict=True)
    prompt_tokens: int = Field(ge=0)
    completion_tokens: int = Field(ge=0)
    total_tokens: int = Field(ge=0)


class _Completion(BaseModel):
    model: str
    choices: Annotated[list[_Choice], Field(min_length=1, max_length=1)]
    usage: _Usage | None = None


def _reject_nonfinite(value: str):
    raise ValueError("Non-finite JSON number")


def _finite_float(value: str) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("JSON number exceeds the finite range")
    return number


def _parse_json(raw):
    return json.loads(raw, parse_constant=_reject_nonfinite, parse_float=_finite_float)


def _image_url(raw: bytes) -> str:
    if (
        not isinstance(raw, bytes)
        or not 24 <= len(raw) <= MAX_IMAGE_BYTES
        or raw[:8] != b"\x89PNG\r\n\x1a\n"
        or raw[12:16] != b"IHDR"
        or not all(1 <= size <= 1024 for size in struct.unpack(">II", raw[16:24]))
    ):
        raise ValueError("Supply one rendered PNG page, at most 2 MiB and 1024 pixels per edge.")
    return "data:image/png;base64," + base64.b64encode(raw).decode("ascii")


class QwenClient:
    """One pooled client per backend lifespan; each generation has separate messages."""

    def __init__(
        self, settings: QwenSettings, *, transport: httpx.AsyncBaseTransport | None = None
    ):
        self.settings = settings
        self._http = httpx.AsyncClient(
            base_url=settings.base_url + "/",
            headers={"Authorization": "Bearer " + settings.api_key},
            timeout=httpx.Timeout(settings.timeout_seconds, connect=5, write=10, pool=5),
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=4),
            follow_redirects=False,
            trust_env=False,
            transport=transport,
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        await self._http.aclose()

    async def _request(self, route: str, payload: dict | None = None) -> dict:
        try:
            # HTTPX read timeouts are per chunk; also bound the entire operation.
            with anyio.fail_after(self.settings.timeout_seconds):
                async with self._http.stream(
                    "GET" if payload is None else "POST", route, json=payload
                ) as response:
                    status = response.status_code
                    if status in {401, 403}:
                        raise InferenceError(
                            "INFERENCE_AUTH_FAILED", "Qwen rejected backend credentials."
                        )
                    if status in {429, 503}:
                        raise InferenceError("INFERENCE_BUSY", "Qwen is busy or not ready.", 503)
                    if status != 200:
                        raise InferenceError(
                            "INFERENCE_HTTP_ERROR", "Qwen returned an unsuccessful response."
                        )
                    raw = bytearray()
                    async for chunk in response.aiter_bytes(chunk_size=65536):
                        raw.extend(chunk)
                        if len(raw) > MAX_RESPONSE_BYTES:
                            raise InferenceError(
                                "INFERENCE_INVALID_RESPONSE", "Qwen response exceeded its limit."
                            )
                    value = _parse_json(raw)
                    if not isinstance(value, dict) or "error" in value:
                        raise ValueError
                    return value
        except (httpx.TimeoutException, TimeoutError):
            raise InferenceError(
                "INFERENCE_TIMEOUT", "Qwen did not respond before the deadline.", 504
            ) from None
        except httpx.RequestError:
            raise InferenceError(
                "INFERENCE_UNAVAILABLE", "Cannot reach the Qwen endpoint.", 503
            ) from None
        except (ValueError, UnicodeError, RecursionError):
            raise InferenceError(
                "INFERENCE_INVALID_RESPONSE", "Qwen returned invalid JSON."
            ) from None

    async def check_model(self) -> None:
        value = await self._request("models")
        models = value.get("data")
        if not isinstance(models, list):
            raise InferenceError(
                "INFERENCE_INVALID_RESPONSE", "Qwen returned an invalid model list."
            )
        if not any(
            isinstance(item, dict) and item.get("id") == self.settings.model for item in models
        ):
            raise InferenceError(
                "INFERENCE_MODEL_UNAVAILABLE", "The configured Qwen model is not served.", 503
            )

    async def generate(
        self,
        prompt: str,
        *,
        system_prompt: str | None = None,
        image_png: bytes | None = None,
        json_output: bool = False,
        max_tokens: int = MAX_OUTPUT_TOKENS,
    ) -> Generation:
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError("A nonempty prompt is required.")
        if system_prompt is not None and (
            not isinstance(system_prompt, str) or not system_prompt.strip()
        ):
            raise ValueError("The optional system prompt must be nonempty text.")
        if len(prompt) + len(system_prompt or "") > MAX_PROMPT_CHARACTERS:
            raise ValueError("Combined prompt text exceeds the client limit.")
        if type(max_tokens) is not int or not 1 <= max_tokens <= MAX_OUTPUT_TOKENS:
            raise ValueError("Output tokens must be between 1 and 512.")
        content = prompt
        if image_png is not None:
            content = [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": _image_url(image_png)}},
            ]
        messages = []
        if system_prompt is not None:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": content})
        payload = {
            "model": self.settings.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0,
            "stream": False,
            "chat_template_kwargs": {"enable_thinking": False},
        }
        if json_output:
            payload["response_format"] = {"type": "json_object"}
        value = await self._request("chat/completions", payload)
        try:
            completion = _Completion.model_validate(value)
            choice = completion.choices[0]
            if completion.model != self.settings.model or not choice.message.content.strip():
                raise ValueError
            if choice.finish_reason != "stop":
                raise InferenceError(
                    "INFERENCE_INCOMPLETE_RESPONSE", "Qwen did not finish its response."
                )
            data = None
            if json_output:
                data = _parse_json(choice.message.content)
                if not isinstance(data, dict):
                    raise ValueError
        except (ValidationError, ValueError, RecursionError):
            raise InferenceError(
                "INFERENCE_INVALID_RESPONSE", "Qwen response did not match the requested format."
            ) from None
        return Generation(
            model=completion.model,
            text=choice.message.content,
            data=data,
            usage=completion.usage.model_dump() if completion.usage is not None else None,
        )
