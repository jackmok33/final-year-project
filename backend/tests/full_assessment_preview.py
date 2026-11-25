"""Generate synthetic uploads, run a preview, or process one queued test job."""

import argparse
import asyncio
import hashlib
from pathlib import Path

import httpx

from app.assessments.flow.config import AssessmentConfig
from app.assessments.flow.orchestrator import AssessmentWorkflow
from app.assessments.flow.worker import run_one
from app.assessments.shared.documents import SourceDocument
from app.db import create_db_engine, get_database_url, session_factory
from app.inference.client import InferenceClient
from app.inference.config import load_inference_config
from tests.database_safety import require_test_database
from tests.full_assessment_fixtures import CRITERIA, DOCUMENTS, fake_response
from tests.inference_fakes import SETTINGS


async def preview(live: bool, job: bool):
    settings = load_inference_config().connection if live else SETTINGS
    if settings is None or settings.provider != "qwen":
        raise SystemExit("Configure the private Qwen endpoint.")
    async with InferenceClient(
        settings, transport=None if live else httpx.MockTransport(fake_response)
    ) as client:
        workflow = AssessmentWorkflow(client)
        if job:
            url = require_test_database(get_database_url("TEST_DATABASE_URL"), get_database_url())
            engine = create_db_engine(url)
            try:
                hashes = frozenset(hashlib.sha256(data).hexdigest() for data in DOCUMENTS.values())
                if not await run_one(session_factory(engine), AssessmentConfig(hashes), workflow):
                    raise SystemExit("No queued test assessment was found.")
            finally:
                engine.dispose()
        else:
            import json

            documents = {
                kind: [SourceDocument(f"synthetic-{kind}", data, 1)]
                for kind, data in DOCUMENTS.items()
            }
            result = await workflow.evaluate(documents, CRITERIA)
            print(
                json.dumps(
                    {"previewMode": "live-qwen" if live else "simulated", **result}, indent=2
                )
            )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-dir", type=Path)
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--job", action="store_true")
    args = parser.parse_args()
    if args.write_dir:
        args.write_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        for kind, contents in DOCUMENTS.items():
            (args.write_dir / f"{kind}.pdf").write_bytes(contents)
        print(" ".join(hashlib.sha256(data).hexdigest() for data in DOCUMENTS.values()))
    else:
        asyncio.run(preview(args.live, args.job))
