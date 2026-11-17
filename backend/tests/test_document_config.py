import json
import os
import subprocess
import sys

import pytest
from fastapi.testclient import TestClient

from app.document_config import load_document_access
from app.main import create_app
from tests.document_fixtures import TOKENS, UPLOAD_PATH, enable_documents


def test_no_document_configuration_is_optional():
    assert load_document_access() is None


def test_only_hashed_credentials_map_to_their_server_subject(monkeypatch, tmp_path):
    enable_documents(monkeypatch, tmp_path)
    access = load_document_access()
    assert access.identify(TOKENS["tutor-a"]) == "tutor-a"
    assert access.identify(TOKENS["tutor-b"]) == "tutor-b"
    assert access.identify("x" * 50) is None
    assert access.identify("bad\r\nheader") is None
    assert TOKENS["tutor-a"] not in repr(access)


@pytest.mark.parametrize(
    "failure",
    [
        "public",
        "symlink",
        "missing",
        "invalid-json",
        "duplicate",
        "empty",
        "plain-token",
        "bad-user",
        "too-large",
    ],
)
def test_bad_token_files_fail_without_echoing_path_or_contents(monkeypatch, tmp_path, failure):
    path = enable_documents(monkeypatch, tmp_path)
    if failure == "public":
        path.chmod(0o644)
    elif failure == "symlink":
        link = tmp_path / "linked.json"
        link.symlink_to(path)
        monkeypatch.setenv("DOCUMENT_API_TOKENS_FILE", str(link))
    elif failure == "missing":
        path.unlink()
    else:
        path.write_text(
            {
                "invalid-json": "private failure " + TOKENS["tutor-a"],
                "duplicate": '{"' + "a" * 64 + '":"tutor-a","' + "a" * 64 + '":"tutor-b"}',
                "empty": "{}",
                "plain-token": json.dumps({TOKENS["tutor-a"]: "tutor-a"}),
                "bad-user": json.dumps({"a" * 64: []}),
                "too-large": "x" * 16385,
            }[failure]
        )
    with pytest.raises(ValueError) as error:
        load_document_access()
    assert str(path) not in str(error.value)
    assert TOKENS["tutor-a"] not in str(error.value)


def test_document_routes_disabled_by_default_without_database_configuration(client):
    assert client.get(UPLOAD_PATH).status_code == 404
    assert (
        client.post(UPLOAD_PATH, params={"documentType": "cv", "filename": "file.pdf"}).status_code
        == 404
    )
    assert client.get("/api/v1/documents/unknown").status_code == 404
    assert client.app.state.document_database is None


@pytest.mark.parametrize("header", [None, "Bearer bad", "Basic dXNlcjpwYXNz", "Bearer " + "y" * 60])
def test_missing_or_invalid_credentials_never_open_database(monkeypatch, tmp_path, header):
    enable_documents(monkeypatch, tmp_path)
    with TestClient(create_app()) as client:
        headers = {} if header is None else {"Authorization": header}
        response = client.get(UPLOAD_PATH, headers=headers)
        assert response.status_code == 401
        assert response.headers["WWW-Authenticate"] == "Bearer"
        assert client.app.state.document_database is None


def test_valid_token_with_invalid_database_configuration_returns_safe_503(monkeypatch, tmp_path):
    from tests.document_fixtures import auth

    enable_documents(monkeypatch, tmp_path)
    monkeypatch.setenv("DATABASE_URL", "private-invalid-database-url")
    with TestClient(create_app()) as client:
        response = client.get(UPLOAD_PATH, headers=auth())
        assert response.status_code == 503
        assert "private-invalid" not in response.text
        assert client.app.state.document_database is None


def test_lifespan_with_enabled_documents_still_does_not_import_database(monkeypatch, tmp_path):
    enable_documents(monkeypatch, tmp_path)
    env = os.environ.copy()
    env.pop("QWEN_BASE_URL", None)
    for key in list(env):
        if key.startswith(("QWEN_", "OPENAI_", "INFERENCE_")):
            del env[key]
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys; from fastapi.testclient import TestClient; "
            "from app.main import create_app; "
            "c=TestClient(create_app()); c.__enter__(); "
            "assert c.get('/api/v1/health').status_code==200; "
            "assert 'app.db' not in sys.modules and 'sqlalchemy' not in sys.modules; "
            "c.__exit__(None,None,None)",
        ],
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
