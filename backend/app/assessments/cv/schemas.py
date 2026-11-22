"""Model output and source-linked CV evidence."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.api import ApiModel

PROMPT_VERSION = "cv-evidence-v1"
CvCategory = Literal[
    "education", "work_experience", "research", "project", "skill", "publication", "award"
]
CvReviewReason = Literal[
    "unsupported_page_count",
    "unreadable_cv",
    "no_embedded_text",
    "invalid_output",
    "inference_unavailable",
    "unverified_quote",
    "no_evidence",
]


class ReportedFact(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    category: CvCategory
    quote: Annotated[str, StringConstraints(strip_whitespace=True, min_length=8, max_length=180)]


class ReportedPage(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    facts: Annotated[list[ReportedFact], Field(max_length=4)]


class CvFact(ApiModel):
    category: CvCategory
    page: int
    quote: str


class CvReviewIssue(ApiModel):
    reason: CvReviewReason
    page: int | None = None


class CvEvidence(ApiModel):
    status: Literal["complete", "needs_review"]
    prompt_version: str = PROMPT_VERSION
    facts: list[CvFact] = Field(default_factory=list)
    issues: list[CvReviewIssue] = Field(default_factory=list)
