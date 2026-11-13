import pytest

from app.inference_config import InferenceConfigurationError, load_inference_config

KEY = "test-key-" + "a" * 40


def configure(monkeypatch, **values):
    for name, value in {
        "QWEN_BASE_URL": "http://127.0.0.1:18000/v1",
        "QWEN_API_KEY": KEY,
        **values,
    }.items():
        monkeypatch.setenv(name, value)


def test_no_configuration_is_optional_and_probe_is_disabled():
    config = load_inference_config()
    assert config.qwen is None
    assert config.probe_enabled is False


def test_dotenv_is_cwd_independent_and_environment_overrides_it(monkeypatch, tmp_path):
    (tmp_path / ".env").write_text(
        f"QWEN_BASE_URL=http://localhost:18000/v1/\nQWEN_API_KEY={KEY}\nQWEN_MODEL=file-model\n"
    )
    monkeypatch.setenv("QWEN_MODEL", "environment-model")
    monkeypatch.chdir(tmp_path.parent)
    config = load_inference_config()
    assert config.qwen.base_url == "http://localhost:18000/v1"
    assert config.qwen.model == "environment-model"
    assert KEY not in repr(config)
    assert "QWEN_API_KEY" not in __import__("os").environ


def test_environment_can_explicitly_clear_dotenv_values(monkeypatch, tmp_path):
    (tmp_path / ".env").write_text(f"QWEN_BASE_URL=http://localhost:18000/v1\nQWEN_API_KEY={KEY}\n")
    monkeypatch.setenv("QWEN_BASE_URL", "")
    monkeypatch.setenv("QWEN_API_KEY", "")
    assert load_inference_config().qwen is None


@pytest.mark.parametrize(
    "url", ["https://model.example/v1", "http://localhost:18000/v1/", "http://[::1]:18000/v1"]
)
def test_private_tunnel_or_verified_https_url(monkeypatch, url):
    configure(monkeypatch, QWEN_BASE_URL=url)
    assert load_inference_config().qwen.base_url == url.rstrip("/")


@pytest.mark.parametrize(
    "url",
    [
        "http://remote.example/v1",
        "https://model.example",
        "file:///v1",
        "http://user:secret@localhost/v1",
        "http://@localhost/v1",
        "http://localhost/v1?key=secret",
        "http://localhost/v1#secret",
        "http://localhost/v1?",
        "http://localhost/v1#",
        "http://localhost:not-a-port/v1",
        "http://localhost:0/v1",
    ],
)
def test_invalid_urls_do_not_echo_their_values(monkeypatch, url):
    configure(monkeypatch, QWEN_BASE_URL=url)
    with pytest.raises(InferenceConfigurationError) as error:
        load_inference_config()
    assert url not in str(error.value)
    assert KEY not in str(error.value)


@pytest.mark.parametrize(
    "values",
    [
        {"QWEN_API_KEY": ""},
        {"QWEN_BASE_URL": ""},
        {"QWEN_API_KEY_FILE": "/private/no-such-key"},
        {"QWEN_API_KEY": "too-short"},
        {"QWEN_MODEL": "model\nheader"},
        {"QWEN_TIMEOUT_SECONDS": "nan"},
        {"QWEN_TIMEOUT_SECONDS": "inf"},
        {"QWEN_TIMEOUT_SECONDS": "0"},
        {"QWEN_TIMEOUT_SECONDS": "181"},
        {"QWEN_PROBE_ENABLED": "maybe"},
    ],
)
def test_bad_or_partial_configuration_fails_without_secrets(monkeypatch, values):
    configure(monkeypatch, **values)
    with pytest.raises(InferenceConfigurationError) as error:
        load_inference_config()
    assert KEY not in str(error.value)


def test_mode_600_deployment_key_file_is_supported(monkeypatch, tmp_path):
    key = tmp_path / "api.key"
    key.write_text(KEY + "\n")
    key.chmod(0o600)
    configure(monkeypatch, QWEN_API_KEY="", QWEN_API_KEY_FILE=str(key), QWEN_PROBE_ENABLED="true")
    config = load_inference_config()
    assert config.qwen.api_key == KEY
    assert config.probe_enabled is True
    assert KEY not in repr(config)


@pytest.mark.parametrize("kind", ["public", "symlink", "missing", "directory", "invalid-contents"])
def test_bad_key_file_is_rejected_without_path_or_contents(monkeypatch, tmp_path, kind):
    path = tmp_path / "secret-location"
    if kind == "directory":
        path.mkdir(mode=0o700)
    elif kind != "missing":
        target = tmp_path / "target"
        target.write_text("bad" if kind == "invalid-contents" else KEY)
        target.chmod(0o644 if kind == "public" else 0o600)
        if kind == "symlink":
            path.symlink_to(target)
        else:
            target.rename(path)
    configure(monkeypatch, QWEN_API_KEY="", QWEN_API_KEY_FILE=str(path))
    with pytest.raises(InferenceConfigurationError) as error:
        load_inference_config()
    assert str(path) not in str(error.value)
    assert KEY not in str(error.value)
