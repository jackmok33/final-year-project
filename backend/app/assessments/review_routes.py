"""Authenticated endpoints for persisted applicant review."""

from fastapi import APIRouter, Depends, Request

from app.api import ApiError
from app.assessments.schemas import CorrectionRequest, DecisionRequest
from app.dependencies import AuthenticatedSubject, DatabaseSessions, private_response

router = APIRouter(prefix="/api/v1", tags=["Workspace"], dependencies=[Depends(private_response)])


@router.post("/applications/{application_id}/english-test-checks", status_code=202)
def run_english_test(
    application_id: str,
    request: Request,
    subject: AuthenticatedSubject,
    sessions: DatabaseSessions,
):
    pilot = request.app.state.english_test_pilot
    if not pilot.document_hashes:
        raise ApiError(404, "ENGLISH_TEST_PILOT_DISABLED", "The English-test pilot is disabled.")
    from app.assessments.english_test.jobs import enqueue

    return enqueue(sessions, subject, application_id, pilot)


@router.post("/applications/{application_id}/evaluations")
def evaluate(application_id: str, subject: AuthenticatedSubject, sessions: DatabaseSessions):
    from app.assessments.review import run_evaluation

    return run_evaluation(sessions, subject, application_id)


@router.post("/applications/{application_id}/decisions")
def decide(
    application_id: str,
    payload: DecisionRequest,
    subject: AuthenticatedSubject,
    sessions: DatabaseSessions,
):
    from app.assessments.review import record_decision

    return record_decision(sessions, subject, application_id, payload)


@router.post("/applications/{application_id}/corrections")
def correct(
    application_id: str,
    payload: CorrectionRequest,
    subject: AuthenticatedSubject,
    sessions: DatabaseSessions,
):
    from app.assessments.review import record_correction

    return record_correction(sessions, subject, application_id, payload)
