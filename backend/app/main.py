import os
import threading
from contextlib import AsyncExitStack, asynccontextmanager

import anyio
import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.document_config import load_document_access
from app.document_errors import DocumentError
from app.document_routes import router as document_router
from app.inference_config import load_inference_config
from app.inference_routes import router as inference_router
from app.routes import router
from app.services.inference import InferenceClient


def create_app(*, inference_transport: httpx.AsyncBaseTransport | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        config = load_inference_config()
        app.state.document_access = load_document_access()
        app.state.document_database_lock = threading.Lock()
        app.state.document_database = None
        app.state.document_sessions = None
        app.state.document_upload_slots = anyio.CapacityLimiter(2)
        app.state.inference_probe_enabled = config.probe_enabled
        app.state.inference_client = None
        try:
            async with AsyncExitStack() as stack:
                if config.connection is not None:
                    app.state.inference_client = await stack.enter_async_context(
                        InferenceClient(config.connection, transport=inference_transport)
                    )
                yield
        finally:
            app.state.inference_client = None
            if app.state.document_database is not None:
                app.state.document_database.dispose()
            app.state.document_sessions = None
            app.state.document_database = None

    app = FastAPI(
        title="UCL Application Review API · Development scaffold",
        version="0.4.0",
        description=(
            "Synthetic assessments, optional inference probes and token-protected PDF storage. "
            "No browser login integration or real admissions assessment."
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
        allow_headers=["Content-Type", "Authorization"],
    )
    app.include_router(router)
    app.include_router(inference_router)
    app.include_router(document_router)

    @app.exception_handler(DocumentError)
    async def document_error_handler(request: Request, error: DocumentError):
        headers = {"Cache-Control": "private, no-store"}
        if error.status_code == 401:
            headers["WWW-Authenticate"] = "Bearer"
        return JSONResponse(
            {"detail": {"code": error.code, "message": error.message}},
            status_code=error.status_code,
            headers=headers,
        )

    return app


app = create_app()
