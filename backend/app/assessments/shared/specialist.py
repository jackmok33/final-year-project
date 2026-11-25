"""Shared extraction and judgement mechanics for four dedicated specialists."""

import asyncio
import json
import re
import subprocess
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from langchain_core.prompts import ChatPromptTemplate

from app.assessments.shared.contracts import (
    CourseCriteria,
    PageExtraction,
    SectionJudgement,
    SectionKey,
    SectionResult,
    SourceEvidence,
)
from app.assessments.shared.documents import SourceDocument
from app.assessments.shared.pdf_pages import MAX_SECTION_PAGES, MAX_SECTION_TEXT
from app.assessments.shared.pdf_preparation import decode_page, prepare_in_child
from app.assessments.shared.rubrics import agent_prompts, load_rubrics
from app.inference.client import MAX_PROMPT_CHARACTERS, InferenceClient, InferenceError

ROOT = Path(__file__).parent
RUBRICS = load_rubrics()


def rounded(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


class SectionWorkflow:
    def __init__(self, client: InferenceClient, key: SectionKey):
        self.client = client
        self.key = key
        instructions = agent_prompts()[key].read_text()
        self.extract_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", (ROOT / "prompts/extract-v1.md").read_text()),
                ("human", "Specialist {key}. Rubric and context:\n{context}\nPage text:\n{text}"),
            ]
        )
        self.judge_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", instructions + (ROOT / "prompts/judge-v1.md").read_text()),
                ("human", "Course context and rubric:\n{context}\nSource material:\n{sources}"),
            ]
        )

    def review(self, reason: str) -> SectionResult:
        return SectionResult(key=self.key, uncertainty=reason)

    async def evaluate(
        self, documents: list[SourceDocument], criteria: CourseCriteria
    ) -> SectionResult:
        if not documents:
            return self.review("The required source document is missing.")
        if not 1 <= sum(doc.page_count for doc in documents) <= MAX_SECTION_PAGES:
            return self.review("The source exceeds this pilot's twelve-page section limit.")
        try:
            return await self._evaluate(documents, criteria)
        except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
            return self.review("The source or model output could not be validated.")
        except InferenceError:
            return self.review("The model is unavailable or returned an incomplete response.")

    async def _evaluate(
        self, documents: list[SourceDocument], criteria: CourseCriteria
    ) -> SectionResult:
        pages = []
        for doc in documents:
            prepared = await asyncio.to_thread(
                prepare_in_child, "app.assessments.shared.pdf_pages", doc.contents
            )
            if len(prepared) != doc.page_count:
                return self.review("The source page count could not be confirmed.")
            for index, page in enumerate(prepared, 1):
                text, png = decode_page(page)
                if not text:
                    return self.review("A source page has no verifiable embedded text.")
                pages.append((doc.id, index, text, png))
        if sum(len(page[2]) for page in pages) > MAX_SECTION_TEXT:
            return self.review("The source exceeds this pilot's text context limit.")

        context = json.dumps(
            {
                "course": criteria.name,
                "contextMode": "general",
                "capabilities": RUBRICS["capabilities"],
                "mandatoryRule": criteria.mandatory_rule,
                "criteria": RUBRICS[self.key],
            }
        )
        evidence = []
        sources = []
        for document_id, page, text, png in pages:
            system, user = self.extract_prompt.format_messages(
                key=self.key, context=context, text=text
            )
            completion = await self.client.generate(
                user.content, system_prompt=system.content, image_png=png, json_output=True
            )
            extracted = PageExtraction.model_validate(completion.data)
            sources.append({"document": document_id, "page": page, "text": text})
            for quote in dict.fromkeys(" ".join(quote.split()) for quote in extracted.quotes):
                if len(quote) < 8 or quote not in text:
                    return self.review("An evidence quote could not be matched to its source page.")
                evidence.append(
                    SourceEvidence(
                        id=f"{self.key}-E{len(evidence) + 1}",
                        document_id=document_id,
                        page=page,
                        claim=quote,
                    )
                )
        if not evidence:
            return self.review("No supported evidence was extracted from the source.")
        system, user = self.judge_prompt.format_messages(
            context=context,
            sources=json.dumps({"pages": sources, "evidence": [e.model_dump() for e in evidence]}),
        )
        if len(system.content) + len(user.content) > MAX_PROMPT_CHARACTERS:
            return self.review("The evidence exceeds the bounded judgement context.")
        completion = await self.client.generate(
            user.content, system_prompt=system.content, json_output=True
        )
        reported = SectionJudgement.model_validate(completion.data)
        if self.key == "academic" and reported.extracted_grade is not None:
            grade = f"{reported.extracted_grade:g}"
            if not any(
                re.search(
                    rf"(?<![\d.]){re.escape(grade)}(?:\.0+)?\s*(?:%|percent\b)", page[2], re.I
                )
                for page in pages
            ):
                return self.review("The reported overall percentage could not be confirmed.")
        judgements = {item.criterion: item for item in reported.judgements}
        if len(judgements) != 3 or judgements.keys() != RUBRICS[self.key].keys():
            return self.review("The model did not assess all required rubric criteria.")
        evidence_ids = {e.id for e in evidence}
        if any(
            not set(item.evidence) <= evidence_ids or (item.level is not None and not item.evidence)
            for item in reported.judgements
        ):
            return self.review("A judgement cites missing or unsupported evidence.")
        complete = all(item.level is not None for item in reported.judgements)
        score = (
            rounded(
                sum(
                    Decimal(item.level) * RUBRICS[self.key][item.criterion]["weight"] / 3
                    for item in reported.judgements
                )
            )
            if complete
            else None
        )
        used_ids = {identity for item in reported.judgements for identity in item.evidence}
        return SectionResult(
            key=self.key,
            score=score,
            explanation="\n\n".join(item.reason for item in reported.judgements),
            uncertainty="" if complete else "One or more rubric judgements require tutor review.",
            citations=[e for e in evidence if e.id in used_ids],
            judgements=reported.judgements,
            academic_requirement=reported.academic_requirement,
            extracted_grade=reported.extracted_grade if self.key == "academic" else None,
        )
