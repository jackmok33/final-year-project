# FastAPI backend and PostgreSQL foundation

This milestone proves **React → FastAPI → assessment response → existing review UI**.
The HTTP API is a local, stateless scaffold using predefined synthetic cases.
An independent PostgreSQL foundation now stores accounts, workspaces, applications
and original PDF bytes. The HTTP routes do not use it yet. LangChain, LangGraph,
Qwen, real authentication and PDF assessment are not connected. The existing
browser dataset, histories, session data and original PDFs are preserved.

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
`APP-2026-0143`, and choose **Re-evaluate application**. The frontend sends an HTTP
request and renders the returned score (88.5), Offer recommendation, explanation
and source-page links. Runs retain `evaluationSource: "fastapi-mock"` in their
saved data; the frontend no longer displays a connection notice.
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
send applicant names, tutor notes or PDF bytes. Course owners can edit numeric
criteria in the browser and save a new version. The endpoint uses the supplied
criteria context for that assessment; it does not store or activate criteria.

Only the six original `APP-2026-0142`–`APP-2026-0147` IDs, the three
`SAMPLE-CSML-01`–`SAMPLE-CSML-03` cases and matching
document references are supported. Offer, Reject, Further review, missing evidence
and simulated model failure/recovery are covered. Only known fixture grades have
scores; unsupported corrections return no fabricated assessment. Critical/missing
evidence takes precedence over thresholds. Values are examples, not UCL policy.
The earlier sample references `APP-2026-0148`–`APP-2026-0150` remain accepted for
browser datasets already saved with those references. New samples use the
separate `SAMPLE-CSML` namespace; ordinary uploaded applications are not fixtures.

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
app/db.py                  Lazy database configuration, engine, sessions and ORM base
app/models/                Five SQLAlchemy table models and relationships
app/seed.py                Explicit empty-dataset demo bootstrap
alembic/                   Versioned table migrations, independent of app startup
compose.yaml               Local PostgreSQL 18.6 and persistent named volume
tests/                     HTTP/configuration tests and opt-in PostgreSQL integration tests
```

`get_evaluation_service()` is the replacement seam for a future evaluator. The
frontend transport lives in `src/services/backend.ts`; `evaluation.ts` selects
HTTP or browser fixtures, while RTK Query and the demo service retain UI state,
permissions and persistence. A configured backend failure surfaces an error and
does not silently fall back to locally generated scores or save a partial run.
Newly uploaded PDFs stay in the explicit real-assessment-unavailable path.

The next milestone can add PDF upload/download services and connect frontend
workspace/application/document persistence to these tables. Assessment runs,
fixed criteria, decisions and correction history remain later MVP milestones,
along with real server authentication and the worker/inference endpoint.
The mock request accepts browser criteria context only for this transition;
the full backend must load trusted criteria and document identities itself.
This small contract is not the final API for the entire application.

## PostgreSQL: start, migrate and seed

The database is optional for the current mock API. Install the pinned dependencies
as above, start Docker Desktop, and run the following **from `backend/`**:

```sh
cp .env.example .env
# Edit .env: replace change-me in POSTGRES_PASSWORD and both database URLs.
docker compose up -d --wait
alembic upgrade head
python -m app.seed
```

Keep `.env` private; it is ignored by Git. Only placeholders are committed.
`DATABASE_URL` uses `postgresql+psycopg://...`; process environment overrides the
backend `.env` file. Change `POSTGRES_PORT` and both URL ports together if 5432 is
occupied. The host binding stays on `127.0.0.1`. Changing an existing volume's
password in `.env` does not change PostgreSQL's saved credentials.

Docker uses the official `postgres:18.6` image with a readiness check. The named
volume `ucl-application-review_postgres_data` mounts at `/var/lib/postgresql`,
inside Docker's storage outside the OneDrive checkout. PostgreSQL 18 places its
cluster beneath that directory. No host database directory is mounted in the repo.
`docker compose down` stops/removes the container while retaining the volume;
`docker compose up -d --wait` recreates it with the same data. `down -v` destroys
the volume and is not part of normal startup or verification.

Migrations create five domain tables plus Alembic's technical `alembic_version`.
FastAPI never creates tables, runs migrations or seeds data. SQLAlchemy models
describe database rows; `app/schemas.py` remains the separate HTTP contract.
New model instances receive UUID strings on insert; existing IDs such as
`tutor-a`, `programme-1` and `APP-2026-0143` are supported.

| Table | Purpose and key rules |
| --- | --- |
| `users` | Unique normalized email, at least one of tutor/admin, active flag. Both roles may be true. No passwords or sign-in implementation. |
| `programmes` | Named workspace, case-insensitive unique code, optional creator ownership. Names can repeat. |
| `programme_memberships` | Composite `(user_id, programme_id)` key; assignment and ownership are separate. |
| `applications` | Workspace, candidate reference and submitting tutor. Candidate references can repeat. No assessment fields. |
| `documents` | Original `bytea` plus metadata. At most one transcript/CV/statement per application. |

