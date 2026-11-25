"""Process full assessment jobs locally using the private Qwen endpoint."""

import asyncio
import logging

from app.api import ApiError
from app.assessments.english_test.config import PilotConfig, load_pilot_config
from app.assessments.english_test.graph import EnglishTestWorkflow
from app.assessments.english_test.worker import run_one as run_english_check
from app.assessments.flow.config import load_assessment_config
from app.assessments.flow.jobs import claim, finish, load_inputs
from app.assessments.flow.orchestrator import AssessmentWorkflow
from app.db import create_db_engine, session_factory
from app.inference.client import InferenceClient
from app.inference.config import load_inference_config

logger = logging.getLogger(__name__)


async def run_one(sessions, config, workflow):
    job = claim(sessions)
    if job is None:
        return False
    try:
        if job.inputs["workflowHash"] != workflow.fingerprint:
            raise ValueError("Restart the worker after changing the prompts or rubrics.")
        documents, criteria = load_inputs(sessions, job, config)
        result = await workflow.evaluate(documents, criteria)
    except asyncio.CancelledError:
        finish(sessions, job, error="The assessment worker was interrupted.")
        raise
    except (ApiError, ValueError, TimeoutError):
        finish(sessions, job, error="The assessment could not finish. Check sources and retry.")
    except Exception:
        logger.warning("The assessment could not be processed.")
        finish(sessions, job, error="The assessment worker failed. Retry the evaluation.")
    else:
        finish(sessions, job, result=result)
    return True


async def run():
    config = load_assessment_config()
    inference = load_inference_config().connection
    if not config.document_hashes or inference is None or inference.provider != "qwen":
        raise SystemExit("Configure synthetic PDF hashes and the private Qwen endpoint.")
    engine = create_db_engine()
    try:
        sessions = session_factory(engine)
        async with InferenceClient(inference) as client:
            workflow = AssessmentWorkflow(client)
            english_workflow = EnglishTestWorkflow(client)
            english_pilot = PilotConfig(
                config.document_hashes | load_pilot_config().document_hashes,
                config.model_version,
            )
            while True:
                try:
                    if await run_one(sessions, config, workflow):
                        continue
                    if await run_english_check(sessions, english_pilot, english_workflow):
                        continue
                except ApiError:
                    logger.warning("Assessment storage is unavailable. The worker will retry.")
                await asyncio.sleep(1)
    finally:
        engine.dispose()


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass
