"""CLI-only browser-test setup. Always refuses the development database."""

import argparse
import os

from alembic.config import Config
from sqlalchemy import text

from alembic import command
from app.db import BACKEND_DIR, create_db_engine, get_database_url
from app.import_browser import import_browser_backup
from tests.database_safety import require_test_database


def prepare(backup):
    target = require_test_database(get_database_url("TEST_DATABASE_URL"), get_database_url())
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.attributes["database_url"] = target
    command.upgrade(config, "head")
    engine = create_db_engine(target)
    try:
        with engine.begin() as connection:
            assert connection.scalar(text("SELECT current_database()")) == target.database
            connection.execute(
                text(
                    "TRUNCATE documents, applications, upload_batches, rubrics, "
                    "programme_memberships, programmes, users, audit_events"
                )
            )
        return import_browser_backup(backup, engine)
    finally:
        engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backup", required=True)
    parser.add_argument("--serve", action="store_true")
    args = parser.parse_args()
    prepare(args.backup)
    if args.serve:
        import sys

        env = os.environ.copy()
        env["DATABASE_URL"] = get_database_url("TEST_DATABASE_URL").render_as_string(
            hide_password=False
        )
        for name in (
            "QWEN_BASE_URL",
            "QWEN_API_KEY",
            "QWEN_API_KEY_FILE",
            "OPENAI_API_KEY",
            "OPENAI_API_KEY_FILE",
        ):
            env[name] = ""
        env["INFERENCE_PROVIDER"] = "qwen"
        env["INFERENCE_PROBE_ENABLED"] = "false"
        os.execve(
            sys.executable,
            [
                sys.executable,
                "-B",
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8001",
            ],
            env,
        )
