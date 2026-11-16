import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.inference_config import load_inference_config
from app.inference_routes import router as inference_router
from app.routes import router
from app.services.inference import InferenceClient


def create_app(*, inference_transport: httpx.AsyncBaseTransport | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        config = load_inference_config()
        app.state.inference_probe_enabled = config.probe_enabled
        app.state.inference_client = None
        if config.connection is None:
            yield
        else:
            async with InferenceClient(config.connection, transport=inference_transport) as client:
                app.state.inference_client = client
                try:
                    yield
                finally:
                    app.state.inference_client = None

    app = FastAPI(
        title="UCL Application Review API · Development scaffold",
        version="0.3.0",
        description=(
            "Synthetic assessments and an opt-in Qwen/OpenAI connection probe. "
            "No authentication, persistent application API or real admissions assessment."
        ),
        lifespan=lifespan,
    )
    origins = os.environ.get(
        "UCL_CORS_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    app.include_router(router)
    app.include_router(inference_router)
    return app


app = create_app()
