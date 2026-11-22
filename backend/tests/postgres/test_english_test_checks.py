import asyncio
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.assessments.english_test.config import PilotConfig
from app.assessments.english_test.graph import EnglishTestWorkflow
from app.assessments.english_test.jobs import claim, finish
from app.assessments.english_test.schemas import EligibilityResult
from app.assessments.english_test.worker import run_one
from app.db import session_factory
from app.inference.client import InferenceClient
from app.main import create_app
from app.models import EnglishTestCheck
from app.seed import seed_demo
from tests.document_fixtures import auth, enable_documents, make_pdf
from tests.english_test_fixtures import RESULT, english_pdf
from tests.inference_fakes import SETTINGS, completion

pytestmark = pytest.mark.postgres


@pytest.fixture
def pilot_client(db_engine, db_session, monkeypatch, tmp_path):
    seed_demo(db_session)
    db_session.commit()
    enable_documents(monkeypatch, tmp_path)
    monkeypatch.setenv("DATABASE_URL", db_engine.url.render_as_string(hide_password=False))
    pilot = PilotConfig(frozenset({hashlib.sha256(english_pdf()).hexdigest()}))
    monkeypatch.setenv("ENGLISH_TEST_PILOT_PDF_SHA256", " ".join(pilot.document_hashes))
    with TestClient(create_app()) as client:
        yield client, session_factory(db_engine), pilot


def submit(client, pdf, kind="english_test"):
    name = "Synthetic English test workspace"
    programme = client.post("/api/v1/programmes", json={"name": name}, headers=auth())
    assert programme.status_code == 201
    response = client.post(
        f"/api/v1/programmes/{programme.json()['id']}/applications",
        data={
            "manifest": json.dumps(
                {
                    "candidate": "SYNTHETIC-IELTS",
                    "intakeYear": "2026-27",
                    "documents": [{"type": kind, "fileIndex": 0}],
                }
            )
        },
        files=[("file", ("synthetic-report.pdf", pdf, "application/pdf"))],
        headers=auth(),
    )
    assert response.status_code == 201, response.text
    return "/api/v1/applications/" + response.json()["id"] + "/english-test-checks"


def snapshot(client, user="tutor-a"):
    return client.get("/api/v1/workspace", headers=auth(user)).json()


def work(sessions, pilot, *, provider_ok=True):
    def transport(_request):
        if not provider_ok:
            raise httpx.ConnectError("Fake upstream disconnected")
        return httpx.Response(200, json=completion(json.dumps(RESULT)))

    async def process():
        async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
            return await run_one(sessions, pilot, EnglishTestWorkflow(client))

    assert asyncio.run(process())


def test_english_check_is_owned_durable_and_safe_to_retry(pilot_client):
    client, sessions, pilot = pilot_client
    path = submit(client, english_pdf())
    assert snapshot(client)["applications"][0]["englishTestCheck"] is None
    assert client.post(path).status_code == 401
    assert client.post(path, headers=auth("tutor-b")).status_code == 404
    assert client.post(path, headers=auth("admin-a")).status_code == 403
    with ThreadPoolExecutor(max_workers=2) as threads:
        submissions = [threads.submit(client.post, path, headers=auth()) for _ in range(2)]
    first, duplicate = [submission.result() for submission in submissions]
    assert first.status_code == duplicate.status_code == 202
    assert duplicate.json() == first.json()
    work(sessions, pilot, provider_ok=False)
    check = snapshot(client)["applications"][0]["englishTestCheck"]
    assert check["status"] == "failed" and check["error"] == "unavailable"

    retry = client.post(path, headers=auth())
    assert retry.status_code == 202 and retry.json()["id"] != first.json()["id"]
    work(sessions, pilot)
    data = snapshot(client)
    app = data["applications"][0]
    result = app["englishTestCheck"]
    assert result["status"] == "completed" and result["error"] is None
    assert result["result"]["outcome"] == "meets_requirement"
    assert result["result"]["writing"] == 6.5
    assert result["documentId"] == data["documents"][0]["id"] and result["page"] == 1
    assert app["runs"] == app["decisions"] == []
    assert snapshot(client, "tutor-b")["applications"] == []
    with TestClient(create_app()) as another:
        assert snapshot(another)["applications"][0]["englishTestCheck"] == result
    with sessions() as session:
        checks = session.scalars(
            select(EnglishTestCheck).order_by(EnglishTestCheck.created_at)
        ).all()
        assert [check.status for check in checks] == ["failed", "completed"]
        assert checks[1].model_version == pilot.model_version
        assert checks[1].prompt_version == "ielts-academic-v1"
        assert checks[1].rule_version == result["ruleVersion"]


@pytest.mark.parametrize(("kind", "status"), [("english_test", 403), ("cv", 422)])
def test_unapproved_or_missing_report_never_creates_a_job(pilot_client, kind, status):
    client, sessions, _ = pilot_client
    path = submit(client, make_pdf(), kind)
    assert "englishTestCheck" not in snapshot(client)["applications"][0]
    assert client.post(path, headers=auth()).status_code == status
    with sessions() as session:
        assert session.scalar(select(EnglishTestCheck)) is None


def test_expired_worker_lease_is_visible_and_cannot_overwrite_retry(pilot_client):
    client, sessions, pilot = pilot_client
    path = submit(client, english_pdf())
    first = client.post(path, headers=auth()).json()
    check = claim(sessions)
    assert check.id == first["id"]
    assert client.post(path, headers=auth()).json() == {"id": check.id, "status": "running"}
    with sessions.begin() as session:
        session.execute(
            update(EnglishTestCheck)
            .where(EnglishTestCheck.id == check.id)
            .values(lease_until=datetime.now(UTC) - timedelta(seconds=1))
        )
    expired = snapshot(client)["applications"][0]["englishTestCheck"]
    assert expired["status"] == "failed" and expired["error"] == "interrupted"
    retry = client.post(path, headers=auth()).json()
    finish(
        sessions, check, outcome=EligibilityResult(outcome="needs_review", reason="invalid_output")
    )
    work(sessions, pilot)
    latest = snapshot(client)["applications"][0]["englishTestCheck"]
    assert latest["id"] == retry["id"] and latest["status"] == "completed"
    with sessions() as session:
        assert session.get(EnglishTestCheck, first["id"]).error == "interrupted"
