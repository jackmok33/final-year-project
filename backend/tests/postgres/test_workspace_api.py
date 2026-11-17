import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.main import create_app
from app.models import Application, Document, StoredRubric, UploadBatch
from app.seed import seed_demo
from tests.document_fixtures import auth, enable_documents, make_pdf

pytestmark = pytest.mark.postgres


@pytest.fixture
def workspace_client(db_engine, db_session, monkeypatch, tmp_path):
    seed_demo(db_session)
    db_session.commit()
    enable_documents(monkeypatch, tmp_path)
    monkeypatch.setenv("DATABASE_URL", db_engine.url.render_as_string(hide_password=False))
    with TestClient(create_app()) as client:
        yield client


def course(client, name="New course"):
    response = client.post("/api/v1/programmes", json={"name": name}, headers=auth())
    assert response.status_code == 201, response.text
    return response.json()["id"]


def submit(client, programme_id, *, batch=False, data=None, manifest=None):
    if manifest is None:
        applicant = {"candidate": "SYNTHETIC-NEW", "documents": [{"type": "cv", "fileIndex": 0}]}
        manifest = {
            "intakeYear": "2026 / 27",
            **({"filename": "batch.zip", "applications": [applicant]} if batch else applicant),
        }
    return client.post(
        f"/api/v1/programmes/{programme_id}/" + ("batches" if batch else "applications"),
        data={"manifest": json.dumps(manifest)},
        files=[("file", ("cv.pdf", make_pdf() if data is None else data, "application/pdf"))],
        headers=auth(),
    )


def test_snapshot_identity_and_owned_course_creation(workspace_client):
    response = workspace_client.get("/api/v1/workspace", headers=auth())
    assert response.headers["cache-control"] == "private, no-store"
    initial = response.json()
    assert (
        initial["subject"] == "tutor-a"
        and initial["programmes"] == []
        and len(initial["users"]) == 1
    )
    programme_id = course(workspace_client, "  學習 MSc  ")
    snapshot = workspace_client.get("/api/v1/workspace", headers=auth()).json()
    assert snapshot["programmes"][0]["name"] == "學習 MSc"
    assert snapshot["programmes"][0]["createdBy"] == "tutor-a"
    assert snapshot["activeRubricIds"][programme_id] == snapshot["rubrics"][0]["id"]
    assert snapshot["rubrics"][0]["weights"] == {
        "academic": 40,
        "cv": 25,
        "statement": 25,
        "references": 10,
    }
    assert (
        workspace_client.post(
            "/api/v1/programmes", json={"name": "學習 msc"}, headers=auth()
        ).status_code
        == 409
    )
    assert (
        workspace_client.get("/api/v1/workspace", headers=auth("tutor-b")).json()["programmes"]
        == []
    )
    assert (
        workspace_client.post(
            "/api/v1/programmes", json={"name": "Denied"}, headers=auth("admin-a")
        ).status_code
        == 403
    )


def test_application_and_originals_commit_together_and_survive_new_clients(
    workspace_client, db_engine
):
    programme_id = course(workspace_client)
    created = submit(workspace_client, programme_id)
    assert created.status_code == 201, created.text
    snapshot = workspace_client.get("/api/v1/workspace", headers=auth()).json()
    app = snapshot["applications"][0]
    assert app["id"] == created.json()["id"] and app["batchId"] == created.json()["batchId"]
    assert (
        app["runs"] == []
        and app["corrections"] == []
        and app["decisions"] == []
        and "fixture" not in app
    )
    assert snapshot["batches"][0]["source"] == "existing"
    assert len(snapshot["documents"]) == 1
    with TestClient(create_app()) as other:
        assert (
            other.get("/api/v1/workspace", headers=auth()).json()["applications"][0]["id"]
            == app["id"]
        )
        assert (
            other.get("/api/v1/documents/" + app["documentIds"][0], headers=auth()).content
            == make_pdf()
        )
    assert (
        workspace_client.post(
            "/api/v1/applications/" + app["id"] + "/evaluations", headers=auth()
        ).status_code
        == 503
    )
    assert (
        workspace_client.get("/api/v1/workspace", headers=auth()).json()["applications"][0]["runs"]
        == []
    )


@pytest.mark.parametrize("failure", ["invalid-pdf", "indices", "duplicate-singleton", "pages"])
def test_whole_application_failure_leaves_no_application_batch_or_pdf(
    workspace_client, db_session, failure
):
    programme_id = course(workspace_client)
    if failure == "indices":
        manifest = {
            "intakeYear": "2026 / 27",
            "candidate": "A",
            "documents": [{"type": "cv", "fileIndex": 1}],
        }
        response = submit(workspace_client, programme_id, manifest=manifest)
    elif failure == "duplicate-singleton":
        manifest = {
            "intakeYear": "2026 / 27",
            "candidate": "A",
            "documents": [{"type": "cv", "fileIndex": 0}, {"type": "cv", "fileIndex": 1}],
        }
        response = workspace_client.post(
            f"/api/v1/programmes/{programme_id}/applications",
            data={"manifest": json.dumps(manifest)},
            files=[
                ("file", ("a.pdf", make_pdf(), "application/pdf")),
                ("file", ("b.pdf", make_pdf(), "application/pdf")),
            ],
            headers=auth(),
        )
    else:
        response = submit(
            workspace_client,
            programme_id,
            data=b"not PDF" if failure == "invalid-pdf" else make_pdf(101),
        )
    assert response.status_code == 422
    for model in (Application, Document, UploadBatch):
        assert db_session.scalar(select(func.count()).select_from(model)) == 0


