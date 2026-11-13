"""Opt-in synthetic connectivity checks, independent of admissions assessments."""

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from app.schemas import InferenceProbeRequest, InferenceProbeResponse
from app.services.qwen import InferenceError, QwenClient

router = APIRouter(prefix="/api/v1/inference", tags=["Development inference probe"])
PROBE_IMAGE = Path(__file__).resolve().parent / "fixtures/qwen-probe.png"
IMAGE_FACTS = {
    "applicant_id": "SYNTHETIC-001",
    "programme": "Computer Science",
    "grade_percent": 82,
}


def get_probe_client(request: Request) -> QwenClient:
    if not getattr(request.app.state, "inference_probe_enabled", False):
        raise HTTPException(
            404,
            detail={
                "code": "INFERENCE_PROBE_DISABLED",
                "message": "The development probe is disabled.",
            },
        )
    client = getattr(request.app.state, "qwen_client", None)
    if client is None:
        raise HTTPException(
            503,
            detail={
                "code": "INFERENCE_NOT_CONFIGURED",
                "message": "Configure the backend Qwen endpoint and API key.",
            },
        )
    return client


@router.post(
    "/probe",
    response_model=InferenceProbeResponse,
    responses={
        404: {"description": "Development probe disabled"},
        502: {"description": "Upstream credentials, response format or probe check failed"},
        503: {"description": "Qwen unconfigured, unreachable, busy or model unavailable"},
        504: {"description": "Qwen request deadline exceeded"},
    },
)
async def probe(
    request: InferenceProbeRequest,
    client: Annotated[QwenClient, Depends(get_probe_client)],
) -> InferenceProbeResponse:
    """Fixed synthetic requests only. Disabled by default; run the backend on loopback."""
    try:
        await client.check_model()
        if request.mode == "text":
            result = await client.generate(
                "Reply with exactly QWEN_CONNECTION_OK and nothing else."
            )
            matched = result.text.strip() == "QWEN_CONNECTION_OK"
        elif request.mode == "json":
            result = await client.generate(
                'Return exactly this JSON object: {"connection":"ok"}.', json_output=True
            )
            matched = result.data == {"connection": "ok"}
        else:
            result = await client.generate(
                "Read the synthetic document image. Return only a JSON object with "
                "applicant_id, programme and grade_percent (a number).",
                image_png=PROBE_IMAGE.read_bytes(),
                json_output=True,
            )
            matched = result.data == IMAGE_FACTS
        if not matched:
            raise InferenceError(
                "INFERENCE_PROBE_MISMATCH", "Qwen responded but did not pass the synthetic probe."
            )
    except InferenceError as error:
        raise HTTPException(
            error.status_code, detail={"code": error.code, "message": str(error)}
        ) from None
    return InferenceProbeResponse(
        mode=request.mode,
        model=result.model,
        text=result.text,
        data=result.data,
        usage=result.usage,
    )
