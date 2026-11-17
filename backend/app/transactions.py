"""The transaction boundary used by database-backed operations."""

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.api import ApiError


@contextmanager
def transaction(sessions: sessionmaker[Session]) -> Iterator[Session]:
    try:
        with sessions.begin() as session:
            session.execute(text("SET LOCAL statement_timeout = '15s'"))
            session.execute(text("SET LOCAL lock_timeout = '5s'"))
            yield session
    except IntegrityError as error:
        if getattr(getattr(error.orig, "diag", None), "constraint_name", None) == (
            "uq_documents_application_type"
        ):
            raise ApiError(
                409, "DOCUMENT_TYPE_EXISTS", "This application already has that document type."
            ) from None
        raise ApiError(
            503,
            "DOCUMENT_STORAGE_UNAVAILABLE",
            "Document storage could not complete the request.",
        ) from None
    except SQLAlchemyError:
        raise ApiError(
            503,
            "DOCUMENT_STORAGE_UNAVAILABLE",
            "Document storage could not complete the request.",
        ) from None
