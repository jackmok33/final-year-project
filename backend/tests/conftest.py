import pytest
from fastapi.testclient import TestClient

from app.main import create_app


def pytest_addoption(parser):
    parser.addoption(
        "--run-postgres", action="store_true", help="Run tests in the dedicated PostgreSQL test DB"
    )


def pytest_collection_modifyitems(config, items):
    if not config.getoption("--run-postgres"):
        skip = pytest.mark.skip(reason="Use --run-postgres with a dedicated TEST_DATABASE_URL")
        for item in items:
            if item.get_closest_marker("postgres") is not None:
                item.add_marker(skip)


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
