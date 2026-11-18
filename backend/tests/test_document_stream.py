import anyio
import pytest
from starlette.requests import Request

from app.api import ApiError
from app.documents import routes as document_routes


@pytest.mark.anyio
@pytest.mark.parametrize(
    "failure,code",
    [
        ("timeout", "DOCUMENT_UPLOAD_TIMEOUT"),
        ("disconnect", "DOCUMENT_UPLOAD_INTERRUPTED"),
        ("length", "DOCUMENT_LENGTH_INVALID"),
    ],
)
async def test_interrupted_or_invalid_streams_return_safe_errors(monkeypatch, failure, code):
    monkeypatch.setattr(document_routes, "UPLOAD_TIMEOUT_SECONDS", 0.01)
    headers = [(b"content-type", b"application/pdf")]
    if failure == "length":
        headers.append((b"content-length", b"invalid"))

    async def receive():
        if failure == "timeout":
            await anyio.sleep(1)
        return {"type": "http.disconnect"}

    request = Request({"type": "http", "headers": headers}, receive)
    with pytest.raises(ApiError) as error:
        await document_routes._read_pdf(request)
    assert error.value.code == code
