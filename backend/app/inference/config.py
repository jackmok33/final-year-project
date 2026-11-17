"""Server-side provider selection; loading never contacts a model or database."""

import math
import os
import re
import stat
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from dotenv import dotenv_values

BACKEND_DIR = Path(__file__).resolve().parents[2]
OPENAI_BASE_URL = "https://api.openai.com/v1"
OPENAI_DEFAULT_MODEL = "gpt-6-luna"
Provider = Literal["qwen", "openai"]


class InferenceConfigurationError(ValueError):
    """Messages name settings without echoing their potentially secret values."""


@dataclass(frozen=True)
class InferenceSettings:
    base_url: str
    api_key: str = field(repr=False)
    model: str = "admissions-qwen"
    timeout_seconds: float = 90
    provider: Provider = "qwen"


@dataclass(frozen=True)
class InferenceConfig:
    connection: InferenceSettings | None = None
    probe_enabled: bool = False


def load_inference_config() -> InferenceConfig:
    values = {**dotenv_values(BACKEND_DIR / ".env"), **os.environ}

    def get(name: str, default: str = "") -> str:
        return (values.get(name) or default).strip()

    provider = get("INFERENCE_PROVIDER", "qwen").lower()
    if provider not in {"qwen", "openai"}:
        raise InferenceConfigurationError("INFERENCE_PROVIDER must be qwen or openai.")
    # Keep existing Qwen-only configuration working; the shared flag takes precedence.
    flag = "INFERENCE_PROBE_ENABLED"
    if flag not in values and provider == "qwen":
        flag = "QWEN_PROBE_ENABLED"
    enabled = get(flag, "false").lower()
    if enabled not in {"true", "false"}:
        raise InferenceConfigurationError(f"{flag} must be true or false.")
    prefix = "QWEN" if provider == "qwen" else "OPENAI"
    base_url = get("QWEN_BASE_URL") if provider == "qwen" else OPENAI_BASE_URL
    key = get(f"{prefix}_API_KEY")
    key_file = get(f"{prefix}_API_KEY_FILE")
    if not any((key, key_file)) and (provider == "openai" or not base_url):
        return InferenceConfig(probe_enabled=enabled == "true")
    if not base_url or not (key or key_file) or (key and key_file):
        raise InferenceConfigurationError(
            f"Configure the {prefix} endpoint and exactly one of "
            f"{prefix}_API_KEY or {prefix}_API_KEY_FILE."
        )
    try:
        url = urlsplit(base_url)
        port = url.port
        valid = (
            url.scheme in {"http", "https"}
            and bool(url.hostname)
            and (port is None or 1 <= port <= 65535)
            and (url.scheme == "https" or url.hostname in {"localhost", "127.0.0.1", "::1"})
            and url.path.rstrip("/") == "/v1"
            and url.username is None
            and url.password is None
            and "?" not in base_url
            and "#" not in base_url
        )
    except ValueError:
        valid = False
    if not valid:
        raise InferenceConfigurationError(
            "QWEN_BASE_URL must end in /v1, without credentials, query or fragment; "
            "HTTP is permitted only for a loopback SSH tunnel."
        )
    if key_file:
        try:
            path = Path(key_file).expanduser()
            mode = path.stat().st_mode
            if path.is_symlink() or not stat.S_ISREG(mode) or mode & 0o077:
                raise ValueError
            key = path.read_text().strip()
        except (OSError, UnicodeError, ValueError):
            raise InferenceConfigurationError(
                f"{prefix}_API_KEY_FILE must be a readable regular file with mode 600 or stricter."
            ) from None
    key_limit = 256 if provider == "qwen" else 1024
    if not re.fullmatch(rf"[A-Za-z0-9_-]{{32,{key_limit}}}", key):
        raise InferenceConfigurationError(
            f"{prefix}_API_KEY must be a 32–{key_limit} character URL-safe secret."
        )
    model = get(
        f"{prefix}_MODEL", "admissions-qwen" if provider == "qwen" else OPENAI_DEFAULT_MODEL
    )
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,199}", model):
        raise InferenceConfigurationError(f"{prefix}_MODEL must be a valid model name.")
    try:
        timeout = float(get(f"{prefix}_TIMEOUT_SECONDS", "90"))
        if not math.isfinite(timeout) or not 1 <= timeout <= 180:
            raise ValueError
    except ValueError:
        raise InferenceConfigurationError(
            f"{prefix}_TIMEOUT_SECONDS must be between 1 and 180."
        ) from None
    return InferenceConfig(
        connection=InferenceSettings(base_url.rstrip("/"), key, model, timeout, provider),
        probe_enabled=enabled == "true",
    )
