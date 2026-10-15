"""Fail closed before any destructive PostgreSQL test operation."""

import re

from sqlalchemy.engine import URL

from app.db import validate_database_url


def require_test_database(test_value: str | URL, development_value: str | URL) -> URL:
    test_url = validate_database_url(test_value)
    development_url = validate_database_url(development_value)
    # Compare names even across different hosts: localhost aliases must not evade this guard.
    if test_url.database == development_url.database:
        raise ValueError("Refusing destructive tests against the development database.")
    if not re.fullmatch(r"[a-z][a-z0-9_]*_test", test_url.database or ""):
        raise ValueError("The dedicated test database name must end in _test.")
    return test_url
