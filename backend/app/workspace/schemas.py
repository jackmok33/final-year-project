"""Workspace, account, criteria and multipart upload requests."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from app.api import ApiModel, Identifier, Score
from app.documents.schemas import StoredDocumentType


class ProgrammeCreate(ApiModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]


class CriteriaUpdate(ApiModel):
    expected_id: Identifier
    weights: dict[Literal["academic", "cv", "statement", "references"], Score]
    reject_below: Score
    offer_from: Score
    margin: Score
    mandatory_rule: str

    @model_validator(mode="after")
    def valid_weights(self) -> Self:
        if (
            not {"academic", "cv", "statement"}.issubset(self.weights)
            or abs(sum(self.weights.values()) - 100) > 0.001
        ):
            raise ValueError("Section weights must total 100% and include the three core sections.")
        if self.reject_below >= self.offer_from:
            raise ValueError("The rejection threshold must be below the offer threshold.")
        return self


class AccountUpdate(ApiModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    email: Annotated[
        str, Field(min_length=3, max_length=320, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    ]
    roles: Annotated[list[Literal["tutor", "admin"]], Field(min_length=1, max_length=2)]
    active: bool


class UploadPart(ApiModel):
    type: StoredDocumentType
    file_index: Annotated[int, Field(ge=0, le=999, strict=True)]


class ApplicantManifest(ApiModel):
    candidate: Annotated[str, Field(min_length=1, max_length=200)]
    documents: Annotated[list[UploadPart], Field(min_length=1, max_length=100)]


class ApplicationManifest(ApplicantManifest):
    intake_year: Annotated[str, Field(min_length=1, max_length=200)]
    batch_id: Identifier | None = None


class BatchManifest(ApiModel):
    intake_year: Annotated[str, Field(min_length=1, max_length=200)]
    filename: Annotated[str, Field(min_length=1, max_length=255)]
    applications: Annotated[list[ApplicantManifest], Field(min_length=1, max_length=100)]


class DeleteApplicationRequest(ApiModel):
    confirmed: Literal[True]
