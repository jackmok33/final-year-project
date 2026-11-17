"""Transactional document operations; callers supply a server-authenticated subject."""

from contextlib import contextmanager

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import defer

from app.document_errors import DocumentError
from app.document_limits import MAX_APPLICATION_PAGES
from app.models import Application, Document, Programme, User
from app.schemas import StoredDocument, StoredDocumentType
from app.services.pdf_validation import ValidatedPdf


class DocumentService:
    def __init__(self, sessions):
        self._sessions = sessions

    @contextmanager
    def _transaction(self):
        try:
            with self._sessions.begin() as session:
                session.execute(text("SET LOCAL statement_timeout = '15s'"))
                session.execute(text("SET LOCAL lock_timeout = '5s'"))
                yield session
        except IntegrityError as error:
            if getattr(getattr(error.orig, "diag", None), "constraint_name", None) == (
                "uq_documents_application_type"
            ):
                raise DocumentError(
                    409, "DOCUMENT_TYPE_EXISTS", "This application already has that document type."
                ) from None
            raise DocumentError(
                503,
                "DOCUMENT_STORAGE_UNAVAILABLE",
                "Document storage could not complete the request.",
            ) from None
        except SQLAlchemyError:
            raise DocumentError(
                503,
                "DOCUMENT_STORAGE_UNAVAILABLE",
                "Document storage could not complete the request.",
            ) from None

    @staticmethod
    def _require_tutor(session, user_id: str):
        # Share locks keep deactivation/role changes from racing a permitted operation.
        user = session.get(User, user_id, with_for_update={"read": True})
        if user is None or not user.active or not user.is_tutor:
            raise DocumentError(
                403, "DOCUMENT_ACCESS_DENIED", "An active tutor account is required."
            )

    @staticmethod
    def _owned_application(session, user_id: str, application_id: str, *, write=False):
        application = session.scalar(
            select(Application)
            .join(Programme, Programme.id == Application.programme_id)
            .where(Application.id == application_id, Programme.created_by == user_id)
            .with_for_update(read=True, of=Programme if write else [Programme, Application])
        )
        if application is None:
            # Missing and inaccessible objects have the same response.
            raise DocumentError(404, "APPLICATION_NOT_FOUND", "Application not found.")
        if write:
            application = session.scalar(
                select(Application)
                .where(
                    Application.id == application_id,
                    Application.programme_id == application.programme_id,
                )
                .with_for_update()
            )
            if application is None:
                raise DocumentError(404, "APPLICATION_NOT_FOUND", "Application not found.")
        return application

    def check_access(self, user_id: str, application_id: str) -> None:
        with self._transaction() as session:
            self._require_tutor(session, user_id)
            self._owned_application(session, user_id, application_id)

    def upload(
        self,
        user_id: str,
        application_id: str,
        document_type: StoredDocumentType,
        filename: str,
        pdf: ValidatedPdf,
    ) -> StoredDocument:
        with self._transaction() as session:
            self._require_tutor(session, user_id)
            self._owned_application(session, user_id, application_id, write=True)
            # Every upload locks the application first, including concurrent references.
            pages = session.scalar(
                select(func.coalesce(func.sum(Document.page_count), 0)).where(
                    Document.application_id == application_id
                )
            )
            if pages + pdf.page_count > MAX_APPLICATION_PAGES:
                raise DocumentError(
                    422,
                    "APPLICATION_PAGE_LIMIT",
                    "An application cannot contain more than 100 pages.",
                )
            document = Document(
                application_id=application_id,
                document_type=document_type,
                filename=filename,
                content_type="application/pdf",
                size_bytes=len(pdf.contents),
                page_count=pdf.page_count,
                position=session.scalar(
                    select(func.coalesce(func.max(Document.position), -1)).where(
                        Document.application_id == application_id
                    )
                )
                + 1,
                sha256=pdf.sha256,
                pdf_bytes=pdf.contents,
            )
            session.add(document)
            session.flush()
            result = StoredDocument.model_validate(document, from_attributes=True)
        # Commit must succeed before returning a successful upload result.
        return result

    def list_documents(self, user_id: str, application_id: str) -> list[StoredDocument]:
        with self._transaction() as session:
            self._require_tutor(session, user_id)
            self._owned_application(session, user_id, application_id)
            documents = session.scalars(
                select(Document)
                .options(defer(Document.pdf_bytes))
                .where(Document.application_id == application_id)
                .order_by(Document.position, Document.uploaded_at, Document.id)
            )
            return [StoredDocument.model_validate(item, from_attributes=True) for item in documents]

    def download(self, user_id: str, document_id: str) -> tuple[StoredDocument, bytes]:
        with self._transaction() as session:
            self._require_tutor(session, user_id)
            application_id = session.scalar(
                select(Document.application_id).where(Document.id == document_id)
            )
            if application_id is None:
                raise DocumentError(404, "DOCUMENT_NOT_FOUND", "Document not found.")
            try:
                self._owned_application(session, user_id, application_id)
            except DocumentError as error:
                if error.status_code == 404:
                    raise DocumentError(404, "DOCUMENT_NOT_FOUND", "Document not found.") from None
                raise
            document = session.scalar(
                select(Document)
                .options(defer(Document.pdf_bytes))
                .where(Document.id == document_id, Document.application_id == application_id)
                .with_for_update(read=True)
            )
            if document is None:
                raise DocumentError(404, "DOCUMENT_NOT_FOUND", "Document not found.")
            result = StoredDocument.model_validate(document, from_attributes=True)
            contents = document.pdf_bytes  # Read original bytes only after permission checks.
            return result, contents
