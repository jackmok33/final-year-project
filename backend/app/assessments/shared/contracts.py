"""Validated specialist judgements and persisted workflow inputs."""

from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.api import ApiModel, Score

SectionKey = Literal["academic", "cv", "statement", "references"]
SECTION_KEYS = ("academic", "cv", "statement", "references")
SECTION_DOCUMENTS = {
    "academic": "transcript",
    "cv": "cv",
    "statement": "statement",
    "references": "reference",
}


class CourseCriteria(ApiModel):
    id: str
    version: str
    name: str
    weights: dict[SectionKey, Score]
    reject_below: Score
    offer_from: Score
    margin: Score
    mandatory_rule: str

    @model_validator(mode="after")
    def valid_weights(self) -> Self:
        if not {"academic", "cv", "statement"}.issubset(self.weights):
            raise ValueError("The three core section weights are required.")
        if abs(sum(self.weights.values()) - 100) > 0.001 or self.reject_below >= self.offer_from:
            raise ValueError("Invalid course weights or thresholds.")
        return self


class PageExtraction(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    quotes: Annotated[
        list[
            Annotated[str, StringConstraints(strip_whitespace=True, min_length=8, max_length=160)]
        ],
        Field(max_length=4),
    ]


class Judgement(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    criterion: str
    level: Annotated[int, Field(ge=0, le=3)] | None
    evidence: Annotated[list[str], Field(max_length=4)]
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]


class SectionJudgement(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    judgements: Annotated[list[Judgement], Field(min_length=3, max_length=3)]
    academic_requirement: Literal["met", "not_met", "needs_review"] = "needs_review"
    extracted_grade: Annotated[float, Field(ge=0, le=100)] | None = None


class SourceEvidence(ApiModel):
    id: str
    document_id: str
    page: int
    claim: str


class SectionResult(ApiModel):
    key: SectionKey
    score: Score | None = None
    explanation: str = ""
    uncertainty: str = ""
    citations: list[SourceEvidence] = Field(default_factory=list)
    judgements: list[Judgement] = Field(default_factory=list)
    academic_requirement: Literal["met", "not_met", "needs_review"] = "needs_review"
    extracted_grade: Score | None = None
