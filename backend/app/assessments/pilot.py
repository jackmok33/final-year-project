"""Sequence the English and CV specialists for the synthetic pilot."""

import hashlib
from dataclasses import dataclass
from typing import Generic, Literal, TypedDict, TypeVar

from langgraph.graph import END, START, StateGraph
from langsmith import tracing_context

from app.api import ApiModel
from app.assessments.cv.schemas import CvEvidence
from app.assessments.cv.workflow import CvWorkflow
from app.assessments.english_test.graph import EnglishTestWorkflow
from app.assessments.english_test.schemas import EligibilityResult
from app.inference.client import InferenceClient, InferenceError


@dataclass(frozen=True)
class PilotDocument:
    id: str
    contents: bytes
    page_count: int

    def allowed(self, hashes: frozenset[str]) -> bool:
        return hashlib.sha256(self.contents).hexdigest() in hashes


class EnglishEvidence(ApiModel):
    page: Literal[1] = 1
    eligibility: EligibilityResult


Evidence = TypeVar("Evidence", bound=ApiModel)


class SpecialistResult(ApiModel, Generic[Evidence]):
    status: Literal["missing_document", "outside_pilot", "unavailable", "completed"]
    document_id: str | None = None
    evidence: Evidence | None = None


class PilotResult(ApiModel):
    english: SpecialistResult[EnglishEvidence]
    cv: SpecialistResult[CvEvidence]


class PilotState(TypedDict, total=False):
    english_document: PilotDocument | None
    cv_document: PilotDocument | None
    english: SpecialistResult[EnglishEvidence]
    cv: SpecialistResult[CvEvidence]


class AssessmentPilot:
    def __init__(
        self,
        client: InferenceClient,
        *,
        english_hashes: frozenset[str],
        cv_hashes: frozenset[str],
    ):
        if client.settings.provider != "qwen":
            raise ValueError("The synthetic assessment pilot requires Qwen.")
        english = EnglishTestWorkflow(client)
        cv = CvWorkflow(client)

        async def review_english(state: PilotState) -> PilotState:
            document = state["english_document"]
            if document is None:
                return {"english": SpecialistResult[EnglishEvidence](status="missing_document")}
            if not document.allowed(english_hashes):
                return {
                    "english": SpecialistResult[EnglishEvidence](
                        status="outside_pilot", document_id=document.id
                    )
                }
            try:
                eligibility = await english.evaluate(document.contents, document.page_count)
            except (InferenceError, TimeoutError):
                return {
                    "english": SpecialistResult[EnglishEvidence](
                        status="unavailable", document_id=document.id
                    )
                }
            return {
                "english": SpecialistResult[EnglishEvidence](
                    status="completed",
                    document_id=document.id,
                    evidence=EnglishEvidence(eligibility=eligibility),
                )
            }

        async def review_cv(state: PilotState) -> PilotState:
            document = state["cv_document"]
            if document is None:
                return {"cv": SpecialistResult[CvEvidence](status="missing_document")}
            if not document.allowed(cv_hashes):
                return {
                    "cv": SpecialistResult[CvEvidence](
                        status="outside_pilot", document_id=document.id
                    )
                }
            evidence = await cv.evaluate(document.contents, document.page_count)
            return {
                "cv": SpecialistResult[CvEvidence](
                    status="completed", document_id=document.id, evidence=evidence
                )
            }

        graph = StateGraph(PilotState)
        graph.add_node("english_check", review_english)
        graph.add_node("cv_check", review_cv)
        graph.add_edge(START, "english_check")
        graph.add_edge("english_check", "cv_check")
        graph.add_edge("cv_check", END)
        self.graph = graph.compile()

    async def evaluate(
        self, *, english_document: PilotDocument | None, cv_document: PilotDocument | None
    ) -> PilotResult:
        with tracing_context(enabled=False):
            state = await self.graph.ainvoke(
                {"english_document": english_document, "cv_document": cv_document}
            )
        return PilotResult(english=state["english"], cv=state["cv"])