Database constraints enforce non-blank required labels, trimmed names/codes,
lowercase trimmed emails, foreign keys, document type, canonical PDF MIME type,
file sizes from one byte through 20 MiB, 1–100 pages, lowercase 64-character
hexadecimal hashes and exact stored byte length. Hashes are not unique. PDF
readability, calculating the true hash and the **combined 100-page application limit** must be enforced by
the upcoming upload service; these table checks do not parse PDF files.

Programme deletion cascades to memberships, applications and PDFs; application
deletion cascades to PDFs. Deleting a user removes memberships but is restricted
if they created a programme or submitted an application. Deactivation preserves
attribution. Foreign-key lookups have leading primary/unique or explicit indexes.
Membership alone does not implement authorization: future services must require
an active tutor **and** workspace membership; admin status grants no applicant access.

The explicit seed inserts the same four frontend demo accounts (`tutor-a`,
`tutor-b`, `admin-a`, inactive `former-tutor`), two shared example programmes and
four memberships. Shared programmes have no creator. Applications/documents
start empty. If **any domain table** already contains data, seeding reports that
existing data was preserved and changes nothing, including edited names and
removed assignments. The empty check and inserts are locked and transactional.
These accounts are illustrative and do not enable backend sign-in.

Inspect the database using PostgreSQL's bundled client:

```sh
docker compose ps
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Inside `psql`:

```sql
\dt
\d+ documents
SELECT id, name, is_tutor, is_admin, active FROM users;
SELECT id, name, code, created_by FROM programmes;
SELECT * FROM programme_memberships;
SELECT count(*) FROM applications;
SELECT count(*) FROM documents;
\q
```

For future schema changes, edit models, generate a migration with
`alembic revision --autogenerate -m "Describe change"`, review it, then run
`alembic upgrade head` and `alembic check`. Never replace migrations with
`Base.metadata.create_all()`. Downgrades remove data and belong in the test DB.

## PostgreSQL integration tests

Create the dedicated database once, then opt in explicitly:

```sh
docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" ucl_application_review_test'
python -m pytest -q --run-postgres
python -m tests.verify_volume
```

`TEST_DATABASE_URL` in `.env` must name this database (or another dedicated name
ending `_test`). Both development and test URLs must be configured. The guard
refuses the development database even through another hostname, and rejects
non-test database names before any migration/truncation. An explicitly requested
but unreachable database fails the tests; it is not silently skipped. Tests own
the dedicated test dataset and must not run concurrently with other test writers.
They migrate/downgrade, truncate the five test tables, check schema/model parity,
exercise constraints and deletion, round-trip binary bytes, and verify seed
idempotence/rollback. They never clear the development database.

`tests.verify_volume` is a separate explicit check: it saves temporary PDF bytes
in the guarded test database, recreates the Compose container, confirms the bytes
survive and development row counts stay the same, then removes only its own test
rows. It verifies the named volume mount too. Run it after migrations/tests, with
no concurrent test writers. It recreates the container without deleting its volume.

Without `--run-postgres`, PostgreSQL tests skip and the HTTP/configuration tests
run without a database or Docker, even if `.env` is present. The mock health route
continues to report `database: "not configured"`: this describes its disconnected
HTTP adapter, not Docker/PostgreSQL health.

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

Verified on 15 October 2026: 102 Python tests passed with real PostgreSQL 18.6,
including the existing API tests. Migrations upgraded/downgraded in the test DB;
`alembic check` found no model/schema differences. Container recreation preserved
PDF bytes and all development row counts. Ruff lint/format and dependency checks
passed. The default suite runs 45 tests and skips the 57 opt-in PostgreSQL tests.

The frontend is unchanged in this milestone. Its previous 14 October checks
covered 337 unit tests, eight demo browser workflows and two HTTP browser checks;
see the [frontend verification record](../frontend/VERIFICATION.md).

The scaffold uses FastAPI's documented [response models](https://fastapi.tiangolo.com/tutorial/response-model/),
[dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/),
[CORS middleware](https://fastapi.tiangolo.com/tutorial/cors/) and
[TestClient workflow](https://fastapi.tiangolo.com/tutorial/testing/).
The storage foundation follows the [SQLAlchemy ORM guide](https://docs.sqlalchemy.org/en/21/orm/quickstart.html),
[Alembic migration tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html)
and [official PostgreSQL image layout](https://github.com/docker-library/docs/blob/master/postgres/README.md#pgdata).
