import subprocess
import sys

import pytest

from app import db
from tests.database_safety import require_test_database

DEV_URL = "postgresql+psycopg://example:placeholder@localhost/app"
TEST_URL = "postgresql+psycopg://example:placeholder@127.0.0.1/app_test"


@pytest.mark.parametrize("value", ["", "sqlite://", "postgresql://host/db", "not a URL"])
def test_rejects_unsupported_database_urls(value):
    with pytest.raises(ValueError):
        db.validate_database_url(value)


def test_env_file_is_optional_and_environment_takes_precedence(monkeypatch, tmp_path):
    monkeypatch.setattr(db, "BACKEND_DIR", tmp_path)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValueError, match="DATABASE_URL is required"):
        db.get_database_url()
    (tmp_path / ".env").write_text(f"DATABASE_URL={DEV_URL}\n")
    assert db.get_database_url().database == "app"
    monkeypatch.setenv("DATABASE_URL", TEST_URL)
    assert db.get_database_url().database == "app_test"


def test_test_guard_accepts_only_a_distinct_named_test_database():
    assert require_test_database(TEST_URL, DEV_URL).database == "app_test"


@pytest.mark.parametrize("database", ["app", "postgres", "template1", "production", "test", ""])
def test_test_guard_refuses_non_test_databases(database):
    with pytest.raises(ValueError):
        require_test_database(f"postgresql+psycopg://localhost/{database}", DEV_URL)


def test_test_guard_refuses_development_database_even_when_named_test():
    with pytest.raises(ValueError, match="development database"):
        require_test_database(TEST_URL, TEST_URL.replace("127.0.0.1", "localhost"))


def test_mock_app_does_not_import_or_connect_database():
    # Fresh interpreter catches accidental DB wiring even if other tests imported app.db.
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys; from app.main import create_app; create_app(); "
            "assert 'app.db' not in sys.modules; assert 'sqlalchemy' not in sys.modules",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
