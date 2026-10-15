"""Database tools, loaded only by explicit database commands (not FastAPI startup)."""

import os
from pathlib import Path
from uuid import uuid4

from dotenv import dotenv_values
from sqlalchemy import MetaData, create_engine
from sqlalchemy.engine import URL, Engine, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


def new_id() -> str:
    return str(uuid4())


def validate_database_url(value: str | URL) -> URL:
    try:
        url = make_url(value)
    except Exception as error:
        raise ValueError("Invalid database URL; use postgresql+psycopg://...") from error
    if url.drivername != "postgresql+psycopg" or not url.database:
        raise ValueError("A named PostgreSQL database with the psycopg driver is required.")
    return url


def get_database_url(name: str = "DATABASE_URL") -> URL:
    # Read a known file without changing process environment or requiring the caller's cwd.
    value = os.environ.get(name)
    if value is None:
        value = dotenv_values(BACKEND_DIR / ".env").get(name)
    if not value:
        raise ValueError(f"{name} is required. Configure backend/.env or the environment.")
    return validate_database_url(value)


def create_db_engine(url: str | URL | None = None) -> Engine:
    return create_engine(
        validate_database_url(url) if url is not None else get_database_url(),
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5},
        hide_parameters=True,
    )


def session_factory(engine: Engine) -> sessionmaker[Session]:
    """Callers own session/transaction lifetime with `with factory.begin() as session`."""
    return sessionmaker(engine, expire_on_commit=False)
