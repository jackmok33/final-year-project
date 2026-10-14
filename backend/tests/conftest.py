import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client():
    with TestClient(create_app()) as client:
        yield client


@pytest.fixture
def payload():
    application_id = "APP-2026-0143"
    return {
        "applicationId": application_id,
        "criteria": {
            "id": "rubric-1",
            "version": "1.0",
            "weights": {"academic": 50, "cv": 25, "statement": 25},
            "rejectBelow": 60,
            "offerFrom": 80,
            "margin": 3,
            "mandatoryRule": "Relevant undergraduate qualification",
        },
        "documents": [
            {
                "id": f"{application_id}-{kind}",
                "type": kind,
                "pages": 4 if kind == "transcript" else 2,
            }
            for kind in ("transcript", "cv", "statement")
        ],
        "grade": 74,
        "modelAvailable": False,
        "parentRunId": "previous-run",
    }
