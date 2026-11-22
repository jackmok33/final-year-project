import hashlib
import json

import httpx
import pytest

from app.assessments.cv.workflow import CvWorkflow
from app.assessments.pilot import AssessmentPilot, PilotDocument
from app.inference.client import InferenceClient
from tests.assessment_pilot_preview import preview_response
from tests.cv_fixtures import PROJECT, WORK, cv_pdf
from tests.english_test_fixtures import english_pdf
from tests.inference_fakes import SETTINGS, completion


def hashes(document):
    return frozenset({hashlib.sha256(document.contents).hexdigest()})


@pytest.mark.anyio
@pytest.mark.parametrize("english_available", [True, False])
async def test_pilot_routes_separate_evidence_in_order_and_keeps_other_results(english_available):
    english = PilotDocument("report-1", english_pdf(), 1)
    cv = PilotDocument("cv-1", cv_pdf(), 2)
    calls = []

    def transport(request):
        text, image = json.loads(request.content)["messages"][-1]["content"]
        assert image["image_url"]["url"].startswith("data:image/png;base64,")
        value = text["text"]
        if "CV page" in value:
            assert "IELTS Academic" not in value
        else:
            assert PROJECT not in value and WORK not in value
        calls.append(value.splitlines()[0])
        return (
            httpx.Response(503)
            if not english_available and len(calls) == 1
            else preview_response(request)
        )

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        pilot = AssessmentPilot(client, english_hashes=hashes(english), cv_hashes=hashes(cv))
        result = await pilot.evaluate(english_document=english, cv_document=cv)

    assert calls == ["Page 1 text:", "CV page 1 text:", "CV page 2 text:"]
    assert result.english.document_id == english.id
    if english_available:
        assert result.english.evidence is not None
        assert result.english.evidence.eligibility.outcome == "meets_requirement"
    else:
        assert result.english.status == "unavailable"
    assert result.cv.document_id == cv.id
    assert result.cv.evidence is not None
    assert result.cv.evidence.status == "complete"
    assert [(fact.quote, fact.page) for fact in result.cv.evidence.facts] == [
        (PROJECT, 1),
        (WORK, 2),
    ]


@pytest.mark.anyio
async def test_missing_and_unallowlisted_documents_never_reach_qwen():
    def transport(_request):
        pytest.fail("Documents must pass the pilot's separate allowlists.")

    english = PilotDocument("report-1", english_pdf(), 1)
    cv = PilotDocument("cv-1", cv_pdf(), 2)
    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        pilot = AssessmentPilot(client, english_hashes=hashes(english), cv_hashes=hashes(english))
        result = await pilot.evaluate(english_document=None, cv_document=cv)
    assert result.english.status == "missing_document"
    assert result.cv.status == "outside_pilot"


@pytest.mark.anyio
async def test_cv_keeps_verified_facts_and_flags_wrong_page_and_no_text():
    def transport(_request):
        payload = {
            "facts": [
                {"category": "project", "quote": PROJECT},
                {"category": "work_experience", "quote": WORK},
                {"category": "project", "quote": PROJECT},
            ]
        }
        return httpx.Response(200, json=completion(json.dumps(payload)))

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await CvWorkflow(client).evaluate(cv_pdf(((PROJECT,), ())), 2)
    assert result.status == "needs_review"
    assert [(fact.quote, fact.page) for fact in result.facts] == [(PROJECT, 1)]
    assert [(issue.page, issue.reason) for issue in result.issues] == [
        (1, "unverified_quote"),
        (2, "no_embedded_text"),
    ]


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("status", "output", "reason"),
    [
        (200, {"facts": [], "score": 100}, "invalid_output"),
        (200, {"facts": []}, "no_evidence"),
        (503, {}, "inference_unavailable"),
    ],
)
async def test_cv_returns_review_reason_for_an_unusable_model_result(status, output, reason):
    def transport(_request):
        return httpx.Response(status, json=completion(json.dumps(output)))

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await CvWorkflow(client).evaluate(cv_pdf(((PROJECT,),)), 1)
    assert result.status == "needs_review"
    assert result.facts == []
    assert result.issues[0].reason == reason


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("contents", "page_count", "reason"),
    [(b"invalid", 1, "unreadable_cv"), (b"invalid", 3, "unsupported_page_count")],
)
async def test_cv_skips_inference_for_unsupported_or_unreadable_pdf(contents, page_count, reason):
    def transport(_request):
        pytest.fail("Unusable CVs must not reach Qwen.")

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await CvWorkflow(client).evaluate(contents, page_count)
    assert result.status == "needs_review"
    assert result.issues[0].reason == reason
