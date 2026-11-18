"""Create applicant records, intake batches and original document rows atomically."""

import re

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.api import ApiError
from app.audit import record_audit
from app.auth.permissions import active_account, owned_application, owned_programme
from app.documents.limits import MAX_APPLICATION_PAGES
from app.documents.pdf_validation import ValidatedPdf
from app.models import Application, Document, UploadBatch
from app.transactions import transaction
from app.workspace.schemas import ApplicationManifest, BatchManifest


def _normal_intake(value: str) -> str:
    value = value.strip()
    if not value or len(value) > 200:
        raise ApiError(422, "INTAKE_INVALID", "Enter a valid intake year.")
    match = re.fullmatch(r"(\d{2}|\d{4})\s*/\s*(\d{2}|\d{4})", value)
    if match:
        start = int(match[1]) + (2000 if len(match[1]) == 2 else 0)
        end = int(match[2])
        if (
            not 1900 <= start <= 9998
            or end % 100 != (start + 1) % 100
            or (len(match[2]) == 4 and end != start + 1)
        ):
            raise ApiError(422, "INTAKE_INVALID", "Enter a valid intake year.")
        return f"{start} / {(start + 1) % 100:02d}"
    return value


def create_applications(
    sessions: sessionmaker[Session],
    subject: str,
    programme_id: str,
    manifest: ApplicationManifest | BatchManifest,
    files: list[tuple[str, ValidatedPdf]],
) -> dict:
    batch = isinstance(manifest, BatchManifest)
    intake = _normal_intake(manifest.intake_year)
    applicants = manifest.applications if batch else [manifest]
    with transaction(sessions) as session:
        actor = active_account(session, subject, tutor=True)
        programme = owned_programme(session, actor, programme_id, write=True)
        if batch:
            target = UploadBatch(
                programme_id=programme.id,
                intake_year=intake,
                filename=manifest.filename,
                source="zip",
                uploaded_by=actor.id,
            )
            session.add(target)
            session.flush()
        elif manifest.batch_id:
            target = session.scalar(
                select(UploadBatch).where(
                    UploadBatch.id == manifest.batch_id,
                    UploadBatch.programme_id == programme.id,
                    UploadBatch.intake_year == intake,
                )
            )
            if target is None:
                raise ApiError(
                    404, "BATCH_NOT_FOUND", "Select a batch in the same programme and intake."
                )
        else:
            target = session.scalar(
                select(UploadBatch).where(
                    UploadBatch.programme_id == programme.id,
                    UploadBatch.intake_year == intake,
                    UploadBatch.source == "existing",
                )
            )
            if target is None:
                target = UploadBatch(
                    programme_id=programme.id,
                    intake_year=intake,
                    filename="",
                    source="existing",
                    uploaded_by=actor.id,
                )
                session.add(target)
                session.flush()
        first_id = None
        for item in applicants:
            name = item.candidate.strip()
            if not name:
                raise ApiError(422, "CANDIDATE_REQUIRED", "Enter an applicant identifier.")
            app = Application(
                programme_id=programme.id,
                candidate_reference=name,
                intake_year=intake,
                batch_id=target.id,
                created_by=actor.id,
            )
            session.add(app)
            session.flush()
            first_id = first_id or app.id
            singleton, pages = set(), 0
            for position, part in enumerate(item.documents):
                filename, pdf = files[part.file_index]
                if part.type != "reference" and part.type in singleton:
                    raise ApiError(422, "DUPLICATE_DOCUMENT", "Upload one document per type.")
                singleton.add(part.type)
                pages += pdf.page_count
                if pages > MAX_APPLICATION_PAGES:
                    raise ApiError(
                        422,
                        "APPLICATION_PAGE_LIMIT",
                        "An application cannot contain more than 100 pages.",
                    )
                session.add(
                    Document(
                        application_id=app.id,
                        document_type=part.type,
                        filename=filename,
                        content_type="application/pdf",
                        size_bytes=len(pdf.contents),
                        page_count=pdf.page_count,
                        position=position,
                        sha256=pdf.sha256,
                        pdf_bytes=pdf.contents,
                    )
                )
            record_audit(session, actor, "Create application", app.id)
        result = {"id": target.id if batch else first_id, "batchId": target.id}
    return result


def delete_application(sessions: sessionmaker[Session], subject: str, application_id: str) -> dict:
    with transaction(sessions) as session:
        actor = active_account(session, subject, tutor=True)
        app = owned_application(session, actor.id, application_id, write=True)
        session.delete(app)
        record_audit(session, actor, "Delete application and documents", application_id)
    return {}
