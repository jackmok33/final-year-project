import hashlib
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from urllib.parse import unquote

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, event, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.main import create_app
from app.models import Document, Programme, ProgrammeMembership, User
from tests.document_fixtures import UPLOAD_PATH, auth, enable_documents, make_pdf, upload

pytestmark = pytest.mark.postgres


@pytest.fixture
def document_client(db_engine, db_session, sample_application, monkeypatch, tmp_path):
    db_session.get(Programme, sample_application.programme_id).created_by = "tutor-a"
    db_session.commit()
    enable_documents(monkeypatch, tmp_path)
    monkeypatch.setenv("DATABASE_URL", db_engine.url.render_as_string(hide_password=False))
    app = create_app()
    with TestClient(app) as client:
        yield client
    assert app.state.document_database is None
    assert app.state.document_sessions is None


@pytest.mark.parametrize(
    "kind", ["transcript", "cv", "statement", "application_form", "english_test", "reference"]
)
def test_real_upload_list_download_preserves_original_and_metadata(
    document_client, db_session, kind
):
    data = make_pdf(2)
    filename = "學歷 résumé.PDF"
    response = upload(document_client, data, kind=kind, filename=filename)
    assert response.status_code == 201, response.text
    meta = response.json()
    assert meta == {
        "id": meta["id"],
        "applicationId": "APP-TEST-1",
        "documentType": kind,
        "filename": filename,
        "contentType": "application/pdf",
        "sizeBytes": len(data),
        "pageCount": 2,
        "sha256": hashlib.sha256(data).hexdigest(),
        "uploadedAt": meta["uploadedAt"],
    }
    stored = db_session.get(Document, meta["id"])
    assert stored.pdf_bytes == data
    assert stored.sha256 == meta["sha256"]
    listing = document_client.get(UPLOAD_PATH, headers=auth())
    assert listing.json() == [meta]
    downloaded = document_client.get(response.headers["Location"], headers=auth())
    assert downloaded.status_code == 200
    assert downloaded.content == data
    assert downloaded.headers["content-type"] == "application/pdf"
    assert downloaded.headers["cache-control"] == "private, no-store"
    assert downloaded.headers["x-content-type-options"] == "nosniff"
    assert unquote(downloaded.headers["content-disposition"].split("''", 1)[1]) == filename


@pytest.mark.parametrize(
    "kind", ["transcript", "cv", "statement", "application_form", "english_test"]
)
def test_duplicate_singletons_fail_atomically(document_client, db_session, kind):
    assert upload(document_client, kind=kind).status_code == 201
    duplicate = upload(document_client, kind=kind)
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"]["code"] == "DOCUMENT_TYPE_EXISTS"
    assert db_session.scalar(select(func.count()).select_from(Document)) == 1


def test_multiple_references_are_separate_original_documents(document_client):
    responses = [upload(document_client, kind="reference") for _ in range(2)]
    assert [response.status_code for response in responses] == [201, 201]
    assert responses[0].json()["id"] != responses[1].json()["id"]
    assert len(document_client.get(UPLOAD_PATH, headers=auth()).json()) == 2


@pytest.mark.parametrize(
    "user,status",
    [("tutor-b", 404), ("admin-a", 403), ("former-tutor", 403), ("missing-user", 403)],
)
def test_membership_admin_or_claimed_identity_do_not_grant_document_access(
    document_client, user, status
):
    created = upload(document_client)
    assert created.status_code == 201
    assert document_client.get(UPLOAD_PATH, headers=auth(user)).status_code == status
    assert (
        document_client.get(created.headers["Location"], headers=auth(user)).status_code == status
    )
    assert upload(document_client, kind="reference", user=user).status_code == status


def test_account_deactivation_and_owner_changes_take_effect_on_next_request(
    document_client, db_session
):
    created = upload(document_client)
    tutor = db_session.get(User, "tutor-a")
    tutor.active = False
    db_session.commit()
    assert document_client.get(created.headers["Location"], headers=auth()).status_code == 403
    tutor.active = True
    db_session.get(Programme, "programme-1").created_by = "tutor-b"
    db_session.commit()
    assert document_client.get(created.headers["Location"], headers=auth()).status_code == 404
    assert (
        document_client.get(created.headers["Location"], headers=auth("tutor-b")).status_code == 200
    )


def test_owner_needs_no_legacy_membership_and_unowned_courses_grant_no_access(
    document_client, db_session
):
    db_session.execute(delete(ProgrammeMembership).where(ProgrammeMembership.user_id == "tutor-a"))
    db_session.commit()
    assert upload(document_client).status_code == 201
    db_session.get(Programme, "programme-1").created_by = None
    db_session.commit()
    assert document_client.get(UPLOAD_PATH, headers=auth()).status_code == 404


