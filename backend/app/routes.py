from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.schemas import AssessmentRun, BackendHealth, MockAssessmentRequest
from app.services.evaluation import (
    EvaluationService,
    MockEvaluationService,
    UnsupportedMockCase,
)

router = APIRouter(prefix="/api/v1")


def get_evaluation_service() -> EvaluationService:
    return MockEvaluationService()


@router.get("/health", tags=["Health"])
def health() -> BackendHealth:
    return BackendHealth()


@router.post(
    "/mock/assessments",
    tags=["Synthetic assessments"],
    response_model=AssessmentRun,
)
def evaluate(
    request: MockAssessmentRequest,
    service: Annotated[EvaluationService, Depends(get_evaluation_service)],
) -> AssessmentRun:
    """Synchronous proof of integration. Not a persisted job or document assessor."""
    try:
        return service.evaluate(request)
    except UnsupportedMockCase as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
