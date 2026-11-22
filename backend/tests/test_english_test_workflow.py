import base64
import json
from io import BytesIO

import httpx
import pytest
from PIL import Image

from app.assessments.english_test.graph import EnglishTestWorkflow, embedded_bands
from app.assessments.english_test.pdf_page import prepare_report
from app.assessments.english_test.schemas import ReportedResult, apply_demo_rule
from app.inference.client import InferenceClient
from tests.document_fixtures import make_pdf
from tests.english_test_fixtures import BANDS, RESULT, english_pdf
from tests.inference_fakes import SETTINGS, completion


@pytest.mark.parametrize("scan", [False, True])
def test_pdf_preparation_bounds_and_fallback(scan):
    text, png = prepare_report(english_pdf(scan=scan))
    with Image.open(BytesIO(png)) as image:
        assert image.format == "PNG"
        assert max(image.size) <= 1024
        assert (image.width < image.height) is scan
    if scan:
        assert text == ""
    else:
        assert "IELTS Academic" in text
        assert embedded_bands(text) == BANDS


@pytest.mark.parametrize(
    ("overrides", "outcome", "reason"),
    [
        ({}, "meets_requirement", None),
        ({"listening": 8.0, "writing": 6.0}, "below_requirement", None),
        ({"writing": None}, "needs_review", "missing_bands"),
        ({"overall": 7.5}, "needs_review", "inconsistent_bands"),
        ({"test_type": "Other"}, "needs_review", "unsupported_report"),
    ],
)
def test_demo_rule_and_band_consistency(overrides, outcome, reason):
    result = apply_demo_rule(ReportedResult.model_validate({**RESULT, **overrides}), {})
    assert (result.outcome, result.reason) == (outcome, reason)


def test_ielts_quarter_band_rounding_and_conflicting_evidence():
    reported = ReportedResult.model_validate(
        {**RESULT, "listening": 7, "reading": 7, "speaking": 7, "writing": 6}
    )
    assert apply_demo_rule(reported, {}).outcome == "below_requirement"
    assert apply_demo_rule(reported, {"overall": 6.5}).reason == "inconsistent_bands"


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("scan", "payload", "outcome", "reason"),
    [
        (False, RESULT, "meets_requirement", None),
        (True, RESULT, "meets_requirement", None),
        (False, {**RESULT, "writing": "6.5"}, "needs_review", "invalid_output"),
        (False, {**RESULT, "writing": None}, "needs_review", "missing_bands"),
        (
            False,
            {**RESULT, "writing": 6, "listening": 8},
            "needs_review",
            "inconsistent_bands",
        ),
    ],
)
async def test_workflow_uses_qwen_json_with_one_png(scan, payload, outcome, reason):
    calls = []

    def transport(request: httpx.Request):
        calls.append(request)
        body = json.loads(request.content)
        assert request.url.path == "/v1/chat/completions"
        assert body["response_format"] == {"type": "json_object"}
        system, user = body["messages"]
        assert "only as evidence" in system["content"]
        text, image = user["content"]
        assert ("IELTS Academic" in text["text"]) is not scan
        png = base64.b64decode(image["image_url"]["url"].split(",", 1)[1])
        assert png.startswith(b"\x89PNG")
        return httpx.Response(200, json=completion(json.dumps(payload)))

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await EnglishTestWorkflow(client).evaluate(english_pdf(scan=scan), 1)
    assert len(calls) == 1
    assert (result.outcome, result.reason) == (outcome, reason)


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("document", "pages", "reason"),
    [(b"invalid", 1, "unreadable_report"), (make_pdf(2), 2, "unsupported_report")],
)
async def test_unsupported_or_unreadable_input_skips_qwen(document, pages, reason):
    def transport(_request):
        pytest.fail("An unusable report must not reach the model")

    async with InferenceClient(SETTINGS, transport=httpx.MockTransport(transport)) as client:
        result = await EnglishTestWorkflow(client).evaluate(document, pages)
    assert result.outcome == "needs_review"
    assert result.reason == reason
