"""Queued-job versioning follows the active agent assets."""

import json
import shutil

from app.assessments.flow import config
from app.assessments.shared import rubrics
from app.assessments.shared.contracts import SECTION_KEYS


def test_moving_assets_preserves_versions_and_every_active_asset_is_fingerprinted(
    tmp_path, monkeypatch
):
    original = config.workflow_fingerprint()
    root = tmp_path / "assessments"
    shutil.copytree(rubrics.ASSESSMENTS_ROOT, root, ignore=shutil.ignore_patterns("__pycache__"))
    monkeypatch.setattr(rubrics, "ASSESSMENTS_ROOT", root)
    monkeypatch.setattr(config, "__file__", str(root / "flow/config.py"))
    assert config.workflow_fingerprint() == original

    active = [
        *(f"{key}/{key}-v1.md" for key in SECTION_KEYS),
        *(f"{key}/rubric-v1.json" for key in SECTION_KEYS),
        "english_test/ielts-academic-v1.md",
        "shared/rubric-context-v1.json",
        "shared/prompts/extract-v1.md",
        "shared/prompts/judge-v1.md",
        "flow/summary-v1.md",
    ]
    for name in active:
        path = root / name
        contents = path.read_text()
        if path.suffix == ".json":
            document = json.loads(contents)
            if "capabilities" in document:
                document["capabilities"][0] += " Revised."
            else:
                next(iter(document.values()))["levels"]["0"] += " Revised."
            updated = json.dumps(document)
        else:
            updated = contents + "\nRevised instructions.\n"
        path.write_text(updated)
        assert config.workflow_fingerprint() != original, name
        path.write_text(contents)

    assert config.workflow_fingerprint() == original
