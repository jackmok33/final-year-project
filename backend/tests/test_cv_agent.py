"""Source and failure checks for the active CV specialist."""

import json

import httpx
import pytest

from app.assessments.shared.documents import SourceDocument
from app.assessments.shared.specialist import SectionWorkflow
from app.inference.client import InferenceClient
from tests.cv_fixtures import PROJECT, WORK, cv_pdf
from tests.full_assessment_fixtures import CRITERIA, DOCUMENTS, fake_response
from tests.inference_fakes import SETTINGS, completion


@pytest.mark.anyio
async def test_cv_quotes_keep_their_original_page_and_duplicate_quotes_are_removed():
    def transport(request):
        user = json.loads(request.content)["messages"][-1]["content"]
        if isinstance(user, list):
            text = user[0]["text"]
            quote = PROJECT if PROJECT in text else WORK
            report = {"quotes": [quote, quote]}
        else:
            report = json.loads(
                json.loads(fake_response(request).content)["choices"][0]["message"]["content"]
            )
            for item in report["judgements"]:
                item["evidence"] = ["cv-E1", "cv-E2"]
        return httpx.Response(200, json=completion(json.dumps(report)))

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await SectionWorkflow(client, "cv").evaluate(
            [SourceDocument("original-cv", cv_pdf(), 2)], CRITERIA
        )
    assert result.score == 66.67
    assert [(e.document_id, e.page, e.claim) for e in result.citations] == [
        ("original-cv", 1, PROJECT),
        ("original-cv", 2, WORK),
    ]


@pytest.mark.anyio
async def test_a_cv_quote_from_another_page_cannot_support_a_score():
    def transport(_request):
        return httpx.Response(200, json=completion(json.dumps({"quotes": [WORK]})))

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await SectionWorkflow(client, "cv").evaluate(
            [SourceDocument("original-cv", cv_pdf(), 2)], CRITERIA
        )
    assert result.score is None and result.citations == []
    assert "source page" in result.uncertainty


@pytest.mark.anyio
@pytest.mark.parametrize("report", [{"quotes": []}, {"quotes": [], "score": 100}])
async def test_empty_or_unexpected_cv_output_never_becomes_a_score(report):
    def transport(_request):
        return httpx.Response(200, json=completion(json.dumps(report)))

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await SectionWorkflow(client, "cv").evaluate(
            [SourceDocument("original-cv", DOCUMENTS["cv"], 1)], CRITERIA
        )
    assert result.score is None and result.uncertainty


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("contents", "page_count"),
    [(b"invalid", 1), (b"invalid", 13), (cv_pdf(((PROJECT,), ())), 2)],
)
async def test_unusable_cv_sources_do_not_reach_the_model(contents, page_count):
    def transport(_request):
        pytest.fail("An unreadable or out-of-bounds source must not reach the model.")

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await SectionWorkflow(client, "cv").evaluate(
            [SourceDocument("original-cv", contents, page_count)], CRITERIA
        )
    assert result.score is None and result.uncertainty
