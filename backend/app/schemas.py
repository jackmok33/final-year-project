"""The small HTTP contract; JSON uses the frontend's existing camelCase fields."""

from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

SectionKey = Literal["academic", "cv", "statement"]
DocumentType = Literal["transcript", "cv", "statement"]
Outcome = Literal["Offer", "Reject", "Further review"]
Score = Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)]
Identifier = Annotated[str, Field(min_length=1, max_length=200)]


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class CriteriaContext(ApiModel):
    """Read-only context from the demo, not an endpoint to edit stored criteria."""

    id: Identifier
    version: Identifier
    weights: dict[SectionKey, Score]
    reject_below: Score
    offer_from: Score
    margin: Score
    mandatory_rule: Annotated[str, Field(min_length=1, max_length=1000)]

    @model_validator(mode="after")
    def validate_criteria(self) -> Self:
        if set(self.weights) != {"academic", "cv", "statement"}:
            raise ValueError("Exactly three section weights are required.")
        if abs(sum(self.weights.values()) - 100) > 0.001:
            raise ValueError("Section weights must total 100%.")
        if self.reject_below >= self.offer_from:
            raise ValueError("The rejection threshold must be below the offer threshold.")
        if not self.mandatory_rule.strip():
            raise ValueError("A mandatory academic rule is required.")
        return self


class DocumentReference(ApiModel):
    id: Identifier
    type: DocumentType
    pages: Annotated[int, Field(ge=1, le=100, strict=True)]


class MockAssessmentRequest(ApiModel):
    application_id: Identifier
    criteria: CriteriaContext
    documents: Annotated[list[DocumentReference], Field(max_length=3)]
    grade: Score | None
    model_available: bool = False
    parent_run_id: Identifier | None = None

    @model_validator(mode="after")
    def validate_documents(self) -> Self:
        if len({d.id for d in self.documents}) != len(self.documents) or len(
            {d.type for d in self.documents}
        ) != len(self.documents):
            raise ValueError("Duplicate document references are not allowed.")
        if sum(d.pages for d in self.documents) > 100:
            raise ValueError("An application cannot contain more than 100 pages.")
        return self


class Citation(ApiModel):
    document_id: Identifier
    page: int = Field(ge=1, le=100)
    claim: str


class SectionScore(ApiModel):
    key: SectionKey
    score: Score | None
    explanation: str
    uncertainty: str
    citations: list[Citation]


class ReviewFlag(ApiModel):
    code: str
    message: str
    critical: bool


class Justification(ApiModel):
    summary: str
    citations: list[Citation]
    rules: list[str]


class AssessmentRun(ApiModel):
    id: Identifier
    application_id: Identifier
    rubric_id: Identifier
    started_at: str
    finish_at: str
    status: Literal["awaiting review", "failed"]
    sections: list[SectionScore]
    overall: Score | None
    recommendation: Outcome
    justification: Justification
    flags: list[ReviewFlag]
    extracted_grade: Score | None
    parent_run_id: Identifier | None = None
    error: str | None = None
    simulated: Literal[True] = True
    evaluation_source: Literal["fastapi-mock"] = "fastapi-mock"


class BackendHealth(ApiModel):
    status: Literal["ok"] = "ok"
    mode: Literal["mock"] = "mock"
    service: Literal["ucl-application-review-api"] = "ucl-application-review-api"
    database: Literal["not configured"] = "not configured"
    inference: Literal["not configured"] = "not configured"
