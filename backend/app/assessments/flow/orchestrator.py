"""Run the five specialists, score their findings and generate a tutor summary."""

import asyncio
import json
import re
from decimal import Decimal
from pathlib import Path
from typing import TypedDict

from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import END, START, StateGraph
from langsmith import tracing_context
from pydantic import ValidationError

from app.assessments.english_test.graph import EnglishTestWorkflow
from app.assessments.flow.config import workflow_fingerprint
from app.assessments.flow.schemas import SummaryResponse
from app.assessments.shared.contracts import (
    SECTION_DOCUMENTS,
    SECTION_KEYS,
    CourseCriteria,
    SectionResult,
)
from app.assessments.shared.documents import SourceDocument
from app.assessments.shared.specialist import RUBRICS, SectionWorkflow, rounded
from app.inference.client import InferenceClient, InferenceError


class FlowState(TypedDict, total=False):
    documents: dict[str, list[SourceDocument]]
    criteria: CourseCriteria
    sections: dict[str, SectionResult]
    english: dict
    flags: list[dict]
    overall: float | None
    recommendation: str
    rules: list[str]
    summary: str
    summary_evidence: list[str]


class AssessmentWorkflow:
    def __init__(self, client: InferenceClient):
        if client.settings.provider != "qwen":
            raise ValueError("The assessment workflow requires the configured Qwen endpoint.")
        self.client = client
        self.fingerprint = workflow_fingerprint()
        self.english_agent = EnglishTestWorkflow(client)
        self.summary_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", Path(__file__).with_name("summary-v1.md").read_text()),
                ("human", "Validated findings:\n{findings}"),
            ]
        )
        graph = StateGraph(FlowState)

        def specialist_node(key):
            agent = SectionWorkflow(client, key)

            async def evaluate(state):
                kind = SECTION_DOCUMENTS[key]
                documents = list(state["documents"].get(kind, []))
                if key == "academic" and documents:
                    documents.extend(state["documents"].get("application_form", []))
                result = await agent.evaluate(documents, state["criteria"])
                return {"sections": {**state["sections"], key: result}}

            return evaluate

        for key in SECTION_KEYS:
            graph.add_node(key, specialist_node(key))
        graph.add_node("english", self.english)
        graph.add_node("score", self.score)
        graph.add_node("summary", self.summarise)
        stages = [
            START,
            "academic",
            "cv",
            "statement",
            "references",
            "english",
            "score",
            "summary",
            END,
        ]
        for source, target in zip(stages, stages[1:]):
            graph.add_edge(source, target)
        self.graph = graph.compile()

    async def english(self, state: FlowState) -> dict:
        documents = state["documents"].get("english_test", [])
        if not documents:
            return {"english": {"outcome": "needs_review", "reason": "missing_report"}}
        document = documents[0]
        try:
            result = await self.english_agent.evaluate(document.contents, document.page_count)
            return {
                "english": {
                    **result.model_dump(by_alias=True, mode="json"),
                    "documentId": document.id,
                    "page": 1,
                }
            }
        except (InferenceError, TimeoutError):
            return {"english": {"outcome": "needs_review", "reason": "unavailable"}}

    def score(self, state: FlowState) -> dict:
        criteria = state["criteria"]
        sections = state["sections"]
        required = [key for key, weight in criteria.weights.items() if weight > 0]
        complete = all(sections[key].score is not None for key in required)
        overall = (
            rounded(
                sum(
                    Decimal(str(sections[key].score)) * Decimal(str(criteria.weights[key])) / 100
                    for key in required
                )
            )
            if complete
            else None
        )
        flags = [
            {
                "code": f"{key.upper()}_NEEDS_REVIEW",
                "message": section.uncertainty,
                "critical": True,
            }
            for key, section in sections.items()
            if key in required and section.score is None
        ]
        if sections["academic"].academic_requirement != "met":
            flags.append(
                {
                    "code": "ACADEMIC_REQUIREMENT",
                    "message": "The mandatory academic requirement requires tutor review.",
                    "critical": True,
                }
            )
        if state["english"].get("outcome") != "meets_requirement":
            flags.append(
                {
                    "code": "ENGLISH_REQUIREMENT",
                    "message": "English eligibility requires tutor review.",
                    "critical": True,
                }
            )
        if flags or overall is None:
            recommendation, rule = (
                "Further review",
                "Required evidence or eligibility needs review.",
            )
        elif any(
            abs(Decimal(str(overall)) - Decimal(str(threshold))) <= Decimal(str(criteria.margin))
            for threshold in (criteria.offer_from, criteria.reject_below)
        ):
            recommendation, rule = (
                "Further review",
                "The score lies within the saved review margin.",
            )
        elif overall >= criteria.offer_from:
            recommendation, rule = (
                "Offer",
                f"The score meets the saved offer threshold of {criteria.offer_from:g}.",
            )
        elif overall < criteria.reject_below:
            recommendation, rule = (
                "Reject",
                f"The score is below the saved rejection threshold of {criteria.reject_below:g}.",
            )
        else:
            recommendation, rule = "Further review", "The score lies between the saved thresholds."
        return {
            "overall": overall,
            "recommendation": recommendation,
            "rules": [rule],
            "flags": flags,
        }

    async def summarise(self, state: FlowState) -> dict:
        sections = state["sections"]
        evidence_ids = {e.id for section in sections.values() for e in section.citations}
        narrative = ""
        summary_evidence = []
        flags = list(state["flags"])
        if evidence_ids:
            system, user = self.summary_prompt.format_messages(
                findings=json.dumps(
                    {key: value.model_dump(by_alias=True) for key, value in sections.items()}
                )
            )
            try:
                completion = await self.client.generate(
                    user.content, system_prompt=system.content, json_output=True
                )
                response = SummaryResponse.model_validate(completion.data)
                if not set(response.evidence) <= evidence_ids or re.search(r"\d", response.summary):
                    raise ValueError(
                        "The summary contains unsupported references or numeric claims."
                    )
                narrative = response.summary + "\n\n"
                summary_evidence = response.evidence
            except (InferenceError, ValidationError, ValueError):
                flags.append(
                    {
                        "code": "SUMMARY_NEEDS_REVIEW",
                        "message": (
                            "The generated summary could not be validated. "
                            "Review the saved specialist findings."
                        ),
                        "critical": True,
                    }
                )
        total = (
            f"Overall score {state['overall']:.2f}/100."
            if state["overall"] is not None
            else "The overall score is unavailable because required evidence is incomplete."
        )
        return {
            "summary": narrative + total + " " + state["rules"][0],
            "summary_evidence": summary_evidence,
            "flags": flags,
            "recommendation": "Further review" if flags else state["recommendation"],
        }

    async def evaluate(
        self, documents: dict[str, list[SourceDocument]], criteria: CourseCriteria
    ) -> dict:
        with tracing_context(enabled=False):
            async with asyncio.timeout(1200):
                state = await self.graph.ainvoke(
                    {"documents": documents, "criteria": criteria, "sections": {}}
                )
        return {
            "sections": [state["sections"][key].model_dump(by_alias=True) for key in SECTION_KEYS],
            "overall": state["overall"],
            "recommendation": state["recommendation"],
            "justification": {
                "summary": state["summary"],
                "rules": state["rules"],
                "citations": [
                    e.model_dump(by_alias=True)
                    for section in state["sections"].values()
                    for e in section.citations
                    if e.id in state["summary_evidence"]
                ],
            },
            "flags": state["flags"],
            "extractedGrade": state["sections"]["academic"].extracted_grade,
            "englishEligibility": state["english"],
            "rubricVersion": RUBRICS["version"],
        }
