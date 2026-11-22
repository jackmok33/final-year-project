"""Run one English-test worker: python -m app.assessments.english_test.worker."""

import asyncio
import logging

from app.api import ApiError
from app.assessments.english_test.config import PilotConfig, load_pilot_config
from app.assessments.english_test.graph import EnglishTestWorkflow
from app.assessments.english_test.jobs import claim, finish, load_report
from app.db import create_db_engine, session_factory
from app.inference.client import InferenceClient, InferenceError
from app.inference.config import load_inference_config

logger = logging.getLogger(__name__)


async def run_one(sessions, pilot: PilotConfig, workflow: EnglishTestWorkflow) -> bool:
    check = claim(sessions)
    if check is None:
        return False
    try:
        contents, pages = load_report(sessions, check, pilot)
        result = await workflow.evaluate(contents, pages)
    except asyncio.CancelledError:
        finish(sessions, check, error="interrupted")
        raise
    except TimeoutError:
        finish(sessions, check, error="timeout")
    except InferenceError as error:
        finish(sessions, check, error="timeout" if error.status_code == 504 else "unavailable")
    except ApiError:
        finish(sessions, check, error="source_unavailable")
    except Exception:
        logger.warning("An English-test check could not be processed.")
        finish(sessions, check, error="processing_error")
    else:
        finish(sessions, check, outcome=result)
    return True


async def run() -> None:
    pilot = load_pilot_config()
    if not pilot.document_hashes:
        raise SystemExit(
            "Configure the synthetic English-test PDF hashes before starting the worker."
        )
    inference = load_inference_config().connection
    if inference is None or inference.provider != "qwen":
        raise SystemExit("The English-test worker requires the configured Qwen endpoint.")
    engine = create_db_engine()
    try:
        sessions = session_factory(engine)
        async with InferenceClient(inference) as client:
            workflow = EnglishTestWorkflow(client)
            while True:
                try:
                    if await run_one(sessions, pilot, workflow):
                        continue
                except ApiError:
                    logger.warning("English-test storage is unavailable. The worker will retry.")
                await asyncio.sleep(1)
    finally:
        engine.dispose()


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass
