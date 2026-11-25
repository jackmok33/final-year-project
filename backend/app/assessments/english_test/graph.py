"""English test workflow compiled once per worker."""

import asyncio
import re
import subprocess
from pathlib import Path
from typing import TypedDict

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda
from langgraph.graph import END, START, StateGraph
from langsmith import tracing_context
from pydantic import ValidationError

from app.assessments.english_test.schemas import (
    COMPONENTS,
    PROMPT_VERSION,
    EligibilityResult,
    ReportedResult,
    apply_demo_rule,
)
from app.assessments.shared.pdf_preparation import decode_page, prepare_in_child
from app.inference.client import InferenceClient, InferenceError

PROMPT = Path(__file__).with_name(f"{PROMPT_VERSION}.md")


class EnglishTestState(TypedDict, total=False):
    contents: bytes
    page_count: int
    text: str
    png: bytes
    reported: ReportedResult
    result: EligibilityResult


def prepare(state: EnglishTestState) -> EnglishTestState:
    if state["page_count"] != 1:
        return {"result": EligibilityResult(outcome="needs_review", reason="unsupported_report")}
    try:
        text, png = decode_page(
            prepare_in_child("app.assessments.english_test.pdf_page", state["contents"])
        )
        return {"text": text, "png": png}
    except (OSError, ValueError, subprocess.SubprocessError):
        return {"result": EligibilityResult(outcome="needs_review", reason="unreadable_report")}


def embedded_bands(text: str) -> dict[str, float]:
    """Cross-check values where the text explicitly associates a label and band."""
    bands = {}
    for name in ("overall", *COMPONENTS):
        values = re.findall(
            rf"^ *{name}(?: +band(?: +score)?)?(?: *[:\-] *| +)([0-9](?:\.[05])?) *$",
            text,
            flags=re.I | re.M,
        )
        if values:
            # A disagreement within the text is itself inconsistent evidence.
            bands[name] = float(values[0]) if len(set(map(float, values))) == 1 else -1
    return bands


class EnglishTestWorkflow:
    def __init__(self, client: InferenceClient):
        prompt = ChatPromptTemplate.from_messages(
            [("system", PROMPT.read_text(encoding="utf-8")), ("human", "Page 1 text:\n{evidence}")]
        )

        async def invoke_model(input: dict):
            system, user = prompt.format_messages(evidence=input["evidence"])
            return await client.generate(
                user.content, system_prompt=system.content, image_png=input["png"], json_output=True
            )

        extract_chain = RunnableLambda(invoke_model)

        async def extract(state: EnglishTestState) -> EnglishTestState:
            try:
                completion = await extract_chain.ainvoke(
                    {"evidence": state["text"], "png": state["png"]}
                )
                return {"reported": ReportedResult.model_validate(completion.data)}
            except InferenceError as error:
                if error.code not in {
                    "INFERENCE_INVALID_RESPONSE",
                    "INFERENCE_INCOMPLETE_RESPONSE",
                }:
                    raise
            except ValidationError:
                pass
            return {"result": EligibilityResult(outcome="needs_review", reason="invalid_output")}

        def validate(state: EnglishTestState) -> EnglishTestState:
            return {"result": apply_demo_rule(state["reported"], embedded_bands(state["text"]))}

        def next_step(state: EnglishTestState) -> bool:
            return "result" not in state

        graph = StateGraph(EnglishTestState)
        graph.add_node("prepare", prepare)
        graph.add_node("extract", extract)
        graph.add_node("validate", validate)
        graph.add_edge(START, "prepare")
        graph.add_conditional_edges("prepare", next_step, {True: "extract", False: END})
        graph.add_conditional_edges("extract", next_step, {True: "validate", False: END})
        graph.add_edge("validate", END)
        self.graph = graph.compile()

    async def evaluate(self, contents: bytes, page_count: int) -> EligibilityResult:
        # PDF contents and model responses stay within the private worker.
        with tracing_context(enabled=False):
            async with asyncio.timeout(120):
                state = await self.graph.ainvoke({"contents": contents, "page_count": page_count})
        return state["result"]
