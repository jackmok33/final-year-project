"""Bearer authentication and lazy PostgreSQL sessions for protected routes."""

from typing import Annotated, Any

from fastapi import Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api import ApiError

bearer = HTTPBearer(auto_error=False, scheme_name="DocumentBearer")


def authenticated_subject(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> str:
    access = getattr(request.app.state, "document_access", None)
    if access is None:
        raise ApiError(404, "DOCUMENT_API_DISABLED", "The document API is disabled.")
    subject = access.identify(credentials.credentials) if credentials is not None else None
    if subject is None:
        raise ApiError(401, "DOCUMENT_AUTH_REQUIRED", "A valid document API token is required.")
    return subject


AuthenticatedSubject = Annotated[str, Depends(authenticated_subject)]


def get_database_sessions(request: Request, subject: AuthenticatedSubject) -> Any:
    # No database URL, import or connection is needed for ordinary mock/health requests.
    from app.db import create_db_engine, session_factory

    state = request.app.state
    with state.document_database_lock:
        if state.document_sessions is None:
            try:
                engine = create_db_engine()
            except ValueError:
                raise ApiError(
                    503, "DOCUMENT_STORAGE_UNAVAILABLE", "Configure the document database."
                ) from None
            state.document_database = engine
            state.document_sessions = session_factory(engine)
    return state.document_sessions


DatabaseSessions = Annotated[Any, Depends(get_database_sessions)]


def private_response(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"
