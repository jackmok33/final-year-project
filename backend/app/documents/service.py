"""Transactional document operations; callers supply a server-authenticated subject."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session, defer, sessionmaker

from app.api import ApiError
from app.auth.permissions import owned_application
from app.documents.limits import MAX_APPLICATION_PAGES
from app.documents.pdf_validation import ValidatedPdf
from app.documents.schemas import StoredDocument, StoredDocumentType
from app.models import Document, User
from app.transactions import transaction


class DocumentService:
    def __init__(self, sessions: sessionmaker[Session]):
        self._sessions = sessions

    @staticmethod
    def _require_tutor(session: Session, user_id: str) -> None:
        # Share locks keep deactivation/role changes from racing a permitted operation.
        user = session.get(User, user_id, with_for_update={"read": True})
        if user is None or not user.active or not user.is_tutor:
            raise ApiError(403, "DOCUMENT_ACCESS_DENIED", "An active tutor account is required.")

    def check_access(self, user_id: str, application_id: str) -> None:
        with transaction(self._sessions) as session:
            self._require_tutor(session, user_id)
            owned_application(session, user_id, application_id)

    def upload(
        self,
        user_id: str,
        application_id: str,
        document_type: StoredDocumentType,
        filename: str,
        pdf: ValidatedPdf,
    ) -> StoredDocument:
        with transaction(self._sessions) as session:
            self._require_tutor(session, user_id)
            owned_application(session, user_id, application_id, write=True)
            # Every upload locks the application first, including concurrent references.
            pages = session.scalar(
                select(func.coalesce(func.sum(Document.page_count), 0)).where(
                    Document.application_id == application_id
                )
            )
            if pages + pdf.page_count > MAX_APPLICATION_PAGES:
                raise ApiError(
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
        with transaction(self._sessions) as session:
            self._require_tutor(session, user_id)
            owned_application(session, user_id, application_id)
            documents = session.scalars(
                select(Document)
                .options(defer(Document.pdf_bytes))
                .where(Document.application_id == application_id)
                .order_by(Document.position, Document.uploaded_at, Document.id)
            )
            return [StoredDocument.model_validate(item, from_attributes=True) for item in documents]

    def download(self, user_id: str, document_id: str) -> tuple[StoredDocument, bytes]:
        with transaction(self._sessions) as session:
            self._require_tutor(session, user_id)
            application_id = session.scalar(
                select(Document.application_id).where(Document.id == document_id)
            )
            if application_id is None:
                raise ApiError(404, "DOCUMENT_NOT_FOUND", "Document not found.")
            try:
                owned_application(session, user_id, application_id)
            except ApiError as error:
                if error.status_code == 404:
                    raise ApiError(404, "DOCUMENT_NOT_FOUND", "Document not found.") from None
                raise
            document = session.scalar(
                select(Document)
                .options(defer(Document.pdf_bytes))
                .where(Document.id == document_id, Document.application_id == application_id)
                .with_for_update(read=True)
            )
            if document is None:
                raise ApiError(404, "DOCUMENT_NOT_FOUND", "Document not found.")
            result = StoredDocument.model_validate(document, from_attributes=True)
            contents = document.pdf_bytes  # Read original bytes only after permission checks.
            return result, contents
