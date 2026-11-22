"""Opt in by explicitly listing synthetic PDF fingerprints."""

import os
import re
from dataclasses import dataclass
from pathlib import Path

from dotenv import dotenv_values

BACKEND_DIR = Path(__file__).resolve().parents[3]
DEFAULT_MODEL_VERSION = "RedHatAI/Qwen3.5-9B-FP8-dynamic@790f0576d2d77dd5322aa0603a470bd9e3a3d1f6"


@dataclass(frozen=True)
class PilotConfig:
    document_hashes: frozenset[str] = frozenset()
    model_version: str = DEFAULT_MODEL_VERSION


def load_pilot_config() -> PilotConfig:
    values = {**dotenv_values(BACKEND_DIR / ".env"), **os.environ}
    supplied = (values.get("ENGLISH_TEST_PILOT_PDF_SHA256") or "").split()
    if any(not re.fullmatch("[0-9a-f]{64}", value) for value in supplied):
        raise ValueError("ENGLISH_TEST_PILOT_PDF_SHA256 requires space-separated SHA-256 hashes.")
    version = (values.get("ENGLISH_TEST_MODEL_VERSION") or DEFAULT_MODEL_VERSION).strip()
    if supplied and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/@-]{0,249}", version):
        raise ValueError("ENGLISH_TEST_MODEL_VERSION must identify the deployed model revision.")
    return PilotConfig(frozenset(supplied), version)
