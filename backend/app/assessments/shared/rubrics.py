"""Load each specialist's active assets into the shared scoring context."""

import json
from pathlib import Path

from app.assessments.shared.contracts import SECTION_KEYS

ASSESSMENTS_ROOT = Path(__file__).parent.parent


def agent_prompts() -> dict[str, Path]:
    return {key: ASSESSMENTS_ROOT / key / f"{key}-v1.md" for key in SECTION_KEYS}


def load_rubrics() -> dict:
    context = json.loads((ASSESSMENTS_ROOT / "shared/rubric-context-v1.json").read_text())
    return {
        **context,
        **{
            key: json.loads((ASSESSMENTS_ROOT / key / "rubric-v1.json").read_text())
            for key in SECTION_KEYS
        },
    }
