"""One-off migration preserves originals/history and refuses conflicting data."""

import base64
import hashlib
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.assessments.mock import MockEvaluationService
from app.assessments.schemas import MockAssessmentRequest
from app.import_browser import import_browser_backup
from app.main import create_app
from app.models import Application, AuditEvent, Document, User
from tests.document_fixtures import auth, enable_documents, make_pdf

pytestmark = pytest.mark.postgres


def backup_file(tmp_path):
    timestamp = "2026-11-17T10:00:00Z"
    raw = make_pdf(4)
    docs = [
        {
            "id": "APP-2026-0143-" + kind,
            "applicationId": "APP-2026-0143",
            "type": kind,
            "name": kind + ".pdf",
            "size": len(raw),
            "pages": 4,
            "hash": hashlib.sha256(raw).hexdigest(),
        }
        for kind in ["transcript", "cv", "statement"]
    ]
    criteria = {
        "weights": {"academic": 50, "cv": 25, "statement": 25},
        "rejectBelow": 60,
        "offerFrom": 80,
        "margin": 3,
        "mandatoryRule": "Relevant degree required",
    }
    run = (
        MockEvaluationService()
        .evaluate(
            MockAssessmentRequest.model_validate(
                {
                    "applicationId": "APP-2026-0143",
                    "criteria": {"id": "r", "version": "2.3", **criteria},
                    "documents": [{"id": d["id"], "type": d["type"], "pages": 4} for d in docs],
                    "grade": 74,
                    "modelAvailable": True,
                }
            )
        )
        .model_dump(by_alias=True, mode="json")
    )
    run["extractedGrade"] = 0
    run["flags"].append({"code": "MANUAL", "message": "Advisory critical flag", "critical": True})
    data = {
        "version": 2,
        "users": [
            {
                "id": "tutor-a",
                "name": "Test tutor",
                "email": "tutor@example.test",
                "roles": ["tutor"],
                "active": True,
                "programmeIds": ["p"],
                "canPublishCriteria": True,
            }
        ],
        "programmes": [
            {
                "id": "p",
                "createdBy": "tutor-a",
                "name": "Course",
                "code": "TEST",
                "year": "2026 / 27",
                "department": "CS",
                "description": "Test",
            }
        ],
        "rubrics": [
            {"id": "r", "programmeId": "p", "version": "2.3", "createdAt": timestamp, **criteria}
        ],
        "activeRubricIds": {"p": "r"},
        "batches": [],
        "audit": [
            {
                "id": "event",
                "actor": "legacy-system",
                "at": timestamp,
                "action": "Import",
                "target": "p",
            }
        ],
        "modelAvailable": True,
        "documents": docs,
        "applications": [
            {
                "id": "APP-2026-0143",
                "candidate": "SYNTHETIC",
                "programmeId": "p",
                "intakeYear": "2026 / 27",
                "fixture": "offer",
                "submittedAt": timestamp,
                "documentIds": [d["id"] for d in docs],
                "runs": [run],
                "corrections": [],
                "decisions": [],
            }
        ],
    }
    path = tmp_path / "synthetic-backup.json"
    path.write_text(
        json.dumps(
            {"dataset": data, "files": {d["id"]: base64.b64encode(raw).decode() for d in docs}}
        )
    )
    return path, data


def test_import_is_idempotent_and_preserves_bytes_history_and_audit(
    db_engine, db_session, tmp_path
):
    path, data = backup_file(tmp_path)
    first = import_browser_backup(path, db_engine)
    assert import_browser_backup(path, db_engine) == first
    app = db_session.get(Application, "APP-2026-0143")
    assert app.review_state == {
        key: data["applications"][0][key] for key in ("runs", "corrections", "decisions")
    }
    assert db_session.get(Document, "APP-2026-0143-cv").pdf_bytes == make_pdf(4)
    assert db_session.scalar(select(func.count()).select_from(AuditEvent)) == 1
    # A conflict discovered after account updates must roll back the whole transaction.
    changed = json.loads(path.read_text())
    changed["dataset"]["users"][0]["name"] = "Must roll back"
    changed["dataset"]["applications"][0]["candidate"] = "Conflict"
    path.write_text(json.dumps(changed))
    with pytest.raises(ValueError, match="applicant conflicts"):
        import_browser_backup(path, db_engine)
    db_session.expire_all()
    assert db_session.get(User, "tutor-a").name == "Test tutor"
    assert db_session.get(Application, app.id).candidate_reference == "SYNTHETIC"


def test_bad_original_hash_prevents_any_migration(db_engine, db_session, tmp_path):
    path, _ = backup_file(tmp_path)
    changed = json.loads(path.read_text())
    changed["dataset"]["documents"][0]["hash"] = "0" * 64
    path.write_text(json.dumps(changed))
    with pytest.raises(ValueError, match="does not match"):
        import_browser_backup(path, db_engine)
    assert db_session.scalar(select(func.count()).select_from(User)) == 0


def test_server_reviews_preserve_history_zero_grade_and_advisory_decisions(
    db_engine, db_session, tmp_path, monkeypatch
):
    path, data = backup_file(tmp_path)
    import_browser_backup(path, db_engine)
    enable_documents(monkeypatch, tmp_path)
    monkeypatch.setenv("DATABASE_URL", db_engine.url.render_as_string(hide_password=False))
    with TestClient(create_app()) as client:
        base = "/api/v1/applications/APP-2026-0143"
        original = data["applications"][0]["runs"][0]
        decision = {
            "runId": original["id"],
            "outcome": "Conditional",
            "reason": "Reviewed evidence",
        }
        for _ in range(2):
            assert (
                client.post(base + "/decisions", headers=auth(), json=decision).status_code == 200
            )
        saved = client.get("/api/v1/workspace", headers=auth()).json()["applications"][0]
        assert len(saved["decisions"]) == 1 and saved["runs"] == [original]
        correction = {
            "runId": original["id"],
            "value": 74,
            "reason": "Read source",
            "documentId": "APP-2026-0143-transcript",
            "page": 2,
        }
        assert (
            client.post(base + "/corrections", headers=auth(), json=correction).status_code == 200
        )
        saved = client.get("/api/v1/workspace", headers=auth()).json()["applications"][0]
        assert len(saved["runs"]) == 2 and saved["runs"][0] == original
        assert saved["corrections"][0]["original"] == 0
        assert saved["runs"][-1]["extractedGrade"] == 74
        assert saved["runs"][-1]["parentRunId"] == original["id"]
        assert client.post(base + "/decisions", headers=auth(), json=decision).status_code == 409
        assert (
            client.post(base + "/corrections", headers=auth(), json=correction).status_code == 409
        )
        draft = {
            "expectedId": "r",
            **{
                k: data["rubrics"][0][k]
                for k in ["weights", "rejectBelow", "offerFrom", "margin", "mandatoryRule"]
            },
        }
        draft["offerFrom"] = 90
        assert (
            client.put("/api/v1/programmes/p/criteria", headers=auth(), json=draft).status_code
            == 200
        )
        snapshot = client.get("/api/v1/workspace", headers=auth()).json()
        assert snapshot["rubrics"][-1]["version"] == "2.4"
        assert client.post(base + "/evaluations", headers=auth()).status_code == 200
        snapshot = client.get("/api/v1/workspace", headers=auth()).json()
        assert len(snapshot["applications"][0]["runs"]) == 3
        assert (
            snapshot["applications"][0]["runs"][-1]["rubricId"] == snapshot["activeRubricIds"]["p"]
        )
