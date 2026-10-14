"""Synthetic fixtures only. No PDFs are read and no language model is called."""

from datetime import UTC, datetime
from typing import Protocol
from uuid import uuid4

from app.schemas import (
    AssessmentRun,
    Citation,
    CriteriaContext,
    Justification,
    MockAssessmentRequest,
    Outcome,
    ReviewFlag,
    SectionScore,
)

FIXTURES = {
    "APP-2026-0142": "review",
    "APP-2026-0143": "offer",
    "APP-2026-0144": "reject",
    "APP-2026-0145": "missing",
    "APP-2026-0146": "failed",
    "APP-2026-0147": "offer",
}


class UnsupportedMockCase(ValueError):
    pass


class EvaluationService(Protocol):
    def evaluate(self, request: MockAssessmentRequest) -> AssessmentRun: ...


def aggregate(
    sections: list[SectionScore], criteria: CriteriaContext, critical: bool
) -> tuple[float | None, Outcome, list[str]]:
    complete = all(section.score is not None for section in sections)
    # Match the frontend's positive-score rounding to two decimal places.
    overall = (
        int(sum(s.score * criteria.weights[s.key] / 100 for s in sections) * 100 + 0.5) / 100
        if complete
        else None
    )
    if critical or not complete:
        return (
            overall,
            "Further review",
            ["Unresolved critical or missing evidence takes precedence."],
        )
    if any(
        abs(overall - threshold) <= criteria.margin
        for threshold in (criteria.offer_from, criteria.reject_below)
    ):
        return (
            overall,
            "Further review",
            [f"Within the inclusive ±{criteria.margin:g}-point review margin of a threshold."],
        )
    if overall >= criteria.offer_from:
        return overall, "Offer", [f"Score meets the offer threshold of {criteria.offer_from:g}."]
    if overall < criteria.reject_below:
        return (
            overall,
            "Reject",
            [f"Score is below the rejection threshold of {criteria.reject_below:g}."],
        )
    return overall, "Further review", ["Score lies between the offer and rejection thresholds."]


class MockEvaluationService:
    def evaluate(self, request: MockAssessmentRequest) -> AssessmentRun:
        fixture = FIXTURES.get(request.application_id)
        if fixture is None:
            raise UnsupportedMockCase(
                "Only seeded synthetic cases are supported. Uploaded PDFs need real assessment."
            )
        if any(d.id != f"{request.application_id}-{d.type}" for d in request.documents):
            raise UnsupportedMockCase("Only synthetic fixture document references are supported.")

        scores = (
            [90, 88, 86]
            if fixture == "offer"
            else [45, 50, 48]
            if fixture == "reject"
            else [84, 76, 69.6]
        )
        unsupported = request.grade != 74 and not (fixture == "review" and request.grade == 71)
        failed = fixture == "failed" and not request.model_available
        mismatch = fixture == "review" and request.grade == 71
        missing = len(request.documents) < 3
        flags = []
        for condition, code, message in (
            (
                mismatch,
                "GRADE_MISMATCH",
                "Extracted grade 71% conflicts with the synthetic transcript's 74% on page 2.",
            ),
            (
                missing,
                "MISSING_DOCUMENT",
                "A mandatory source document is missing. No complete overall score is available.",
            ),
            (
                unsupported,
                "BACKEND_UNAVAILABLE",
                "No fixture assessment exists for this corrected grade. "
                "Real document assessment is not implemented.",
            ),
            (
                failed,
                "MODEL_UNAVAILABLE",
                "The mock model is set to unavailable. No real inference service is connected.",
            ),
        ):
            if condition:
                flags.append(ReviewFlag(code=code, message=message, critical=True))

        sections = []
        for index, key in enumerate(("academic", "cv", "statement")):
            document_type = "transcript" if key == "academic" else key
            doc = next((d for d in request.documents if d.type == document_type), None)
            score = None if unsupported or failed or doc is None else scores[index]
            explanation = (
                "No assessment is available for this evidence."
                if score is None
                else {
                    "academic": (
                        "Relevant undergraduate qualification and modules "
                        "are supported by the synthetic transcript."
                    ),
                    "cv": (
                        "Relevant project and internship experience "
                        "are supported by the synthetic CV."
                    ),
                    "statement": (
                        "Motivation is stated; programme-specific detail "
                        "is limited in this synthetic example."
                    ),
                }[key]
            )
            citations = (
                [
                    Citation(
                        document_id=doc.id,
                        page=min(2, doc.pages) if key == "academic" else 1,
                        claim=f"Final weighted average: {request.grade:g}%."
                        if key == "academic"
                        else explanation,
                    )
                ]
                if doc and not unsupported and not failed
                else []
            )
            sections.append(
                SectionScore(
                    key=key,
                    score=score,
                    explanation=explanation,
                    uncertainty="Insufficient evidence"
                    if score is None
                    else "Synthetic fixture; not an AI confidence estimate",
                    citations=citations,
                )
            )

        overall, recommendation, rules = aggregate(sections, request.criteria, bool(flags))
        concerns = " ".join(flag.message for flag in flags)
        summary = (
            f"FastAPI mock assessment: {recommendation}. "
            f"Weighted score: {overall if overall is not None else 'unavailable'}. "
            f"Criteria v{request.criteria.version}. {' '.join(rules)} {concerns} "
            "Scores and explanations are predefined synthetic fixtures, "
            "not AI output or UCL admissions policy."
        )
        now = datetime.now(UTC).isoformat()
        return AssessmentRun(
            id=str(uuid4()),
            application_id=request.application_id,
            rubric_id=request.criteria.id,
            started_at=now,
            finish_at=now,
            status="failed" if failed else "awaiting review",
            sections=sections,
            overall=overall,
            recommendation=recommendation,
            justification=Justification(
                summary=summary,
                rules=rules,
                citations=[c for section in sections for c in section.citations],
            ),
            flags=flags,
            extracted_grade=None if unsupported else request.grade,
            parent_run_id=request.parent_run_id,
            error="MODEL_UNAVAILABLE" if failed else None,
        )
