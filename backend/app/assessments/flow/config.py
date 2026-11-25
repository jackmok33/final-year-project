"""Explicit synthetic PDF allowlist for the full assessment pilot."""

import hashlib
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

from dotenv import dotenv_values

from app.assessments.english_test.config import BACKEND_DIR, DEFAULT_MODEL_VERSION
from app.assessments.shared.rubrics import agent_prompts, load_rubrics


@dataclass(frozen=True)
class AssessmentConfig:
    document_hashes: frozenset[str] = frozenset()
    model_version: str = DEFAULT_MODEL_VERSION


def load_assessment_config() -> AssessmentConfig:
    values = {**dotenv_values(BACKEND_DIR / ".env"), **os.environ}
    hashes = (values.get("ASSESSMENT_PILOT_PDF_SHA256") or "").split()
    if any(not re.fullmatch("[0-9a-f]{64}", value) for value in hashes):
        raise ValueError("ASSESSMENT_PILOT_PDF_SHA256 requires synthetic SHA-256 hashes.")
    return AssessmentConfig(
        frozenset(hashes),
        values.get("ENGLISH_TEST_MODEL_VERSION") or DEFAULT_MODEL_VERSION,
    )


def workflow_fingerprint() -> str:
    root = Path(__file__).parent
    digest = hashlib.sha256()
    english_prompt = root.parent / "english_test/ielts-academic-v1.md"
    prompts = [
        *agent_prompts().values(),
        *sorted((root.parent / "shared/prompts").glob("*.md")),
        root / "summary-v1.md",
    ]
    # Hash logical contents in the existing order so moving agent assets does
    # not invalidate queued jobs or change the version of saved model inputs.
    resources = [
        (english_prompt.name, english_prompt.read_bytes()),
        *((path.name, path.read_bytes()) for path in sorted(prompts, key=lambda path: path.name)),
        ("rubrics-v1.json", (json.dumps(load_rubrics(), indent=2) + "\n").encode()),
    ]
    for name, contents in resources:
        digest.update(name.encode())
        digest.update(contents)
    return digest.hexdigest()
