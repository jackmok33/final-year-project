"""Extract evidence from a short CV and check every quote against its page."""

import asyncio
import subprocess
from pathlib import Path

from langchain_core.prompts import ChatPromptTemplate
from langsmith import tracing_context
from pydantic import ValidationError

from app.assessments.cv.pdf_pages import MAX_CV_PAGES
from app.assessments.cv.schemas import (
    PROMPT_VERSION,
    CvEvidence,
    CvFact,
    CvReviewIssue,
    ReportedPage,
)
from app.assessments.pdf_preparation import decode_page, prepare_in_child
from app.inference.client import InferenceClient, InferenceError

PROMPT = Path(__file__).with_name(f"{PROMPT_VERSION}.md")


class CvWorkflow:
    def __init__(self, client: InferenceClient):
        self.client = client
        self.prompt = ChatPromptTemplate.from_messages(
            [
                ("system", PROMPT.read_text(encoding="utf-8")),
                ("human", "CV page {page} text:\n{evidence}"),
            ]
        )

    async def evaluate(self, contents: bytes, page_count: int) -> CvEvidence:
        if not 1 <= page_count <= MAX_CV_PAGES:
            return CvEvidence(
                status="needs_review", issues=[CvReviewIssue(reason="unsupported_page_count")]
            )
        try:
            prepared = await asyncio.to_thread(
                prepare_in_child, "app.assessments.cv.pdf_pages", contents
            )
            if len(prepared) != page_count:
                raise ValueError("Prepared page count differs from the original document.")
            pages = [decode_page(page) for page in prepared]
        except (OSError, ValueError, subprocess.SubprocessError):
            return CvEvidence(status="needs_review", issues=[CvReviewIssue(reason="unreadable_cv")])

        facts: list[CvFact] = []
        issues: list[CvReviewIssue] = []
        with tracing_context(enabled=False):
            for number, (text, png) in enumerate(pages, 1):
                if not text:
                    issues.append(CvReviewIssue(reason="no_embedded_text", page=number))
                    continue
                system, user = self.prompt.format_messages(page=number, evidence=text)
                try:
                    completion = await self.client.generate(
                        user.content,
                        system_prompt=system.content,
                        image_png=png,
                        json_output=True,
                    )
                    reported = ReportedPage.model_validate(completion.data)
                except ValidationError:
                    issues.append(CvReviewIssue(reason="invalid_output", page=number))
                    continue
                except InferenceError as error:
                    if error.code in {
                        "INFERENCE_INVALID_RESPONSE",
                        "INFERENCE_INCOMPLETE_RESPONSE",
                    }:
                        issues.append(CvReviewIssue(reason="invalid_output", page=number))
                        continue
                    issues.append(CvReviewIssue(reason="inference_unavailable", page=number))
                    break

                page_text = " ".join(text.split())
                seen: set[str] = set()
                unverified = False
                for fact in reported.facts:
                    quote = " ".join(fact.quote.split())
                    if quote not in page_text:
                        unverified = True
                    elif quote not in seen:
                        facts.append(CvFact(category=fact.category, quote=quote, page=number))
                        seen.add(quote)
                if unverified:
                    issues.append(CvReviewIssue(reason="unverified_quote", page=number))
                elif not reported.facts:
                    issues.append(CvReviewIssue(reason="no_evidence", page=number))
        return CvEvidence(
            status="needs_review" if issues else "complete", facts=facts, issues=issues
        )
