import base64
import json
import struct

import anyio
import httpx
import pytest

from app.inference_config import QwenSettings
from app.inference_routes import PROBE_IMAGE
from app.services import qwen
from app.services.qwen import InferenceError, QwenClient
from tests.inference_fakes import KEY, SETTINGS, completion


@pytest.mark.anyio
async def test_actual_request_contract_and_separate_contexts():
    calls = []

    def respond(request):
        assert request.headers["authorization"] == "Bearer " + KEY
        assert request.headers["content-type"] == "application/json"
        assert str(request.url) == "http://127.0.0.1:18000/v1/chat/completions"
        calls.append(json.loads(request.content))
        return httpx.Response(200, json=completion())

    async with QwenClient(SETTINGS, transport=httpx.MockTransport(respond)) as client:
        result = await client.generate("First prompt", system_prompt="First agent")
        await client.generate("Second prompt")
        assert result.text == "Test response"
        assert result.usage == {"prompt_tokens": 10, "completion_tokens": 3, "total_tokens": 13}
        assert result.data is None
    assert calls[0] == {
        "model": "admissions-qwen",
        "messages": [
            {"role": "system", "content": "First agent"},
            {"role": "user", "content": "First prompt"},
        ],
        "max_tokens": 512,
        "temperature": 0,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    assert calls[1]["messages"] == [{"role": "user", "content": "Second prompt"}]
    assert client._http.is_closed


@pytest.mark.anyio
async def test_image_is_inline_not_a_remote_url_and_json_is_parsed():
    image = PROBE_IMAGE.read_bytes()

    def respond(request):
        payload = json.loads(request.content)
        assert payload["response_format"] == {"type": "json_object"}
        content = payload["messages"][0]["content"]
        assert content[0] == {"type": "text", "text": "Return JSON from this image"}
        assert (
            content[1]["image_url"]["url"]
            == "data:image/png;base64," + base64.b64encode(image).decode()
        )
        return httpx.Response(200, json=completion('{"grade":82}'))

    async with QwenClient(SETTINGS, transport=httpx.MockTransport(respond)) as client:
        assert (
            await client.generate("Return JSON from this image", image_png=image, json_output=True)
        ).data == {"grade": 82}


@pytest.mark.anyio
@pytest.mark.parametrize(
    "payload,code",
    [
        ({"data": [{"id": "admissions-qwen"}]}, None),
        ({"data": [{"id": "wrong-model"}]}, "INFERENCE_MODEL_UNAVAILABLE"),
        ({"data": []}, "INFERENCE_MODEL_UNAVAILABLE"),
        ({"data": "not-a-list"}, "INFERENCE_INVALID_RESPONSE"),
    ],
)
async def test_model_alias_must_be_served(payload, code):
    def respond(request):
        assert request.method == "GET"
        assert request.url.path == "/v1/models"
        return httpx.Response(200, json=payload)

    async with QwenClient(SETTINGS, transport=httpx.MockTransport(respond)) as client:
        if code:
            with pytest.raises(InferenceError) as error:
                await client.check_model()
            assert error.value.code == code
        else:
            await client.check_model()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "status,code,backend_status",
    [
        (401, "INFERENCE_AUTH_FAILED", 502),
        (403, "INFERENCE_AUTH_FAILED", 502),
        (429, "INFERENCE_BUSY", 503),
        (503, "INFERENCE_BUSY", 503),
        (400, "INFERENCE_HTTP_ERROR", 502),
        (500, "INFERENCE_HTTP_ERROR", 502),
        (307, "INFERENCE_HTTP_ERROR", 502),
    ],
)
async def test_http_failures_do_not_retry_follow_redirects_or_echo_bodies(
    status, code, backend_status
):
    calls = []

    def respond(request):
        calls.append(request)
        return httpx.Response(
            status,
            text="sensitive applicant data " + KEY,
            headers={"location": "https://another.example/v1"},
        )

    async with QwenClient(SETTINGS, transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(InferenceError) as error:
            await client.generate("Test")
    assert error.value.code == code
    assert error.value.status_code == backend_status
    assert "sensitive" not in str(error.value)
    assert KEY not in str(error.value)
    assert len(calls) == 1


@pytest.mark.anyio
@pytest.mark.parametrize(
    "exception,code,status",
    [
        (httpx.ConnectError("sensitive-address"), "INFERENCE_UNAVAILABLE", 503),
        (httpx.ReadTimeout("sensitive-address"), "INFERENCE_TIMEOUT", 504),
    ],
)
async def test_transport_failures_are_sanitized(exception, code, status):
    def respond(request):
        raise exception

    async with QwenClient(SETTINGS, transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(InferenceError) as error:
            await client.generate("Test")
    assert error.value.code == code
    assert error.value.status_code == status
    assert "sensitive-address" not in str(error.value)


@pytest.mark.anyio
async def test_total_deadline_catches_a_slow_drip_response():
    class SlowBody(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b"{"
            await anyio.sleep(1)
            yield b"}"

    transport = httpx.MockTransport(lambda request: httpx.Response(200, stream=SlowBody()))
    async with QwenClient(
        QwenSettings(SETTINGS.base_url, KEY, timeout_seconds=0.02), transport=transport
    ) as client:
        with pytest.raises(InferenceError) as error:
            await client.generate("Test")
    assert error.value.code == "INFERENCE_TIMEOUT"


@pytest.mark.anyio
async def test_response_limit_applies_without_content_length(monkeypatch):
    monkeypatch.setattr(qwen, "MAX_RESPONSE_BYTES", 100)

    class LargeBody(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b"x" * 200

    transport = httpx.MockTransport(lambda request: httpx.Response(200, stream=LargeBody()))
    async with QwenClient(SETTINGS, transport=transport) as client:
        with pytest.raises(InferenceError) as error:
            await client.generate("Test")
    assert error.value.code == "INFERENCE_INVALID_RESPONSE"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "raw", [b"not-json", b"[]", b'{"error":"upstream failure"}', b'{"x":NaN}', b"\xff"]
)
async def test_invalid_response_envelopes(raw):
    transport = httpx.MockTransport(lambda request: httpx.Response(200, content=raw))
    async with QwenClient(SETTINGS, transport=transport) as client:
        with pytest.raises(InferenceError) as error:
            await client.generate("Test")
    assert error.value.code == "INFERENCE_INVALID_RESPONSE"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "overrides",
    [
        {"model": "other-model"},
        {"choices": []},
        {"choices": [{"message": {"role": "assistant", "content": None}, "finish_reason": "stop"}]},
        {"usage": {"prompt_tokens": -1, "completion_tokens": 3, "total_tokens": 2}},
        {"usage": {"prompt_tokens": "10", "completion_tokens": 3, "total_tokens": 13}},
    ],
)
async def test_malformed_generation_is_rejected(overrides):
    transport = httpx.MockTransport(
        lambda request: httpx.Response(200, json=completion(**overrides))
    )
    async with QwenClient(SETTINGS, transport=transport) as client:
        with pytest.raises(InferenceError) as error:
            await client.generate("Test")
    assert error.value.code == "INFERENCE_INVALID_RESPONSE"


@pytest.mark.anyio
async def test_truncated_generation_never_becomes_a_result():
    body = completion()
    body["choices"][0]["finish_reason"] = "length"
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=body))
    async with QwenClient(SETTINGS, transport=transport) as client:
        with pytest.raises(InferenceError) as error:
            await client.generate("Test")
    assert error.value.code == "INFERENCE_INCOMPLETE_RESPONSE"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "text", ["   ", "[]", "```json\n{}\n```", '{"value":NaN}', '{"value":1e999}', "not JSON"]
)
async def test_json_mode_requires_a_complete_json_object(text):
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=completion(text)))
    async with QwenClient(SETTINGS, transport=transport) as client:
        with pytest.raises(InferenceError) as error:
            await client.generate("Return JSON", json_output=True)
    assert error.value.code == "INFERENCE_INVALID_RESPONSE"


