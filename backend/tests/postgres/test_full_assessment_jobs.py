import asyncio
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.assessments.flow.config import AssessmentConfig
from app.assessments.flow.jobs import claim, finish
from app.assessments.flow.orchestrator import AssessmentWorkflow
from app.assessments.flow.worker import run_one
from app.db import session_factory
from app.inference.client import InferenceClient
from app.main import create_app
from app.models import AssessmentJob, Document, Programme, StoredRubric
from app.seed import seed_demo
from tests.document_fixtures import auth, enable_documents
from tests.full_assessment_fixtures import DOCUMENTS, fake_response
from tests.inference_fakes import SETTINGS

pytestmark = pytest.mark.postgres


@pytest.fixture
def flow_client(db_session, db_engine, monkeypatch, tmp_path):
    seed_demo(db_session)
    db_session.commit()
    enable_documents(monkeypatch, tmp_path)
    monkeypatch.setenv("DATABASE_URL", db_engine.url.render_as_string(hide_password=False))
    config = AssessmentConfig(
        frozenset(hashlib.sha256(data).hexdigest() for data in DOCUMENTS.values())
    )
    monkeypatch.setenv("ASSESSMENT_PILOT_PDF_SHA256", " ".join(config.document_hashes))
    with TestClient(create_app()) as client:
        yield client, session_factory(db_engine), config


def upload_application(client):
    programme = client.post(
        "/api/v1/programmes", json={"name": "Full synthetic flow"}, headers=auth()
    )
    assert programme.status_code == 201
    programme_id = programme.json()["id"]
    response = client.post(
        f"/api/v1/programmes/{programme_id}/applications",
        data={
            "manifest": json.dumps(
                {
                    "candidate": "SYNTHETIC-FULL-FLOW",
                    "intakeYear": "2026-27",
                    "documents": [
                        {"type": kind, "fileIndex": index} for index, kind in enumerate(DOCUMENTS)
                    ],
                }
            )
        },
        files=[
            ("file", (f"{kind}.pdf", data, "application/pdf")) for kind, data in DOCUMENTS.items()
        ],
        headers=auth(),
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def workspace(client, user="tutor-a"):
    return client.get("/api/v1/workspace", headers=auth(user)).json()


def process(sessions, config):
    async def work():
        async with InferenceClient(
            SETTINGS, transport=httpx.MockTransport(fake_response)
        ) as client:
            assert await run_one(sessions, config, AssessmentWorkflow(client))

    asyncio.run(work())


def test_upload_queue_worker_saved_score_and_tutor_decision(flow_client):
    client, sessions, config = flow_client
    identity = upload_application(client)
    path = f"/api/v1/applications/{identity}/evaluations"
    assert client.post(path).status_code == 401
    assert client.post(path, headers=auth("tutor-b")).status_code == 404
    assert client.post(path, headers=auth("admin-a")).status_code == 403
    with ThreadPoolExecutor(max_workers=2) as threads:
        responses = [threads.submit(client.post, path, headers=auth()) for _ in range(2)]
    first, second = [response.result() for response in responses]
    assert first.status_code == second.status_code == 202
    assert first.json() == second.json()
    run = workspace(client)["applications"][0]["runs"][-1]
    assert run["status"] == "queued" and run["overall"] is None and run["sections"] == []
    process(sessions, config)
    data = workspace(client)
    run = data["applications"][0]["runs"][-1]
    assert run["overall"] == 66.67 and len(run["sections"]) == 4
    assert run["simulated"] is False and run["evaluationSource"] == "qwen-langgraph"
    assert run["englishEligibility"]["outcome"] == "meets_requirement"
    assert run["provenance"]["workflowHash"]
    assert workspace(client, "tutor-b")["applications"] == []
    with TestClient(create_app()) as reopened:
        assert workspace(reopened)["applications"][0]["runs"][-1] == run
    decision = client.post(
        f"/api/v1/applications/{identity}/decisions",
        headers=auth(),
        json={"runId": run["id"], "outcome": "Conditional", "reason": "Synthetic flow reviewed."},
    )
    assert decision.status_code == 200
    assert workspace(client)["applications"][0]["decisions"][-1]["outcome"] == "Conditional"


def test_worker_interruption_preserves_history_and_blocks_late_results(flow_client):
    client, sessions, config = flow_client
    identity = upload_application(client)
    path = f"/api/v1/applications/{identity}/evaluations"
    first = client.post(path, headers=auth()).json()
    job = claim(sessions)
    with sessions.begin() as session:
        session.execute(
            update(AssessmentJob)
            .where(AssessmentJob.id == job.id)
            .values(lease_until=datetime.now(UTC) - timedelta(seconds=1))
        )
    assert workspace(client)["applications"][0]["runs"][-1]["status"] == "failed"
    retry = client.post(path, headers=auth())
    assert retry.status_code == 202 and retry.json()["id"] != first["id"]
    finish(sessions, job, result={"overall": 100})
    process(sessions, config)
    runs = workspace(client)["applications"][0]["runs"]
    assert [run["status"] for run in runs] == ["failed", "awaiting review"]
    assert runs[-1]["overall"] == 66.67


def test_queued_inputs_pin_criteria_and_changed_sources_fail_closed(flow_client):
    client, sessions, config = flow_client
    identity = upload_application(client)
    path = f"/api/v1/applications/{identity}/evaluations"
    assert client.post(path, headers=auth()).status_code == 202
    with sessions.begin() as session:
        job = session.scalar(select(AssessmentJob))
        programme = session.get(Programme, workspace(client)["applications"][0]["programmeId"])
        criteria = dict(job.inputs["criteria"])
        criteria = {
            key: value for key, value in criteria.items() if key not in {"id", "version", "name"}
        }
        rubric = StoredRubric(
            programme_id=programme.id,
            version="2.0",
            criteria={**criteria, "offerFrom": 65, "margin": 0},
        )
        session.add(rubric)
        session.flush()
        programme.active_rubric_id = rubric.id
    process(sessions, config)
    assert workspace(client)["applications"][0]["runs"][-1]["recommendation"] == "Further review"
    assert client.post(path, headers=auth()).status_code == 202
    with sessions.begin() as session:
        doc = session.scalar(select(Document).where(Document.document_type == "cv"))
        doc.pdf_bytes = doc.pdf_bytes[:-1] + b"X"
    process(sessions, config)
    assert workspace(client)["applications"][0]["runs"][-1]["status"] == "failed"