def test_batch_import_has_one_transaction_and_correct_scope(workspace_client):
    programme_id = course(workspace_client)
    manifest = {
        "intakeYear": "2026 / 27",
        "filename": "batch.zip",
        "applications": [
            {"candidate": "A", "documents": [{"type": "reference", "fileIndex": 0}]},
            {"candidate": "B", "documents": [{"type": "cv", "fileIndex": 1}]},
        ],
    }
    url = f"/api/v1/programmes/{programme_id}/batches"
    bad = workspace_client.post(
        url,
        data={"manifest": json.dumps(manifest)},
        files=[
            ("file", ("ref.pdf", make_pdf(), "application/pdf")),
            ("file", ("cv.pdf", b"bad", "application/pdf")),
        ],
        headers=auth(),
    )
    assert bad.status_code == 422
    assert workspace_client.get("/api/v1/workspace", headers=auth()).json()["applications"] == []
    good = workspace_client.post(
        url,
        data={"manifest": json.dumps(manifest)},
        files=[
            ("file", ("ref.pdf", make_pdf(), "application/pdf")),
            ("file", ("cv.pdf", make_pdf(), "application/pdf")),
        ],
        headers=auth(),
    )
    assert good.status_code == 201, good.text
    data = workspace_client.get("/api/v1/workspace", headers=auth()).json()
    assert (
        len(data["applications"]) == 2 and len(data["documents"]) == 2 and len(data["batches"]) == 1
    )
    assert all(a["batchId"] == good.json()["id"] for a in data["applications"])
    assert workspace_client.put(
        f"/api/v1/programmes/{programme_id}/criteria", json={}, headers=auth("tutor-b")
    ).status_code in (404, 422)


def test_criteria_versions_are_immutable_and_optimistic(workspace_client, db_session):
    programme_id = course(workspace_client)
    old = workspace_client.get("/api/v1/workspace", headers=auth()).json()["rubrics"][0]
    draft = {
        "expectedId": old["id"],
        **{k: old[k] for k in ("weights", "rejectBelow", "offerFrom", "margin", "mandatoryRule")},
    }
    draft["offerFrom"] = 85
    response = workspace_client.put(
        f"/api/v1/programmes/{programme_id}/criteria", json=draft, headers=auth()
    )
    assert response.status_code == 200, response.text
    assert db_session.get(StoredRubric, old["id"]).criteria["offerFrom"] == 80
    assert (
        workspace_client.put(
            f"/api/v1/programmes/{programme_id}/criteria", json=draft, headers=auth()
        ).status_code
        == 409
    )
    assert db_session.scalar(select(func.count()).select_from(StoredRubric)) == 2


def test_admin_accounts_and_last_admin_guard(workspace_client):
    admin = workspace_client.get("/api/v1/workspace", headers=auth("admin-a")).json()
    assert len(admin["users"]) == 4 and admin["applications"] == [] and admin["documents"] == []
    payload = {
        "name": "Admin",
        "email": "admin@demo.ucl.local",
        "roles": ["admin"],
        "active": False,
    }
    assert (
        workspace_client.put(
            "/api/v1/accounts/admin-a", json=payload, headers=auth("admin-a")
        ).status_code
        == 409
    )
    payload = {"name": "New tutor", "email": "new@example.test", "roles": ["tutor"], "active": True}
    assert (
        workspace_client.post("/api/v1/accounts", json=payload, headers=auth()).status_code == 403
    )
    created = workspace_client.post("/api/v1/accounts", json=payload, headers=auth("admin-a"))
    assert created.status_code == 201, created.text
    assert (
        workspace_client.post("/api/v1/accounts", json=payload, headers=auth("admin-a")).status_code
        == 409
    )


def test_delete_is_confirmed_and_owned_and_removes_originals(workspace_client, db_session):
    programme_id = course(workspace_client)
    created = submit(workspace_client, programme_id).json()
    url = "/api/v1/applications/" + created["id"]
    assert (
        workspace_client.request(
            "DELETE", url, json={"confirmed": False}, headers=auth()
        ).status_code
        == 422
    )
    assert (
        workspace_client.request(
            "DELETE", url, json={"confirmed": True}, headers=auth("tutor-b")
        ).status_code
        == 404
    )
    assert (
        workspace_client.request(
            "DELETE", url, json={"confirmed": True}, headers=auth()
        ).status_code
        == 200
    )
    assert db_session.scalar(select(func.count()).select_from(Document)) == 0
