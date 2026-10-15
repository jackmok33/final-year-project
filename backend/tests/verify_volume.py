"""Recreate the Compose container and verify persistence using temporary test DB rows.

Run from backend/: python -m tests.verify_volume
Do not run concurrently with the PostgreSQL test suite.
"""

import hashlib
import json
import subprocess
from uuid import uuid4

from sqlalchemy import delete, func, select

from app.db import BACKEND_DIR, create_db_engine, get_database_url, session_factory
from app.models import Application, Document, Programme, ProgrammeMembership, User
from tests.database_safety import require_test_database


def docker(*arguments: str) -> str:
    return subprocess.check_output(
        ["docker", *arguments], cwd=BACKEND_DIR, text=True, timeout=60
    ).strip()


def main() -> None:
    development_url = get_database_url()
    test_url = require_test_database(get_database_url("TEST_DATABASE_URL"), development_url)
    if test_url.host not in {"localhost", "127.0.0.1"}:
        raise ValueError("Volume verification requires the local Compose PostgreSQL database.")
    test_engine = create_db_engine(test_url)
    development_engine = create_db_engine(development_url)
    factory = session_factory(test_engine)
    user_id = programme_id = None
    contents = b"%PDF-1.7\n%\x00\xff volume persistence fixture\n%%EOF\n"
    token = uuid4().hex

    def development_counts():
        with session_factory(development_engine)() as session:
            return [
                session.scalar(select(func.count()).select_from(model))
                for model in (User, Programme, ProgrammeMembership, Application, Document)
            ]

    try:
        before = docker("compose", "ps", "-q", "postgres")
        if not before:
            raise RuntimeError("Start PostgreSQL with docker compose up -d --wait first.")
        published_port = int(docker("compose", "port", "postgres", "5432").rsplit(":", 1)[1])
        if any(
            url.host not in {"localhost", "127.0.0.1"} or (url.port or 5432) != published_port
            for url in (test_url, development_url)
        ):
            raise ValueError(
                "Both URLs must point to this Compose container's published local port."
            )
        mounts = json.loads(docker("inspect", before, "--format", "{{json .Mounts}}"))
        assert any(
            mount["Type"] == "volume" and mount["Destination"] == "/var/lib/postgresql"
            for mount in mounts
        )
        original_counts = development_counts()
        with factory.begin() as session:
            user = User(name="Volume test", email=f"volume-{token}@demo.ucl.local", is_tutor=True)
            programme = Programme(name="Volume test", code=f"VOLUME-{token}", year="2026 / 27")
            session.add_all([user, programme])
            session.flush()
            user_id, programme_id = user.id, programme.id
            application = Application(
                programme_id=programme.id, created_by=user.id, candidate_reference="Volume fixture"
            )
            session.add(application)
            session.flush()
            document = Document(
                application_id=application.id,
                document_type="cv",
                filename="volume-test.pdf",
                size_bytes=len(contents),
                page_count=1,
                sha256=hashlib.sha256(contents).hexdigest(),
                pdf_bytes=contents,
            )
            session.add(document)
            session.flush()
            document_id = document.id
        test_engine.dispose()
        development_engine.dispose()
        docker("compose", "up", "-d", "--force-recreate", "--wait", "postgres")
        after = docker("compose", "ps", "-q", "postgres")
        assert after and before != after, "Container was not recreated"
        with factory() as session:
            document = session.get(Document, document_id)
            assert document is not None and document.pdf_bytes == contents
        assert development_counts() == original_counts
        print("Container changed; original PDF bytes and development row counts survived.")
    finally:
        # Remove only this command's test rows; never truncate or edit development data.
        try:
            if programme_id and user_id:
                with factory.begin() as session:
                    session.execute(delete(Programme).where(Programme.id == programme_id))
                    session.execute(delete(User).where(User.id == user_id))
        finally:
            test_engine.dispose()
            development_engine.dispose()


if __name__ == "__main__":
    main()
