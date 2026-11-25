import json
from dataclasses import replace

import httpx
import pytest

from app.assessments.flow.orchestrator import AssessmentWorkflow
from app.assessments.shared.contracts import CourseCriteria
from app.assessments.shared.documents import SourceDocument
from app.assessments.shared.specialist import SectionWorkflow
from app.inference.client import InferenceClient
from tests.full_assessment_fixtures import CRITERIA, DOCUMENTS, QUOTES, fake_response
from tests.inference_fakes import SETTINGS, completion


def sources():
    return {kind: [SourceDocument(kind, contents, 1)] for kind, contents in DOCUMENTS.items()}


@pytest.mark.anyio
@pytest.mark.parametrize("english_available", [True, False])
async def test_agents_receive_separate_sources_and_keep_other_results_after_an_outage(
    english_available,
):
    routed = []

    def transport(request):
        user = json.loads(request.content)["messages"][-1]["content"]
        if isinstance(user, list):
            text = user[0]["text"]
            if text.startswith("Page 1 text:"):
                assert all(quote not in text for quote in QUOTES.values())
                if not english_available:
                    return httpx.Response(503)
            else:
                key = text.splitlines()[0].split()[1].rstrip(".")
                page_text = text.split("\nPage text:\n", 1)[1]
                allowed = {
                    "academic": {"transcript", "application_form"},
                    "cv": {"cv"},
                    "statement": {"statement"},
                    "references": {"reference"},
                }[key]
                assert any(QUOTES[kind] in page_text for kind in allowed)
                assert all(
                    quote not in page_text for kind, quote in QUOTES.items() if kind not in allowed
                )
                routed.append(key)
        return fake_response(request)

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await AssessmentWorkflow(client).evaluate(sources(), CRITERIA)
    assert routed == ["academic", "academic", "cv", "statement", "references"]
    assert all(section["score"] == 66.67 for section in result["sections"])
    assert result["overall"] == 66.67
    assert result["englishEligibility"]["outcome"] == (
        "meets_requirement" if english_available else "needs_review"
    )


@pytest.mark.anyio
async def test_five_agents_produce_evidence_scores_and_summary_in_sequence():
    calls = []

    def transport(request):
        calls.append(json.loads(request.content))
        return fake_response(request)

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await AssessmentWorkflow(client).evaluate(sources(), CRITERIA)
    assert [section["key"] for section in result["sections"]] == [
        "academic",
        "cv",
        "statement",
        "references",
    ]
    assert [section["score"] for section in result["sections"]] == [66.67] * 4
    assert result["overall"] == 66.67 and result["recommendation"] == "Further review"
    assert result["extractedGrade"] == 74
    assert result["englishEligibility"]["outcome"] == "meets_requirement"
    assert result["flags"] == []
    assert len(calls) == 11
    assert all(section["citations"] for section in result["sections"])
    assert "66.67/100" in result["justification"]["summary"]
    assert all("ignore" in call["messages"][0]["content"].lower() for call in calls)


@pytest.mark.anyio
@pytest.mark.parametrize("missing", ["transcript", "reference", "english_test"])
async def test_missing_evidence_routes_to_review_without_inventing_a_score(missing):
    documents = sources()
    del documents[missing]
    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(fake_response)) as client:
        result = await AssessmentWorkflow(client).evaluate(documents, CRITERIA)
    assert result["recommendation"] == "Further review"
    assert result["flags"]
    assert (result["overall"] is not None) == (missing == "english_test")


@pytest.mark.anyio
async def test_multiple_references_keep_their_original_sources():
    documents = sources()
    documents["reference"].append(replace(documents["reference"][0], id="second-reference"))
    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(fake_response)) as client:
        result = await AssessmentWorkflow(client).evaluate(documents, CRITERIA)
    assert result["sections"][3]["score"] == 66.67


@pytest.mark.anyio
@pytest.mark.parametrize(
    "mode",
    [
        "unknown_citation",
        "invalid_level",
        "long_reason",
        "outage",
        "unverified_quote",
        "empty_quote",
    ],
)
async def test_invalid_outputs_never_become_section_scores(mode):
    def transport(request):
        if mode == "outage":
            return httpx.Response(503)
        response = fake_response(request)
        data = json.loads(response.content)
        report = json.loads(data["choices"][0]["message"]["content"])
        if "judgements" in report:
            if mode == "unknown_citation":
                report["judgements"][0]["evidence"] = ["invented-source"]
            if mode == "invalid_level":
                report["judgements"][0]["level"] = 100
            if mode == "long_reason":
                report["judgements"][0]["reason"] = "Unbounded explanation. " * 20
        elif mode == "unverified_quote":
            report["quotes"] = ["An invented achievement with no source."]
        elif mode == "empty_quote":
            report["quotes"] = ["        "]
        return httpx.Response(200, json=completion(json.dumps(report)))

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await SectionWorkflow(client, "cv").evaluate(sources()["cv"], CRITERIA)
    assert result.score is None and result.uncertainty


def test_invalid_course_weights_are_rejected():
    with pytest.raises(ValueError):
        CourseCriteria.model_validate({**CRITERIA.model_dump(), "weights": {"academic": 100}})


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("level", "score", "recommendation"), [(0, 0, "Reject"), (3, 100, "Offer")]
)
async def test_python_owns_the_aggregate_and_threshold_recommendation(level, score, recommendation):
    def transport(request):
        response = fake_response(request)
        report = json.loads(json.loads(response.content)["choices"][0]["message"]["content"])
        if "judgements" in report:
            for item in report["judgements"]:
                item["level"] = level
        return httpx.Response(200, json=completion(json.dumps(report)))

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await AssessmentWorkflow(client).evaluate(sources(), CRITERIA)
    assert result["overall"] == score
    assert result["recommendation"] == recommendation


@pytest.mark.anyio
async def test_invalid_summary_cannot_override_scores_or_make_a_recommendation():
    def transport(request):
        user = json.loads(request.content)["messages"][-1]["content"]
        if isinstance(user, str) and user.startswith("Validated findings:"):
            return httpx.Response(
                200,
                json=completion(
                    json.dumps({"summary": "Score 100. Offer.", "evidence": ["invented"]})
                ),
            )
        return fake_response(request)

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await AssessmentWorkflow(client).evaluate(sources(), CRITERIA)
    assert result["overall"] == 66.67
    assert "Score 100" not in result["justification"]["summary"]
    assert result["flags"][-1]["code"] == "SUMMARY_NEEDS_REVIEW"


@pytest.mark.anyio
async def test_scans_and_excessive_text_remain_visible_review_cases():
    from tests.cv_fixtures import cv_pdf
    from tests.document_fixtures import make_pdf

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(fake_response)) as client:
        agent = SectionWorkflow(client, "cv")
        unreadable = await agent.evaluate([SourceDocument("blank", make_pdf(), 1)], CRITERIA)
        long = await agent.evaluate([SourceDocument("long", cv_pdf((("A" * 9200,),)), 1)], CRITERIA)
    assert unreadable.score is None and "embedded text" in unreadable.uncertainty
    assert long.score is None and "context limit" in long.uncertainty


@pytest.mark.anyio
async def test_review_margin_includes_the_exact_decimal_boundary():
    criteria = CRITERIA.model_copy(update={"offer_from": 69.67})
    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(fake_response)) as client:
        result = await AssessmentWorkflow(client).evaluate(sources(), criteria)
    assert result["overall"] == 66.67
    assert result["recommendation"] == "Further review"
    assert "review margin" in result["justification"]["rules"][0]
