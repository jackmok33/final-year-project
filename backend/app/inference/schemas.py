"""Contracts for the synthetic inference probe."""

from typing import Literal

from app.api import ApiModel


class InferenceProbeRequest(ApiModel):
    mode: Literal["text", "json", "image"] = "text"


class InferenceProbeResponse(ApiModel):
    status: Literal["ok"] = "ok"
    provider: Literal["qwen", "openai"]
    mode: Literal["text", "json", "image"]
    model: str
    text: str
    data: dict | None
    usage: dict[str, int] | None
