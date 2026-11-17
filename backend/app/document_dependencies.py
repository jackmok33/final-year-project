"""Document authentication and lazy DB resources; imports no SQLAlchemy at startup."""

from typing import Annotated, Any

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.document_errors import DocumentError

bearer = HTTPBearer(auto_error=False, scheme_name="DocumentBearer")


def document_subject(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> str:
    access = getattr(request.app.state, "document_access", None)
    if access is None:
        raise DocumentError(404, "DOCUMENT_API_DISABLED", "The document API is disabled.")
    subject = access.identify(credentials.credentials) if credentials is not None else None
    if subject is None:
        raise DocumentError(
            401, "DOCUMENT_AUTH_REQUIRED", "A valid document API token is required."
        )
    return subject


def document_service(request: Request, subject: Annotated[str, Depends(document_subject)]) -> Any:
    # No database URL, import or connection is needed for ordinary mock/health requests.
    from app.db import create_db_engine, session_factory
    from app.services.documents import DocumentService

    state = request.app.state
    with state.document_database_lock:
        if state.document_sessions is None:
            try:
                engine = create_db_engine()
            except ValueError:
                raise DocumentError(
                    503, "DOCUMENT_STORAGE_UNAVAILABLE", "Configure the document database."
                ) from None
            state.document_database = engine
            state.document_sessions = session_factory(engine)
    return DocumentService(state.document_sessions)
