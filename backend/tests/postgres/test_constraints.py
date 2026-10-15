from uuid import UUID

import pytest
from sqlalchemy import func, insert, select
from sqlalchemy.exc import IntegrityError

from app.models import Application, Document, Programme, ProgrammeMembership, User
from app.seed import seed_demo

pytestmark = pytest.mark.postgres


@pytest.mark.parametrize(
    "values, constraint",
    [
        ({"name": "   "}, "ck_users_name_nonblank"),
        ({"name": "\t\n"}, "ck_users_name_nonblank"),
        ({"email": ""}, "ck_users_email_normalized"),
        ({"email": " UPPER@EXAMPLE.COM "}, "ck_users_email_normalized"),
        ({"email": "Upper@example.com"}, "ck_users_email_normalized"),
        ({"email": "user@example.com "}, "ck_users_email_normalized"),
        ({"email": "\tuser@example.com"}, "ck_users_email_normalized"),
        ({"is_tutor": False}, "ck_users_has_role"),
    ],
)
def test_invalid_users_rejected(db_session, values, constraint):
    user = User(name="Example", email="user@example.com", is_tutor=True)
    for key, value in values.items():
        setattr(user, key, value)
    db_session.add(user)
    with pytest.raises(IntegrityError) as error:
        db_session.flush()
    assert error.value.orig.diag.constraint_name == constraint


def test_duplicate_email_rejected(db_session):
    seed_demo(db_session)
    db_session.add(User(name="Duplicate", email="tutor@demo.ucl.local", is_admin=True))
    with pytest.raises(IntegrityError) as error:
        db_session.flush()
    assert error.value.orig.diag.constraint_name == "uq_users_email"


def test_both_roles_defaults_timestamps_and_generated_ids(db_session):
    first = User(name="Both", email="both@example.com", is_admin=True, is_tutor=True)
    second = User(name="Admin", email="admin@example.com", is_admin=True)
    db_session.add_all([first, second])
    db_session.commit()
    assert first.is_admin and first.is_tutor and first.active
    assert second.is_admin and not second.is_tutor
    assert UUID(first.id) != UUID(second.id)
    assert first.created_at.utcoffset() is not None
    programme = Programme(name="Same name", code="NEW", year="2026 / 27")
    db_session.add(programme)
    db_session.flush()
    assert programme.department == programme.description == ""
    assert programme.created_by is None
    assert UUID(programme.id)


@pytest.mark.parametrize(
    "values, constraint",
    [
        ({"name": " "}, "ck_programmes_name_trimmed"),
        ({"name": " Example "}, "ck_programmes_name_trimmed"),
        ({"name": "\tExample\n"}, "ck_programmes_name_trimmed"),
        ({"code": " "}, "ck_programmes_code_trimmed"),
        ({"code": " NEW "}, "ck_programmes_code_trimmed"),
        ({"year": " "}, "ck_programmes_year_nonblank"),
        ({"code": "pg-tbc"}, "uq_programmes_code_lower"),
    ],
)
def test_programme_constraints(db_session, values, constraint):
    seed_demo(db_session)
    db_session.add(Programme(**({"name": "Example", "code": "NEW", "year": "2026"} | values)))
    with pytest.raises(IntegrityError) as error:
        db_session.flush()
    assert error.value.orig.diag.constraint_name == constraint


def test_workspace_names_and_candidate_references_need_not_be_unique(db_session):
    seed_demo(db_session)
    for owner, code in (("tutor-a", "A"), ("tutor-b", "B")):
        programme = Programme(name="My course", code=code, year="2026", created_by=owner)
        db_session.add(programme)
        db_session.flush()
        # Ownership does not automatically create a membership.
        assert programme.memberships == []
        db_session.add(
            Application(programme=programme, candidate_reference="Same candidate", created_by=owner)
        )
    db_session.flush()
    assert db_session.scalar(select(func.count()).select_from(Application)) == 2


def test_duplicate_membership_rejected(db_session):
    seed_demo(db_session)
    db_session.add(ProgrammeMembership(user_id="tutor-a", programme_id="programme-1"))
    with pytest.raises(IntegrityError) as error:
        db_session.flush()
    assert error.value.orig.diag.constraint_name == "pk_programme_memberships"


