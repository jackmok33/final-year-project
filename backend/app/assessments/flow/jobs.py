"""Owned, idempotent jobs and atomic assessment-run persistence."""

import copy
import hashlib
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select

from app.api import ApiError
from app.assessments.english_test.schemas import PROMPT_VERSION, RULE_VERSION
from app.assessments.flow.config import AssessmentConfig, workflow_fingerprint
from app.assessments.flow.schemas import FLOW_VERSION
from app.assessments.shared.contracts import CourseCriteria
from app.assessments.shared.documents import SourceDocument
from app.audit import record_audit
from app.auth.permissions import active_account, owned_application
from app.models import (
    Application,
    AssessmentJob,
    Document,
    EnglishTestCheck,
    Programme,
    StoredRubric,
)
from app.transactions import transaction

LEASE = timedelta(minutes=25)


def failed_run(run: dict, reason: str) -> dict:
    return {
        **run,
        "status": "failed",
        "finishAt": datetime.now(UTC).isoformat(),
        "overall": None,
        "sections": [],
        "error": reason,
        "justification": {"summary": "", "citations": [], "rules": []},
        "flags": [{"code": "BACKEND_UNAVAILABLE", "message": reason, "critical": True}],
    }


def save_run(session, job, values):
    application = session.scalar(
        select(Application).where(Application.id == job.application_id).with_for_update()
    )
    if application is None:
        return
    state = copy.deepcopy(application.review_state)
    state["runs"] = [{**run, **values} if run["id"] == job.id else run for run in state["runs"]]
    application.review_state = state


def expire(session):
    jobs = session.scalars(
        select(AssessmentJob)
        .where(AssessmentJob.status == "running", AssessmentJob.lease_until <= datetime.now(UTC))
        .with_for_update(skip_locked=True)
    ).all()
    for job in jobs:
        job.status = "failed"
        job.lease_until = None
        save_run(
            session,
            job,
            failed_run({}, "The assessment worker was interrupted. Retry the evaluation."),
        )


def enqueue(sessions, subject: str, application_id: str, config: AssessmentConfig) -> dict:
    with transaction(sessions) as session:
        actor = active_account(session, subject, tutor=True)
        application = owned_application(session, subject, application_id, write=True)
        active = session.scalar(
            select(AssessmentJob).where(
                AssessmentJob.application_id == application.id,
                AssessmentJob.status.in_(["queued", "running"]),
            )
        )
        if active and (active.status == "queued" or active.lease_until > datetime.now(UTC)):
            return {"id": active.id, "status": active.status}
        if active:
            active.status = "failed"
            active.lease_until = None
            save_run(session, active, failed_run({}, "The assessment worker was interrupted."))
            session.flush()
        documents = session.execute(
            select(Document.id, Document.sha256, Document.document_type, Document.page_count)
            .where(Document.application_id == application.id)
            .order_by(Document.position, Document.id)
        ).all()
        if not documents or any(doc.sha256 not in config.document_hashes for doc in documents):
            raise ApiError(
                403,
                "ASSESSMENT_PILOT_ONLY",
                "Use approved synthetic PDFs for this assessment pilot.",
            )
        programme = session.get(Programme, application.programme_id)
        rubric = session.get(StoredRubric, programme.active_rubric_id)
        if rubric is None:
            raise ApiError(422, "CRITERIA_MISSING", "Save course criteria before assessing.")
        criteria = CourseCriteria.model_validate(
            {**rubric.criteria, "id": rubric.id, "version": rubric.version, "name": programme.name}
        )
        identity = str(uuid4())
        job = AssessmentJob(
            id=identity,
            application_id=application.id,
            requested_by=subject,
            status="queued",
            inputs={
                "documents": [
                    dict(id=d.id, sha256=d.sha256, type=d.document_type, pages=d.page_count)
                    for d in documents
                ],
                "criteria": criteria.model_dump(by_alias=True),
                "model": config.model_version,
                "flow": FLOW_VERSION,
                "workflowHash": workflow_fingerprint(),
            },
        )
        session.add(job)
        now = datetime.now(UTC).isoformat()
        state = copy.deepcopy(application.review_state)
        parent = state["runs"][-1]["id"] if state["runs"] else None
        state["runs"].append(
            {
                "id": identity,
                "applicationId": application.id,
                "rubricId": rubric.id,
                "startedAt": now,
                "finishAt": now,
                "status": "queued",
                "sections": [],
                "overall": None,
                "recommendation": "Further review",
                "justification": {"summary": "", "citations": [], "rules": []},
                "flags": [],
                "extractedGrade": None,
                "parentRunId": parent,
                "simulated": False,
                "evaluationSource": "qwen-langgraph",
            }
        )
        application.review_state = state
        record_audit(session, actor, "queue_assessment", application.id)
        return {"id": identity, "status": "queued"}


