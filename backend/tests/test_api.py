import pytest

from app.routes import get_evaluation_service

ENDPOINT = "/api/v1/mock/assessments"


def case(payload, application_id):
    payload["applicationId"] = application_id
    for doc in payload["documents"]:
        doc["id"] = f"{application_id}-{doc['type']}"
    return payload


def test_health_is_honest_about_unimplemented_dependencies(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "mode": "mock",
        "service": "ucl-application-review-api",
        "database": "not configured",
        "inference": "not configured",
    }


@pytest.mark.parametrize(
    "application_id,expected_score,outcome",
    [
        ("APP-2026-0143", 88.5, "Offer"),
        ("APP-2026-0144", 47, "Reject"),
        ("APP-2026-0142", 78.4, "Further review"),
        ("APP-2026-0147", 88.5, "Offer"),
    ],
)
def test_assessment_contract_and_source_links(
    client, payload, application_id, expected_score, outcome
):
    response = client.post(ENDPOINT, json=case(payload, application_id))
    assert response.status_code == 200
    run = response.json()
    assert run["applicationId"] == application_id
    assert run["rubricId"] == "rubric-1"
    assert run["parentRunId"] == "previous-run"
    assert run["overall"] == expected_score
    assert run["recommendation"] == outcome
    assert run["simulated"] is True
    assert run["evaluationSource"] == "fastapi-mock"
    assert run["status"] == "awaiting review"
    assert len(run["justification"]["citations"]) == 3
    assert run["justification"]["citations"][0]["documentId"] == f"{application_id}-transcript"
    assert run["justification"]["citations"][0]["page"] == 2
    assert "Criteria v1.0" in run["justification"]["summary"]
    assert "not AI output" in run["justification"]["summary"]
    assert client.post(ENDPOINT, json=payload).json()["id"] != run["id"]


def test_critical_grade_mismatch_blocks_offer_even_above_threshold(client, payload):
    case(payload, "APP-2026-0142")
    payload["grade"] = 71
    payload["criteria"]["offerFrom"] = 70
    run = client.post(ENDPOINT, json=payload).json()
    assert run["overall"] == 78.4
    assert run["recommendation"] == "Further review"
    assert run["flags"][0]["code"] == "GRADE_MISMATCH"
    assert "74% on page 2" in run["justification"]["summary"]


def test_missing_evidence_is_null_not_zero(client, payload):
    case(payload, "APP-2026-0145")
    payload["documents"].pop()
    run = client.post(ENDPOINT, json=payload).json()
    assert run["overall"] is None
    assert run["sections"][2]["score"] is None
    assert run["sections"][2]["citations"] == []
    assert run["recommendation"] == "Further review"
    assert run["flags"][0]["code"] == "MISSING_DOCUMENT"


@pytest.mark.parametrize("available", [True, False])
def test_mock_failure_and_recovery(client, payload, available):
    case(payload, "APP-2026-0146")
    payload["modelAvailable"] = available
    run = client.post(ENDPOINT, json=payload).json()
    assert run["status"] == ("awaiting review" if available else "failed")
    assert run["overall"] == (78.4 if available else None)
    assert run["error"] == (None if available else "MODEL_UNAVAILABLE")
    if not available:
        assert all(s["citations"] == [] for s in run["sections"])


@pytest.mark.parametrize("grade", [None, 79])
def test_unsupported_corrections_never_get_fabricated_scores(client, payload, grade):
    case(payload, "APP-2026-0142")
    payload["grade"] = grade
    run = client.post(ENDPOINT, json=payload).json()
    assert run["overall"] is None
    assert run["extractedGrade"] is None
    assert all(s["score"] is None and not s["citations"] for s in run["sections"])
    assert run["recommendation"] == "Further review"
    assert all(flag["code"] != "GRADE_MISMATCH" for flag in run["flags"])


@pytest.mark.parametrize(
    "threshold,outcome", [(91.5, "Further review"), (95, "Further review"), (99, "Further review")]
)
def test_read_only_criteria_context_controls_routing(client, payload, threshold, outcome):
    payload["criteria"]["version"] = "saved-version"
    payload["criteria"]["offerFrom"] = threshold
    run = client.post(ENDPOINT, json=payload).json()
    assert run["recommendation"] == outcome
    assert "saved-version" in run["justification"]["summary"]


def test_threshold_margins_are_inclusive(client, payload):
    payload["criteria"]["rejectBelow"] = 91.5
    payload["criteria"]["offerFrom"] = 99
    run = client.post(ENDPOINT, json=payload).json()
    assert run["recommendation"] == "Further review"
    payload["criteria"]["rejectBelow"] = 91.51
    assert client.post(ENDPOINT, json=payload).json()["recommendation"] == "Reject"


def test_does_not_accept_real_uploads_or_other_document_references(client, payload):
    assert client.post(ENDPOINT, json=case(payload, "new-upload")).status_code == 422
    case(payload, "APP-2026-0143")
    payload["documents"][0]["id"] = "other-application-transcript"
    assert client.post(ENDPOINT, json=payload).status_code == 422
    payload["candidate"] = "Not an accepted request field"
    assert client.post(ENDPOINT, json=payload).status_code == 422


@pytest.mark.parametrize(
    "field,value",
    [
        ("weights", {"academic": 60, "cv": 25, "statement": 25}),
        ("weights", {"academic": 100}),
        ("weights", {"academic": -1, "cv": 50, "statement": 51}),
        ("offerFrom", 30),
        ("rejectBelow", -1),
        ("margin", -1),
        ("mandatoryRule", "   "),
    ],
)
def test_invalid_criteria_returns_validation_error(client, payload, field, value):
    payload["criteria"][field] = value
    assert client.post(ENDPOINT, json=payload).status_code == 422


@pytest.mark.parametrize("mutation", ["duplicate", "too_many_pages", "fractional", "zero", "grade"])
def test_invalid_evidence_and_grade(client, payload, mutation):
    if mutation == "duplicate":
        payload["documents"][1] = payload["documents"][0].copy()
    elif mutation == "too_many_pages":
        payload["documents"][0]["pages"] = 100
    elif mutation == "fractional":
        payload["documents"][0]["pages"] = 1.5
    elif mutation == "zero":
        payload["documents"][0]["pages"] = 0
    else:
        payload["grade"] = 101
    assert client.post(ENDPOINT, json=payload).status_code == 422


def test_cors_allows_local_frontend_and_rejects_other_origins(client):
    for origin, allowed in [("http://127.0.0.1:5173", True), ("https://example.com", False)]:
        response = client.options(
            ENDPOINT,
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == (200 if allowed else 400)
        assert ("access-control-allow-origin" in response.headers) == allowed


def test_evaluator_is_replaceable_through_dependency_injection(client, payload):
    class Replacement:
        def evaluate(self, request):
            from app.services.evaluation import UnsupportedMockCase

            raise UnsupportedMockCase("Replacement evaluator called")

    client.app.dependency_overrides[get_evaluation_service] = Replacement
    response = client.post(ENDPOINT, json=payload)
    assert response.json()["detail"] == "Replacement evaluator called"


def test_openapi_documents_the_contract(client):
    schema = client.get("/openapi.json").json()
    assert ENDPOINT in schema["paths"]
    assert "criteria" in schema["components"]["schemas"]["MockAssessmentRequest"]["properties"]
    assert "evaluationSource" in schema["components"]["schemas"]["AssessmentRun"]["properties"]