@pytest.mark.anyio
async def test_json_mode_preserves_finite_numbers():
    transport = httpx.MockTransport(
        lambda request: httpx.Response(200, json=completion('{"ratio":0.5}'))
    )
    async with QwenClient(SETTINGS, transport=transport) as client:
        result = await client.generate("Return JSON", json_output=True)
    assert result.data == {"ratio": 0.5}


@pytest.mark.anyio
@pytest.mark.parametrize(
    "kwargs",
    [
        {"prompt": ""},
        {"prompt": " "},
        {"prompt": "a" * 16001},
        {"prompt": "a" * 8001, "system_prompt": "b" * 8000},
        {"prompt": "Test", "system_prompt": ""},
        {"prompt": "Test", "max_tokens": 513},
        {"prompt": "Test", "max_tokens": True},
        {"prompt": "Test", "image_png": b"not-an-image"},
        {"prompt": "Test", "image_png": b"x" * (qwen.MAX_IMAGE_BYTES + 1)},
        {
            "prompt": "Test",
            "image_png": b"\x89PNG\r\n\x1a\n"
            + b"\x00\x00\x00\x0dIHDR"
            + struct.pack(">II", 1025, 600),
        },
    ],
)
async def test_invalid_inputs_never_send_a_request(kwargs):
    calls = []
    transport = httpx.MockTransport(lambda request: calls.append(request))
    async with QwenClient(SETTINGS, transport=transport) as client:
        with pytest.raises(ValueError):
            await client.generate(**kwargs)
    assert calls == []