def claim(sessions):
    with transaction(sessions) as session:
        expire(session)
        job = session.scalar(
            select(AssessmentJob)
            .where(AssessmentJob.status == "queued")
            .order_by(AssessmentJob.created_at, AssessmentJob.id)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if job:
            job.status = "running"
            job.lease_until = datetime.now(UTC) + LEASE
            save_run(session, job, {"status": "running"})
        return job


def load_inputs(sessions, job, config):
    if (
        job.inputs["model"] != config.model_version
        or job.inputs["flow"] != FLOW_VERSION
        or job.inputs["workflowHash"] != workflow_fingerprint()
    ):
        raise ValueError("The worker version changed. Retry with the active worker.")
    with transaction(sessions) as session:
        active_account(session, job.requested_by, tutor=True)
        owned_application(session, job.requested_by, job.application_id)
        documents = {}
        for source in job.inputs["documents"]:
            document = session.get(Document, source["id"])
            if (
                document is None
                or document.application_id != job.application_id
                or document.document_type != source["type"]
                or document.sha256 != source["sha256"]
                or document.page_count != source["pages"]
                or hashlib.sha256(document.pdf_bytes).hexdigest() not in config.document_hashes
                or hashlib.sha256(document.pdf_bytes).hexdigest() != source["sha256"]
            ):
                raise ValueError("An assessment source changed or is outside the synthetic pilot.")
            documents.setdefault(source["type"], []).append(
                SourceDocument(document.id, document.pdf_bytes, document.page_count)
            )
        return documents, CourseCriteria.model_validate(job.inputs["criteria"])


def finish(sessions, job, *, result=None, error=None):
    with transaction(sessions) as session:
        current = session.scalar(
            select(AssessmentJob).where(AssessmentJob.id == job.id).with_for_update()
        )
        if (
            current is None
            or current.status != "running"
            or current.lease_until != job.lease_until
            or current.lease_until <= datetime.now(UTC)
        ):
            return
        try:
            active_account(session, current.requested_by, tutor=True)
            owned_application(session, current.requested_by, current.application_id, write=True)
        except ApiError:
            result = None
            error = "Course access changed while the assessment was running."
        current.status = "completed" if result is not None else "failed"
        current.lease_until = None
        values = (
            {**result, "status": "awaiting review", "finishAt": datetime.now(UTC).isoformat()}
            if result is not None
            else failed_run({}, error)
        )
        values["provenance"] = current.inputs
        save_run(session, current, values)
        english = (result or {}).get("englishEligibility")
        english_source = next(
            (source for source in current.inputs["documents"] if source["type"] == "english_test"),
            None,
        )
        if english is not None and english_source is not None:
            available = english.get("reason") != "unavailable"
            session.add(
                EnglishTestCheck(
                    application_id=current.application_id,
                    requested_by=current.requested_by,
                    document_id=english_source["id"],
                    document_hash=english_source["sha256"],
                    created_at=datetime.now(UTC),
                    status="completed" if available else "failed",
                    prompt_version=PROMPT_VERSION,
                    model_version=current.inputs["model"],
                    rule_version=RULE_VERSION,
                    result={
                        key: value
                        for key, value in english.items()
                        if key not in {"documentId", "page"}
                    }
                    if available
                    else None,
                    error=None if available else "unavailable",
                )
            )


def project_expired(session, records):
    ids = [record["id"] for record in records]
    expired = set(
        session.scalars(
            select(AssessmentJob.id).where(
                AssessmentJob.application_id.in_(ids),
                AssessmentJob.status == "running",
                AssessmentJob.lease_until <= datetime.now(UTC),
            )
        )
    )
    for record in records:
        record["runs"] = [
            failed_run(run, "The assessment worker was interrupted. Retry the evaluation.")
            if run["id"] in expired
            else run
            for run in record["runs"]
        ]
