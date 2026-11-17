"""Persist assessment runs, tutor decisions and grade corrections."""

import copy
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.api import ApiError
from app.assessments.mock import FIXTURES, MockEvaluationService, UnsupportedMockCase
from app.assessments.schemas import (
    CorrectionRequest,
    CriteriaContext,
    DecisionRequest,
    DocumentReference,
    MockAssessmentRequest,
)
from app.audit import record_audit
from app.auth.permissions import active_account, owned_application
from app.models import Application, Document, Programme, StoredRubric, User
from app.transactions import transaction


def _ready_run(application: Application, run_id: str) -> dict:
    runs = application.review_state["runs"]
    run = runs[-1] if runs else None
    if (
        not run
        or run["id"] != run_id
        or run["status"] in {"queued", "running", "failed"}
        or any(flag["code"] == "BACKEND_UNAVAILABLE" for flag in run["flags"])
    ):
        raise ApiError(
            409,
            "ASSESSMENT_NOT_READY",
            "Review the latest successful assessment before saving.",
        )
    return run


def _evaluate_fixture(session: Session, application: Application, grade: float | None) -> dict:
    programme = session.get(Programme, application.programme_id)
    rubric = (
        session.get(StoredRubric, programme.active_rubric_id)
        if programme.active_rubric_id
        else None
    )
    if (
        application.fixture != FIXTURES.get(application.id)
        or application.id not in FIXTURES
        or rubric is None
        or rubric.criteria["weights"].get("references", 0) > 0
    ):
        raise ApiError(
            503,
            "ASSESSMENT_UNAVAILABLE",
            "Real document assessment is not connected yet. No scores have been generated.",
        )
    criteria = {
        **rubric.criteria,
        "id": rubric.id,
        "version": rubric.version,
        "weights": {k: v for k, v in rubric.criteria["weights"].items() if k != "references"},
    }
    documents = session.execute(
        select(Document.id, Document.document_type, Document.page_count).where(
            Document.application_id == application.id,
            Document.document_type.in_(["transcript", "cv", "statement"]),
        )
    ).all()
    try:
        request = MockAssessmentRequest(
            application_id=application.id,
            criteria=CriteriaContext.model_validate(criteria),
            documents=[
                DocumentReference(id=d.id, type=d.document_type, pages=d.page_count)
                for d in documents
            ],
            grade=grade,
            parent_run_id=(
                application.review_state["runs"][-1]["id"]
                if application.review_state["runs"]
                else None
            ),
            model_available=programme.model_available,
        )
        return (
            MockEvaluationService()
            .evaluate(request)
            .model_dump(by_alias=True, mode="json", exclude_none=False)
        )
    except UnsupportedMockCase:
        raise ApiError(
            503, "ASSESSMENT_UNAVAILABLE", "This case has no supported synthetic assessment."
        ) from None


def _review_context(
    session: Session, subject: str, application_id: str
) -> tuple[User, Application]:
    actor = active_account(session, subject, tutor=True)
    application = owned_application(session, actor.id, application_id, write=True)
    return actor, application


def run_evaluation(sessions: sessionmaker[Session], subject: str, application_id: str) -> dict:
    with transaction(sessions) as session:
        actor, application = _review_context(session, subject, application_id)
        state = copy.deepcopy(application.review_state)
        latest = state["runs"][-1] if state["runs"] else None
        if latest and latest["status"] in {"queued", "running"}:
            raise ApiError(409, "ASSESSMENT_RUNNING", "An evaluation is already in progress.")
        grade = (
            state["corrections"][-1]["value"]
            if state["corrections"]
            else (latest or {}).get("extractedGrade", 74)
        )
        state["runs"].append(_evaluate_fixture(session, application, grade))
        application.review_state = state
        record_audit(session, actor, "evaluate", application.id)
    return {}


def record_decision(
    sessions: sessionmaker[Session], subject: str, application_id: str, payload: DecisionRequest
) -> dict:
    with transaction(sessions) as session:
        actor, application = _review_context(session, subject, application_id)
        run = _ready_run(application, payload.run_id)
        state = copy.deepcopy(application.review_state)
        decision = {
            "runId": run["id"],
            "outcome": payload.outcome,
            "reason": payload.reason.strip(),
        }
        if state["decisions"] and all(
            state["decisions"][-1].get(key) == value for key, value in decision.items()
        ):
            return {}
        state["decisions"].append(
            {
                **decision,
                "id": str(uuid4()),
                "recommendation": run["recommendation"],
                "actor": actor.id,
                "at": datetime.now(UTC).isoformat(),
            }
        )
        application.review_state = state
        record_audit(session, actor, "decision", application.id)
    return {}


def record_correction(
    sessions: sessionmaker[Session], subject: str, application_id: str, payload: CorrectionRequest
) -> dict:
    with transaction(sessions) as session:
        actor, application = _review_context(session, subject, application_id)
        run = _ready_run(application, payload.run_id)
        document = session.get(Document, payload.document_id)
        reason = payload.reason.strip()
        if (
            document is None
            or document.application_id != application.id
            or document.document_type != "transcript"
            or payload.page > document.page_count
            or not reason
        ):
            raise ApiError(
                422, "CORRECTION_INVALID", "Enter a valid transcript page and correction reason."
            )
        next_run = _evaluate_fixture(session, application, payload.value)
        state = copy.deepcopy(application.review_state)
        state["corrections"].append(
            {
                "id": str(uuid4()),
                "runId": run["id"],
                "original": run["extractedGrade"],
                "value": payload.value,
                "reason": reason,
                "citation": {
                    "documentId": document.id,
                    "page": payload.page,
                    "claim": f"Corrected grade: {payload.value}%",
                },
                "actor": actor.id,
                "at": datetime.now(UTC).isoformat(),
            }
        )
        state["runs"].append(next_run)
        application.review_state = state
        record_audit(session, actor, "correction", application.id)
    return {}
