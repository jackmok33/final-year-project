"""Validate reported IELTS bands, then apply the synthetic pilot rule."""

import re
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api import ApiModel

RULE_VERSION = "ielts-academic-demo-v1"
PROMPT_VERSION = "ielts-academic-v1"
COMPONENTS = ("listening", "reading", "writing", "speaking")
MINIMUM_OVERALL = 7.0
MINIMUM_COMPONENT = 6.5

Band = Annotated[float, Field(strict=True, ge=0, le=9, multiple_of=0.5, allow_inf_nan=False)]


class ReportedResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    test_type: Literal["IELTS Academic", "Other"] | None = None
    test_date: date | None = None
    overall: Band | None = None
    listening: Band | None = None
    reading: Band | None = None
    writing: Band | None = None
    speaking: Band | None = None

    @field_validator("test_date", mode="before")
    @classmethod
    def validate_date(cls, value):
        if value is not None and (
            not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)
        ):
            raise ValueError("Use a calendar date in YYYY-MM-DD form.")
        return value


ReviewReason = Literal[
    "unsupported_report",
    "unreadable_report",
    "invalid_output",
    "missing_bands",
    "inconsistent_bands",
]


class EligibilityResult(ApiModel):
    outcome: Literal["meets_requirement", "below_requirement", "needs_review"]
    reason: ReviewReason | None = None
    test_type: str | None = None
    test_date: date | None = None
    overall: Band | None = None
    listening: Band | None = None
    reading: Band | None = None
    writing: Band | None = None
    speaking: Band | None = None


def apply_demo_rule(
    reported: ReportedResult, embedded_bands: dict[str, float]
) -> EligibilityResult:
    values = reported.model_dump()
    components = [getattr(reported, name) for name in COMPONENTS]
    if reported.test_type != "IELTS Academic":
        return EligibilityResult(outcome="needs_review", reason="unsupported_report")
    if reported.overall is None or any(score is None for score in components):
        return EligibilityResult(outcome="needs_review", reason="missing_bands", **values)
    # Half-bands become integer units. Round the average to the nearest half-band,
    # rounding quarter-band ties up, as specified by IELTS.
    overall_from_components = ((sum(int(score * 2) for score in components) + 2) // 4) / 2
    if reported.overall != overall_from_components or any(
        values[key] != score for key, score in embedded_bands.items()
    ):
        return EligibilityResult(outcome="needs_review", reason="inconsistent_bands", **values)
    meets = reported.overall >= MINIMUM_OVERALL and min(components) >= MINIMUM_COMPONENT
    return EligibilityResult(
        outcome="meets_requirement" if meets else "below_requirement", **values
    )