def test_combined_admin_tutor_role_can_access_only_its_owned_programme(document_client, db_session):
    db_session.get(User, "admin-a").is_tutor = True
    db_session.get(Programme, "programme-1").created_by = "admin-a"
    db_session.commit()
    assert upload(document_client, user="admin-a").status_code == 201


def test_permissions_are_rechecked_after_upload_validation(document_client, db_engine, monkeypatch):
    from app import document_routes
    from app.db import session_factory

    original = document_routes.validate_pdf

    def transfer_ownership(contents):
        result = original(contents)
        with session_factory(db_engine).begin() as session:
            session.get(Programme, "programme-1").created_by = "tutor-b"
        return result

    monkeypatch.setattr(document_routes, "validate_pdf", transfer_ownership)
    assert upload(document_client).status_code == 404
    assert document_client.get(UPLOAD_PATH, headers=auth("tutor-b")).json() == []


@pytest.mark.parametrize(
    "data,status",
    [
        (b"", 413),
        (b"fake", 422),
        (b"%PDF-1.7\ncorrupt", 422),
        (make_pdf(101), 422),
        (make_pdf(encrypted=True), 422),
    ],
)
def test_bad_uploads_save_no_rows(document_client, db_session, data, status):
    response = upload(document_client, data)
    assert response.status_code == status
    assert db_session.scalar(select(func.count()).select_from(Document)) == 0


def test_byte_limit_is_enforced_even_with_chunked_upload(document_client, db_session):
    data = b"x" * (1024 * 1024)
    response = document_client.post(
        UPLOAD_PATH,
        params={"documentType": "cv", "filename": "large.pdf"},
        content=iter([data] * 21),
        headers={**auth(), "Content-Type": "application/pdf"},
    )
    assert response.status_code == 413
    assert db_session.scalar(select(func.count()).select_from(Document)) == 0


@pytest.mark.parametrize(
    "kind,filename,status",
    [("other", "file.pdf", 422), ("cv", "../file.pdf", 422), ("reference", "not-a-pdf.txt", 422)],
)
def test_invalid_metadata_is_rejected(document_client, kind, filename, status):
    assert upload(document_client, kind=kind, filename=filename).status_code == status


def test_media_type_and_missing_records(document_client):
    assert (
        document_client.post(
            UPLOAD_PATH,
            params={"documentType": "cv", "filename": "file.pdf"},
            content=make_pdf(),
            headers={**auth(), "Content-Type": "text/plain"},
        ).status_code
        == 415
    )
    assert (
        document_client.get("/api/v1/applications/missing/documents", headers=auth()).status_code
        == 404
    )
    assert document_client.get("/api/v1/documents/missing", headers=auth()).status_code == 404


@pytest.mark.parametrize(
    "kind,pages,expected",
    [("reference", 50, [201, 201]), ("reference", 51, [201, 422]), ("cv", 1, [201, 409])],
)
def test_concurrent_uploads_enforce_page_and_singleton_limits(
    document_client, db_session, kind, pages, expected
):
    barrier = Barrier(2)
    data = make_pdf(pages)

    def send():
        barrier.wait(timeout=5)
        return upload(document_client, data, kind=kind).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: send(), range(2)))
    assert sorted(results) == expected
    assert db_session.scalar(select(func.sum(Document.page_count))) <= 100
    assert db_session.scalar(select(func.count()).select_from(Document)) == expected.count(201)


def test_commit_failure_rolls_back_document_and_returns_no_success(document_client, db_session):
    def record_document(session, context):
        if any(isinstance(item, Document) for item in session.new):
            session.info["document-was-added"] = True

    def fail_commit(session):
        if session.info.get("document-was-added"):
            raise SQLAlchemyError("sensitive SQL password details")

    event.listen(Session, "after_flush", record_document)
    event.listen(Session, "before_commit", fail_commit)
    try:
        response = upload(document_client)
    finally:
        event.remove(Session, "after_flush", record_document)
        event.remove(Session, "before_commit", fail_commit)
    assert response.status_code == 503
    assert "sensitive" not in response.text
    assert db_session.scalar(select(func.count()).select_from(Document)) == 0


def test_metadata_listing_and_denied_download_do_not_fetch_pdf_bytes(document_client):
    created = upload(document_client)
    statements = []
    engine = document_client.app.state.document_database

    def capture(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", capture)
    try:
        assert document_client.get(UPLOAD_PATH, headers=auth()).status_code == 200
        assert (
            document_client.get(created.headers["Location"], headers=auth("tutor-b")).status_code
            == 404
        )
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    assert all("pdf_bytes" not in statement for statement in statements)


def test_openapi_exposes_binary_request_and_bearer_security(document_client):
    schema = document_client.get("/openapi.json").json()
    path = schema["paths"]["/api/v1/applications/{application_id}/documents"]["post"]
    assert "application/pdf" in path["requestBody"]["content"]
    assert path["security"] == [{"DocumentBearer": []}]
    assert document_client.get("/api/v1/health").json()["mode"] == "mock"
