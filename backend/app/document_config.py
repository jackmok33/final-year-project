"""Explicit opt-in document credentials; no database or network work on load."""

import hashlib
import hmac
import json
import os
import re
import stat
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import dotenv_values

BACKEND_DIR = Path(__file__).resolve().parents[1]
MAX_TOKEN_FILE_BYTES = 16384


@dataclass(frozen=True)
class DocumentAccess:
    tokens: dict[str, str] = field(repr=False)

    def identify(self, token: str) -> str | None:
        if not re.fullmatch(r"[A-Za-z0-9_-]{32,256}", token):
            return None
        digest = hashlib.sha256(token.encode("ascii")).hexdigest()
        for known, user_id in self.tokens.items():
            if hmac.compare_digest(known, digest):
                return user_id
        return None


def _unique_keys(pairs):
    value = dict(pairs)
    if len(value) != len(pairs):
        raise ValueError
    return value


def load_document_access() -> DocumentAccess | None:
    values = {**dotenv_values(BACKEND_DIR / ".env"), **os.environ}
    setting = (values.get("DOCUMENT_API_TOKENS_FILE") or "").strip()
    if not setting:
        return None
    try:
        path = Path(setting).expanduser()
        descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(descriptor, "rb") as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077:
                raise ValueError
            raw = stream.read(MAX_TOKEN_FILE_BYTES + 1)
        if len(raw) > MAX_TOKEN_FILE_BYTES:
            raise ValueError
        tokens = json.loads(raw, object_pairs_hook=_unique_keys)
        if not isinstance(tokens, dict) or not 1 <= len(tokens) <= 100:
            raise ValueError
        for digest, user_id in tokens.items():
            if (
                not re.fullmatch(r"[0-9a-f]{64}", digest)
                or not isinstance(user_id, str)
                or not 1 <= len(user_id) <= 200
                or not user_id.strip()
                or user_id != user_id.strip()
            ):
                raise ValueError
    except (OSError, ValueError, UnicodeError, RecursionError):
        raise ValueError(
            "DOCUMENT_API_TOKENS_FILE must be a private regular JSON file (mode 600 or "
            "stricter) mapping SHA-256 token digests to user IDs."
        ) from None
    return DocumentAccess(tokens)
