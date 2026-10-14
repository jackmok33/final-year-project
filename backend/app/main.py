import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import router


def create_app() -> FastAPI:
    app = FastAPI(
        title="UCL Application Review API · Mock scaffold",
        version="0.1.0",
        description=(
            "Synthetic fixtures only. No authentication, database, PDF assessment or AI inference."
        ),
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
    return app


app = create_app()
