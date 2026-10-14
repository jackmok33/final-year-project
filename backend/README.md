# FastAPI mock scaffold

This milestone proves **React → FastAPI → assessment response → existing review UI**.
It is a local, stateless scaffold using predefined synthetic cases. No PostgreSQL,
SQLAlchemy, LangChain, LangGraph, Qwen, real authentication or PDF assessment is
connected. The existing browser dataset and original PDFs are preserved.

## Start

Use Python 3.11 or newer. From the project root:

```sh
python3 -m venv /tmp/ucl-backend-venv
source /tmp/ucl-backend-venv/bin/activate
pip install -r backend/requirements.txt
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The virtual environment is outside the OneDrive project. `requirements.txt`
pins the runtime and test dependencies used for this scaffold.

- Health: <http://127.0.0.1:8000/api/v1/health>
- Interactive API documentation: <http://127.0.0.1:8000/docs>
- OpenAPI contract: <http://127.0.0.1:8000/openapi.json>

In another terminal, enable the optional frontend adapter:

```sh
cd frontend
cp .env.example .env.local
npm run dev
```

Use Node 24+. Restart Vite after changing `.env.local`. Sign in as Jack, open
`APP-2026-0143`, and choose **Re-evaluate demo case**. The frontend sends an HTTP
request and renders the returned score (88.5), Offer recommendation, explanation
and source-page links. The connection notice labels the run as a FastAPI mock.
The original run remains in history; refresh and browser backup/restore retain
both runs. Removing `VITE_API_BASE_URL` restores standalone browser evaluation.

## Small API contract

| Endpoint | Behaviour |
| --- | --- |
| `GET /api/v1/health` | Confirms FastAPI is reachable; reports mock mode, database/inference not configured. |
| `POST /api/v1/mock/assessments` | Validates synthetic case/document references and read-only criteria context, then returns an assessment run. |

The POST body contains `applicationId`, `criteria` (ID, version, weights,
thresholds, margin and entry rule), `documents` (IDs, types and page counts),
`grade`, `modelAvailable` and optional `parentRunId`. The frontend does **not**
send applicant names, tutor notes or PDF bytes. The context does not edit or
activate criteria; all frontend criteria remain read-only.

Only the six existing `APP-2026-0142`–`APP-2026-0147` synthetic IDs and matching
document references are supported. Offer, Reject, Further review, missing evidence
and simulated model failure/recovery are covered. Only known fixture grades have
scores; unsupported corrections return no fabricated assessment. Critical/missing
evidence takes precedence over thresholds. Values are examples, not UCL policy.

Responses use the existing frontend `AssessmentRun` shape with
`evaluationSource: "fastapi-mock"` and `simulated: true`. Nullable scores remain
null. Results are computed synchronously and returned as `awaiting review` or
`failed`; there is no job queue, worker or server-side run storage yet.

The endpoint is unauthenticated and intended only for local synthetic integration
tests. It exposes no applicant records, original PDFs or decision operations.
Existing tutor/programme checks run in the browser demo before a request, and
are not server authentication. CORS permits local development/preview origins;
override the comma-separated `UCL_CORS_ORIGINS` for a different local port.

## Structure and next integration boundaries

```text
app/main.py                 App factory and CORS configuration
app/routes.py               HTTP routes and evaluator dependency
app/schemas.py              Validated requests/responses and OpenAPI models
app/services/evaluation.py  EvaluationService protocol, mock evaluator and scoring
tests/                      HTTP validation, fixtures, routing and replacement tests
```

`get_evaluation_service()` is the replacement seam for a future evaluator. The
frontend transport lives in `src/services/backend.ts`; `evaluation.ts` selects
HTTP or browser fixtures, while RTK Query and the demo service retain UI state,
permissions and persistence. A configured backend failure surfaces an error and
does not silently fall back to locally generated scores or save a partial run.
Newly uploaded PDFs stay in the explicit real-assessment-unavailable path.

Later milestones can move workspace/application/document/history persistence
to PostgreSQL (including linked original PDF `bytea` rows), introduce real server
authentication, and add the evaluation worker and separate inference endpoint.
The mock request accepts browser criteria context only for this transition;
the full backend must load trusted criteria and document identities itself.
This small contract is not the final API for the entire application.

## Checks

With the virtual environment activated:

```sh
cd backend
python -m pytest -q
ruff check .
ruff format --check .
```

The real HTTP browser test starts its own FastAPI/Vite servers on ports 8001/5174:

```sh
cd frontend
npm run test:e2e:backend
```

The test's `python3` must have these dependencies; alternatively set
`UCL_BACKEND_PYTHON` to the virtual environment's Python executable. It verifies
the HTTP response, visible result, refresh, original PDF citation navigation,
accessibility and an unavailable-backend error. Existing unit tests run without a
backend; the normal eight-workflow browser suite exercises standalone demo mode.

Verified on 14 October 2026: 31 Python tests, Ruff lint/format checks and both
desktop/mobile HTTP browser checks passed. The frontend's 337 tests and original
eight browser workflows also passed; see [verification record](../frontend/VERIFICATION.md).

The scaffold uses FastAPI's documented [response models](https://fastapi.tiangolo.com/tutorial/response-model/),
[dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/),
[CORS middleware](https://fastapi.tiangolo.com/tutorial/cors/) and
[TestClient workflow](https://fastapi.tiangolo.com/tutorial/testing/).
