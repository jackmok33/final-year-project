"""Server-side Qwen settings; loading these never contacts the model or database."""

import math
import os
import re
import stat
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import dotenv_values

BACKEND_DIR = Path(__file__).resolve().parents[1]


class InferenceConfigurationError(ValueError):
    """Messages name settings without echoing their potentially secret values."""


@dataclass(frozen=True)
class QwenSettings:
    base_url: str
    api_key: str = field(repr=False)
    model: str = "admissions-qwen"
    timeout_seconds: float = 90


@dataclass(frozen=True)
class InferenceConfig:
    qwen: QwenSettings | None = None
    probe_enabled: bool = False


def load_inference_config() -> InferenceConfig:
    values = {**dotenv_values(BACKEND_DIR / ".env"), **os.environ}

    def get(name: str, default: str = "") -> str:
        return (values.get(name) or default).strip()

    enabled = get("QWEN_PROBE_ENABLED", "false").lower()
    if enabled not in {"true", "false"}:
        raise InferenceConfigurationError("QWEN_PROBE_ENABLED must be true or false.")
    base_url = get("QWEN_BASE_URL")
    key = get("QWEN_API_KEY")
    key_file = get("QWEN_API_KEY_FILE")
    if not any((base_url, key, key_file)):
        return InferenceConfig(probe_enabled=enabled == "true")
    if not base_url or not (key or key_file) or (key and key_file):
        raise InferenceConfigurationError(
            "Set QWEN_BASE_URL and exactly one of QWEN_API_KEY or QWEN_API_KEY_FILE."
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
                "QWEN_API_KEY_FILE must be a readable regular file with mode 600 or stricter."
            ) from None
    if not re.fullmatch(r"[A-Za-z0-9_-]{32,256}", key):
        raise InferenceConfigurationError(
            "The Qwen API key must be a 32–256 character URL-safe secret."
        )
    model = get("QWEN_MODEL", "admissions-qwen")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,199}", model):
        raise InferenceConfigurationError("QWEN_MODEL must be a valid served model name.")
    try:
        timeout = float(get("QWEN_TIMEOUT_SECONDS", "90"))
        if not math.isfinite(timeout) or not 1 <= timeout <= 180:
            raise ValueError
    except ValueError:
        raise InferenceConfigurationError(
            "QWEN_TIMEOUT_SECONDS must be between 1 and 180."
        ) from None
    return InferenceConfig(
        qwen=QwenSettings(base_url.rstrip("/"), key, model, timeout),
        probe_enabled=enabled == "true",
    )