@pytest.mark.parametrize(
    "model, values, constraint",
    [
        (
            Programme,
            {"name": "New", "code": "NEW", "year": "2026", "created_by": "missing"},
            "fk_programmes_created_by_users",
        ),
        (
            ProgrammeMembership,
            {"user_id": "missing", "programme_id": "programme-1"},
            "fk_programme_memberships_user_id_users",
        ),
        (
            ProgrammeMembership,
            {"user_id": "tutor-a", "programme_id": "missing"},
            "fk_programme_memberships_programme_id_programmes",
        ),
        (
            Application,
            {"programme_id": "missing", "created_by": "tutor-a", "candidate_reference": "A"},
            "fk_applications_programme_id_programmes",
        ),
        (
            Application,
            {"programme_id": "programme-1", "created_by": "missing", "candidate_reference": "A"},
            "fk_applications_created_by_users",
        ),
    ],
)
def test_invalid_foreign_keys_rejected(db_session, model, values, constraint):
    seed_demo(db_session)
    db_session.add(model(**values))
    with pytest.raises(IntegrityError) as error:
        db_session.flush()
    assert error.value.orig.diag.constraint_name == constraint


def test_blank_candidate_reference_rejected(db_session):
    seed_demo(db_session)
    db_session.add(
        Application(programme_id="programme-1", created_by="tutor-a", candidate_reference=" ")
    )
    with pytest.raises(IntegrityError) as error:
        db_session.flush()
    assert error.value.orig.diag.constraint_name == "ck_applications_candidate_reference_nonblank"


@pytest.mark.parametrize(
    "values, constraint",
    [
        ({"document_type": "other"}, "ck_documents_type_allowed"),
        ({"document_type": "CV"}, "ck_documents_type_allowed"),
        ({"filename": " "}, "ck_documents_filename_nonblank"),
        ({"content_type": "text/plain"}, "ck_documents_content_type_pdf"),
        ({"size_bytes": 0, "pdf_bytes": b""}, "ck_documents_size_range"),
        ({"size_bytes": -1}, "ck_documents_size_range"),
        ({"size_bytes": 20971521}, "ck_documents_size_range"),
        ({"page_count": 0}, "ck_documents_page_range"),
        ({"page_count": 101}, "ck_documents_page_range"),
        ({"sha256": "a" * 63}, "ck_documents_hash_format"),
        ({"sha256": "A" * 64}, "ck_documents_hash_format"),
        ({"sha256": "g" * 64}, "ck_documents_hash_format"),
        ({"sha256": "a" * 63 + "\n"}, "ck_documents_hash_format"),
        ({"pdf_bytes": b"different length"}, "ck_documents_byte_length"),
        ({"application_id": "missing"}, "fk_documents_application_id_applications"),
    ],
)
def test_document_constraints(db_session, document_values, values, constraint):
    # Check constraints may be checked alphabetically: preserve matching byte length for size tests.
    if "size_bytes" in values and values["size_bytes"] > 0:
        values = values | {"pdf_bytes": b"x" * values["size_bytes"]}
    if values.get("size_bytes") == -1:
        # A negative length is impossible; PostgreSQL may reject the byte-length check first.
        constraint = "ck_documents_byte_length"
    db_session.add(Document(**(document_values | values)))
    with pytest.raises(IntegrityError) as error:
        db_session.flush()
    assert error.value.orig.diag.constraint_name == constraint


def test_pdf_binary_round_trip_defaults_and_per_type_uniqueness(db_session, saved_document):
    document_id = saved_document.id
    expected = saved_document.pdf_bytes
    db_session.expunge_all()
    document = db_session.get(Document, document_id)
    assert document.pdf_bytes == expected
    assert document.content_type == "application/pdf"
    assert document.uploaded_at.utcoffset() is not None
    assert UUID(document.id)
    values = {
        key: getattr(document, key)
        for key in (
            "application_id",
            "document_type",
            "filename",
            "size_bytes",
            "page_count",
            "sha256",
            "pdf_bytes",
        )
    }
    db_session.execute(
        insert(Document).values(**(values | {"document_type": "cv", "page_count": 100}))
    )
    db_session.execute(insert(Document).values(**(values | {"document_type": "statement"})))
    db_session.commit()
    # Combined page limits and hash verification belong to the future upload service.
    with pytest.raises(IntegrityError) as error:
        db_session.execute(insert(Document).values(**values))
    assert error.value.orig.diag.constraint_name == "uq_documents_application_type"


def test_20_mib_document_boundary_and_duplicate_hash_allowed(db_session, document_values):
    contents = b"x" * (20 * 1024 * 1024)
    db_session.add(
        Document(
            **(
                document_values
                | {"pdf_bytes": contents, "size_bytes": len(contents), "page_count": 100}
            )
        )
    )
    other_application = Application(
        programme_id="programme-1", candidate_reference="B", created_by="tutor-a"
    )
    db_session.add(other_application)
    db_session.flush()
    db_session.add(Document(**(document_values | {"application_id": other_application.id})))
    db_session.commit()
    assert db_session.scalar(select(func.count()).select_from(Document)) == 2
