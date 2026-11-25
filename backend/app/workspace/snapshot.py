"""Read the workspace view the current account is allowed to see."""

import copy

from sqlalchemy import select, text
from sqlalchemy.orm import Session, sessionmaker

from app.assessments.english_test.config import PilotConfig
from app.assessments.english_test.jobs import latest_checks
from app.assessments.flow.jobs import project_expired
from app.auth.permissions import active_account
from app.models import Application, Document, Programme, StoredRubric, UploadBatch, User
from app.transactions import transaction


def _criteria_record(row: StoredRubric) -> dict:
    return {
        "id": row.id,
        "programmeId": row.programme_id,
        "version": row.version,
        "createdAt": row.created_at.isoformat(),
        **row.criteria,
    }


def _document_record(row) -> dict:
    return {
        "id": row.id,
        "applicationId": row.application_id,
        "type": row.document_type,
        "name": row.filename,
        "size": row.size_bytes,
        "pages": row.page_count,
        "hash": row.sha256,
    }


def _application_record(row: Application, documents: list[dict]) -> dict:
    result = {
        "id": row.id,
        "candidate": row.candidate_reference,
        "programmeId": row.programme_id,
        "intakeYear": row.intake_year,
        "submittedAt": row.submitted_at.isoformat(),
        "documentIds": [doc["id"] for doc in documents if doc["applicationId"] == row.id],
        **copy.deepcopy(row.review_state),
    }
    if row.batch_id is not None:
        result["batchId"] = row.batch_id
    if row.fixture is not None:
        result["fixture"] = row.fixture
    return result


def _account_record(user: User, programmes: list[Programme]) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "roles": (["tutor"] if user.is_tutor else []) + (["admin"] if user.is_admin else []),
        "programmeIds": [p.id for p in programmes if p.created_by == user.id]
        if user.is_tutor
        else [],
        "canPublishCriteria": user.can_publish_criteria and user.is_tutor,
        "active": user.active,
    }


def read_workspace(
    sessions: sessionmaker[Session], subject: str, english_test_pilot: PilotConfig = PilotConfig()
) -> dict:
    with transaction(sessions) as session:
        session.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"))
        actor = active_account(session, subject)
        owned = (
            session.scalars(
                select(Programme)
                .where(Programme.created_by == actor.id)
                .order_by(Programme.created_at, Programme.id)
            ).all()
            if actor.is_tutor
            else []
        )
        programme_ids = [p.id for p in owned]
        accounts = (
            session.scalars(select(User).order_by(User.created_at, User.id)).all()
            if actor.is_admin
            else [actor]
        )
        # Only administrators/the owner receive account compatibility course IDs.
        all_programmes = session.scalars(select(Programme)).all() if actor.is_admin else owned
        applications = session.scalars(
            select(Application)
            .where(Application.programme_id.in_(programme_ids))
            .order_by(Application.submitted_at, Application.id)
        ).all()
        doc_rows = session.execute(
            select(
                Document.id,
                Document.application_id,
                Document.document_type,
                Document.filename,
                Document.size_bytes,
                Document.page_count,
                Document.sha256,
            )
            .where(Document.application_id.in_([a.id for a in applications]))
            .order_by(Document.position, Document.uploaded_at, Document.id)
        ).all()
        documents = [_document_record(d) for d in doc_rows]
        english_checks = latest_checks(session, documents, english_test_pilot)
        application_records = [_application_record(row, documents) for row in applications]
        project_expired(session, application_records)
        for record in application_records:
            if record["id"] in english_checks:
                record["englishTestCheck"] = english_checks[record["id"]]
        batches = session.scalars(
            select(UploadBatch)
            .where(UploadBatch.programme_id.in_(programme_ids))
            .order_by(UploadBatch.uploaded_at, UploadBatch.id)
        ).all()
        rubrics = session.scalars(
            select(StoredRubric)
            .where(StoredRubric.programme_id.in_(programme_ids))
            .order_by(StoredRubric.created_at, StoredRubric.id)
        ).all()
        return {
            "version": 2,
            "users": [_account_record(u, all_programmes) for u in accounts],
            "programmes": [
                {
                    "id": p.id,
                    "name": p.name,
                    "code": p.code,
                    "year": p.year,
                    "department": p.department,
                    "description": p.description,
                    "createdBy": p.created_by,
                }
                for p in owned
            ],
            "applications": application_records,
            "documents": documents,
            "rubrics": [_criteria_record(r) for r in rubrics],
            "activeRubricIds": {p.id: p.active_rubric_id for p in owned if p.active_rubric_id},
            "batches": [
                {
                    "id": b.id,
                    "programmeId": b.programme_id,
                    "intakeYear": b.intake_year,
                    "filename": b.filename,
                    "source": b.source,
                    "uploadedAt": b.uploaded_at.isoformat(),
                    **({"uploadedBy": b.uploaded_by} if b.uploaded_by else {}),
                }
                for b in batches
            ],
            "audit": [],
            "modelAvailable": all(p.model_available for p in owned),
            "subject": actor.id,
        }
