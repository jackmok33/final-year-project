import pytest
from alembic.config import Config
from sqlalchemy import text

from alembic import command
from app.db import BACKEND_DIR, create_db_engine, get_database_url, session_factory
from app.models import Application, Document
from app.seed import seed_demo
from tests.database_safety import require_test_database


@pytest.fixture(scope="session")
def migration_config():
    try:
        url = require_test_database(get_database_url("TEST_DATABASE_URL"), get_database_url())
    except ValueError as error:
        raise pytest.UsageError(str(error)) from error
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.attributes["database_url"] = url
    return config


@pytest.fixture(scope="session")
def db_engine(migration_config):
    engine = create_db_engine(migration_config.attributes["database_url"])
    # Do not silently skip an explicitly requested but unavailable/misconfigured database.
    with engine.connect() as connection:
        actual_database = connection.scalar(text("SELECT current_database()"))
        assert actual_database == migration_config.attributes["database_url"].database
    command.upgrade(migration_config, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    def clear():
        with db_engine.begin() as connection:
            connection.execute(
                text("TRUNCATE documents, applications, programme_memberships, programmes, users")
            )

    clear()
    try:
        with session_factory(db_engine)() as session:
            yield session
    finally:
        clear()


@pytest.fixture
def sample_application(db_session):
    assert seed_demo(db_session)
    application = Application(
        id="APP-TEST-1",
        programme_id="programme-1",
        candidate_reference="Candidate A",
        created_by="tutor-a",
    )
    db_session.add(application)
    db_session.flush()
    return application


@pytest.fixture
def document_values(sample_application):
    import hashlib

    contents = b"%PDF-1.7\n%\xff\x00\x80 binary storage fixture\n%%EOF\n"
    return {
        "application_id": sample_application.id,
        "document_type": "transcript",
        "filename": "transcript.pdf",
        "size_bytes": len(contents),
        "page_count": 1,
        "sha256": hashlib.sha256(contents).hexdigest(),
        "pdf_bytes": contents,
    }


@pytest.fixture
def saved_document(db_session, document_values):
    document = Document(**document_values)
    db_session.add(document)
    db_session.commit()
    return document
