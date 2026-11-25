"""Workflow version and the orchestrator's qualitative summary response."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

FLOW_VERSION = "assessment-flow-v1"


class SummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    summary: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1600)]
    evidence: Annotated[list[str], Field(min_length=1, max_length=12)]
