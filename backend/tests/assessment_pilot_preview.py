"""Print results for built-in synthetic reports from the two-agent pilot."""

import argparse
import asyncio
import hashlib
import json
from urllib.parse import urlsplit

import httpx

from app.assessments.pilot import AssessmentPilot, PilotDocument
from app.inference.client import InferenceClient
from app.inference.config import load_inference_config
from tests.cv_fixtures import PROJECT, WORK, cv_pdf
from tests.english_test_fixtures import RESULT, english_pdf
from tests.inference_fakes import SETTINGS, completion


def preview_response(request: httpx.Request) -> httpx.Response:
    text = json.loads(request.content)["messages"][-1]["content"][0]["text"]
    if text.startswith("CV page 1 text:"):
        payload = {"facts": [{"category": "project", "quote": PROJECT}]}
    elif text.startswith("CV page 2 text:"):
        payload = {"facts": [{"category": "work_experience", "quote": WORK}]}
    elif text.startswith("Page 1 text:"):
        payload = RESULT
    else:
        raise AssertionError("Unexpected specialist input.")
    return httpx.Response(200, json=completion(json.dumps(payload)))


async def preview(live: bool) -> None:
    settings = load_inference_config().connection if live else SETTINGS
    if (
        settings is None
        or settings.provider != "qwen"
        or urlsplit(settings.base_url).hostname not in {"127.0.0.1", "::1", "localhost"}
    ):
        raise SystemExit("The pilot requires the configured private Qwen tunnel.")
    english = PilotDocument("synthetic-ielts", english_pdf(), 1)
    cv = PilotDocument("synthetic-cv", cv_pdf(), 2)
    async with InferenceClient(
        settings, transport=None if live else httpx.MockTransport(preview_response)
    ) as client:
        pilot = AssessmentPilot(
            client,
            english_hashes=frozenset({hashlib.sha256(english.contents).hexdigest()}),
            cv_hashes=frozenset({hashlib.sha256(cv.contents).hexdigest()}),
        )
        result = await pilot.evaluate(english_document=english, cv_document=cv)
    print(result.model_dump_json(indent=2, by_alias=True))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Use the private Qwen tunnel.")
    args = parser.parse_args()
    asyncio.run(preview(args.live))
