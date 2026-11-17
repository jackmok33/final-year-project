import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import DBAPIError

from alembic import command
from app.models import Document

pytestmark = pytest.mark.postgres
INITIAL_REVISION = "20261015_0001"
DOCUMENT_REVISION = "20261117_0003"


def document_rows(engine):
    with engine.connect() as connection:
        return connection.execute(
            text(
                "SELECT id, application_id, document_type, filename, content_type, "
                "size_bytes, page_count, sha256, pdf_bytes, uploaded_at FROM documents ORDER BY id"
            )
        ).all()


def current_revision(engine):
    with engine.connect() as connection:
        return connection.scalar(text("SELECT version_num FROM alembic_version"))


def test_legacy_pdf_rows_survive_downgrade_and_upgrade(
    db_engine, db_session, document_values, migration_config
):
    for document_type in ("transcript", "cv", "statement"):
        db_session.add(Document(**(document_values | {"document_type": document_type})))
    db_session.commit()
    original_rows = document_rows(db_engine)
    try:
        command.downgrade(migration_config, INITIAL_REVISION)
        assert current_revision(db_engine) == INITIAL_REVISION
        assert document_rows(db_engine) == original_rows
        constraints = inspect(db_engine).get_unique_constraints("documents")
        assert any(
            item["name"] == "uq_documents_application_type"
            and item["column_names"] == ["application_id", "document_type"]
            for item in constraints
        )
    finally:
        command.upgrade(migration_config, "head")
    assert current_revision(db_engine) == DOCUMENT_REVISION
    assert document_rows(db_engine) == original_rows
    command.check(migration_config)


@pytest.mark.parametrize("document_type", ["application_form", "english_test", "reference"])
def test_downgrade_refuses_new_categories_without_losing_rows_or_schema(
    db_engine, db_session, document_values, migration_config, document_type
):
    db_session.add(Document(**document_values))
    for _ in range(2 if document_type == "reference" else 1):
        db_session.add(Document(**(document_values | {"document_type": document_type})))
    db_session.commit()
    original_rows = document_rows(db_engine)
    with pytest.raises(DBAPIError, match="Cannot downgrade document schema"):
        command.downgrade(migration_config, INITIAL_REVISION)
    assert current_revision(db_engine) == DOCUMENT_REVISION
    assert document_rows(db_engine) == original_rows
    command.check(migration_config)
