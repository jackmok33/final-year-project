import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
import pytest
from fastapi.testclient import TestClient

from app.inference_routes import IMAGE_FACTS
from app.main import create_app
from tests.inference_fakes import KEY, completion

ENDPOINT = "/api/v1/inference/probe"


def enable(monkeypatch, *, configured=True):
    monkeypatch.setenv("QWEN_PROBE_ENABLED", "true")
    if configured:
        monkeypatch.setenv("QWEN_BASE_URL", "http://127.0.0.1:18000/v1")
        monkeypatch.setenv("QWEN_API_KEY", KEY)


def test_probe_disabled_by_default_and_never_contacts_a_model(client):
    response = client.post(ENDPOINT, json={"mode": "text"})
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "INFERENCE_PROBE_DISABLED"


def test_explicitly_enabled_but_unconfigured_is_not_a_fake_success(monkeypatch):
    enable(monkeypatch, configured=False)
    with TestClient(create_app()) as client:
        response = client.post(ENDPOINT, json={"mode": "text"})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "INFERENCE_NOT_CONFIGURED"


@pytest.mark.parametrize("mode", ["text", "json", "image"])
def test_probe_checks_models_then_generates_with_fixed_synthetic_requests(monkeypatch, mode):
    enable(monkeypatch)
    calls = []

    def respond(request):
        calls.append(request)
        assert request.headers["authorization"] == "Bearer " + KEY
        if request.method == "GET":
            return httpx.Response(200, json={"data": [{"id": "admissions-qwen"}]})
        body = json.loads(request.content)
        assert body["model"] == "admissions-qwen"
        if mode == "text":
            assert isinstance(body["messages"][0]["content"], str)
            return httpx.Response(200, json=completion("QWEN_CONNECTION_OK"))
        assert body["response_format"] == {"type": "json_object"}
        if mode == "image":
            assert body["messages"][0]["content"][1]["image_url"]["url"].startswith(
                "data:image/png;base64,"
            )
        return httpx.Response(
            200,
            json=completion(json.dumps(IMAGE_FACTS if mode == "image" else {"connection": "ok"})),
        )

    with TestClient(create_app(inference_transport=httpx.MockTransport(respond))) as client:
        assert calls == []  # Constructing/starting FastAPI never probes the VM.
        response = client.post(ENDPOINT, json={"mode": mode})
        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "ok"
        assert result["mode"] == mode
        assert result["model"] == "admissions-qwen"
        assert KEY not in response.text
        # Existing health is explicitly the mock-assessment contract, not model health.
        assert client.get("/api/v1/health").json()["mode"] == "mock"
    assert [call.url.path for call in calls] == ["/v1/models", "/v1/chat/completions"]
    assert result["data"] == (
        IMAGE_FACTS if mode == "image" else {"connection": "ok"} if mode == "json" else None
    )


def test_unknown_model_stops_before_generation(monkeypatch):
    enable(monkeypatch)
    calls = []

    def respond(request):
        calls.append(request)
        return httpx.Response(200, json={"data": [{"id": "other-model"}]})

    with TestClient(create_app(inference_transport=httpx.MockTransport(respond))) as client:
        response = client.post(ENDPOINT, json={})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "INFERENCE_MODEL_UNAVAILABLE"
    assert len(calls) == 1


@pytest.mark.parametrize(
    "failure", ["unreachable", "timeout", "auth", "busy", "invalid-json", "wrong-answer"]
)
def test_probe_propagates_failures_without_fallback_or_sensitive_details(monkeypatch, failure):
    enable(monkeypatch)

    def respond(request):
        if failure == "unreachable":
            raise httpx.ConnectError("private information " + KEY)
        if failure == "timeout":
            raise httpx.ReadTimeout("private information " + KEY)
        if failure in {"auth", "busy"}:
            return httpx.Response(
                401 if failure == "auth" else 429, text="private information " + KEY
            )
        if failure == "invalid-json":
            return httpx.Response(200, content=b"not json")
        if request.method == "GET":
            return httpx.Response(200, json={"data": [{"id": "admissions-qwen"}]})
        return httpx.Response(200, json=completion("Unrelated answer"))

    expected = {
        "unreachable": (503, "INFERENCE_UNAVAILABLE"),
        "timeout": (504, "INFERENCE_TIMEOUT"),
        "auth": (502, "INFERENCE_AUTH_FAILED"),
        "busy": (503, "INFERENCE_BUSY"),
        "invalid-json": (502, "INFERENCE_INVALID_RESPONSE"),
        "wrong-answer": (502, "INFERENCE_PROBE_MISMATCH"),
    }
    with TestClient(create_app(inference_transport=httpx.MockTransport(respond))) as client:
        response = client.post(ENDPOINT, json={})
    status, code = expected[failure]
    assert response.status_code == status
    assert response.json()["detail"]["code"] == code
    assert "private information" not in response.text
    assert KEY not in response.text


@pytest.mark.parametrize(
    "body",
    [
        {"mode": "pdf"},
        {"prompt": "Arbitrary generation is not exposed"},
        {"baseUrl": "https://other.example/v1"},
    ],
)
def test_probe_does_not_accept_prompts_endpoints_or_pdfs(monkeypatch, body):
    enable(monkeypatch)
    calls = []
    with TestClient(
        create_app(inference_transport=httpx.MockTransport(lambda request: calls.append(request)))
    ) as client:
        assert client.post(ENDPOINT, json=body).status_code == 422
    assert calls == []


def test_pooled_client_is_closed_on_shutdown(monkeypatch):
    enable(monkeypatch)
    with TestClient(
        create_app(inference_transport=httpx.MockTransport(lambda request: None))
    ) as client:
        qwen = client.app.state.qwen_client
        assert not qwen._http.is_closed
    assert qwen._http.is_closed
    assert client.app.state.qwen_client is None


def test_openapi_documents_probe_separately_from_assessments(client):
    schema = client.get("/openapi.json").json()
    assert ENDPOINT in schema["paths"]
    request = schema["components"]["schemas"]["InferenceProbeRequest"]
    assert set(request["properties"]) == {"mode"}
    assert request["additionalProperties"] is False


def test_backend_reaches_a_real_local_http_fake_vllm_server(monkeypatch):
    enable(monkeypatch)
    calls = []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def reply(self, body):
            data = json.dumps(body).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            calls.append((self.path, self.headers["Authorization"], None))
            self.reply({"data": [{"id": "admissions-qwen"}]})

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            calls.append((self.path, self.headers["Authorization"], body))
            self.reply(completion('{"connection":"ok"}'))

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    monkeypatch.setenv("QWEN_BASE_URL", f"http://127.0.0.1:{server.server_port}/v1")
    # A system proxy must not intercept credentials sent to the SSH tunnel.
    monkeypatch.setenv("HTTP_PROXY", "http://127.0.0.1:1")
    monkeypatch.setenv("ALL_PROXY", "http://127.0.0.1:1")
    monkeypatch.setenv("NO_PROXY", "")
    try:
        with TestClient(create_app()) as client:
            response = client.post(ENDPOINT, json={"mode": "json"})
        assert response.status_code == 200
        assert response.json()["data"] == {"connection": "ok"}
        assert [path for path, _, _ in calls] == ["/v1/models", "/v1/chat/completions"]
        assert all(auth == "Bearer " + KEY for _, auth, _ in calls)
        assert calls[1][2]["response_format"] == {"type": "json_object"}
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()
