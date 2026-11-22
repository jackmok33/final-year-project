"""Generate a browser fixture or process one guarded browser test job."""

import argparse
import asyncio
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

import httpx

from app.assessments.english_test.config import PilotConfig, load_pilot_config
from app.assessments.english_test.graph import EnglishTestWorkflow
from app.assessments.english_test.worker import run_one
from app.db import create_db_engine, get_database_url, session_factory
from app.inference.client import InferenceClient
from app.inference.config import load_inference_config
from tests.database_safety import require_test_database
from tests.english_test_fixtures import RESULT, english_pdf
from tests.inference_fakes import SETTINGS, completion


async def process(live: bool) -> None:
    url = require_test_database(get_database_url("TEST_DATABASE_URL"), get_database_url())
    pilot = PilotConfig(
        frozenset({hashlib.sha256(english_pdf()).hexdigest()}), load_pilot_config().model_version
    )

    def transport(_request):
        return httpx.Response(200, json=completion(json.dumps(RESULT)))

    settings = load_inference_config().connection if live else SETTINGS
    if (
        settings is None
        or settings.provider != "qwen"
        or urlsplit(settings.base_url).hostname not in {"127.0.0.1", "::1", "localhost"}
    ):
        raise SystemExit("The browser pilot requires the private Qwen tunnel.")
    engine = create_db_engine(url)
    try:
        async with InferenceClient(
            settings, transport=None if live else httpx.MockTransport(transport)
        ) as client:
            if not await run_one(session_factory(engine), pilot, EnglishTestWorkflow(client)):
                raise SystemExit("No queued English-test job was found.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-fixture", type=Path)
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    if args.write_fixture:
        contents = english_pdf()
        args.write_fixture.write_bytes(contents)
        print(hashlib.sha256(contents).hexdigest())
    else:
        asyncio.run(process(args.live))
