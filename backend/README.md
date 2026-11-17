# FastAPI backend, inference client and PostgreSQL foundation

The React frontend now uses authenticated FastAPI routes and PostgreSQL for all
business records and original PDFs. Per-account Bearer tokens establish server
identity; active tutor ownership protects applications, evidence and decisions.
The browser retains only tab credentials and interface preferences.

The database stores immutable criteria, batches, accounts, applications and review
history alongside PDF `bytea`. Synthetic examples can be re-evaluated; real uploaded
documents remain unassessed until extraction/Qwen/LangGraph are connected. Password
login/SSO and live Qwen deployment remain separate work.

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

First configure/migrate PostgreSQL and issue account tokens as below. Start the
frontend in another terminal with `cd frontend && npm run dev`. Vite proxies `/api`
to port 8000 by default; `VITE_API_BASE_URL` is an optional URL override, not a mode
switch. Sign in with the database email and its issued access token.

## Connected workspace API

All routes below require the private `DOCUMENT_API_TOKENS_FILE` configuration and
a Bearer token. Unknown tokens fail before database access. Never trust a client
userId, role or membership list. Admins can manage accounts but receive no other
tutor's application/document data. All modifications commit before success.

| Route | Purpose |
| --- | --- |
| `GET /api/v1/workspace`, `GET /api/v1/me` | Authorised metadata/history and account identity; no PDF bytes |
| `POST /api/v1/programmes` | Create a privately owned course and initial criteria |
| `PUT /api/v1/programmes/{id}/criteria` | Optimistic, immutable numeric criteria version |
| `POST /api/v1/accounts`, `PUT /api/v1/accounts/{id}` | Admin account changes with last-active-admin protection |
| `POST /api/v1/programmes/{id}/applications` | Multipart applicant manifest plus original PDF parts |
| `POST /api/v1/programmes/{id}/batches` | Multipart batch manifest plus original PDF parts; one transaction |
| `DELETE /api/v1/applications/{id}` | Confirmed owner deletion and cascading originals |
| `POST /api/v1/applications/{id}/evaluations` | Save a synthetic fixture run using trusted stored criteria/documents |
| `POST /api/v1/applications/{id}/corrections` | Validate a source/reason and append correction/new synthetic run atomically |
| `POST /api/v1/applications/{id}/decisions` | Record an outcome on the latest available run; flags stay advisory |

Application multipart fields are `manifest` (JSON) and repeated `file` parts. Each
manifest document has `type` and `fileIndex`; every file must be referenced exactly
once. Individual manifests include candidate, intakeYear and optional batchId;
batch manifests include filename, intakeYear and applications. Only references
repeat. The server validates original PDFs and limits independently; an invalid
part rejects the whole applicant/batch. ZIP containers are unpacked and bounded by
the frontend and never stored. Request bodies/spool files, parsing time, per-PDF
size/pages and combined application pages are bounded. Upload slots limit concurrency.

## One-off browser migration

Export the existing version-2 dataset plus original PDFs to a private JSON file
`{"dataset": {...}, "files": {"document-id": "base64 PDF"}}`, then run explicitly:

```sh
python -m app.import_browser /absolute/path/to/browser-backup.json
```

Take a PostgreSQL backup first. This validates original SHA-256/page/size metadata
and imports IDs, ownership, criteria, batches, runs, corrections, decisions and
audit attribution in one transaction. Identical re-imports are idempotent;
conflicting existing applicants/PDFs/criteria fail and roll back. Initial seed
accounts/unowned courses can be adopted by their matching IDs. It is an explicit
migration, not a merge tool for two independently edited live datasets. Keep the
export outside Git. Opening the frontend never imports or resets browser data.

## Small API contract

| Endpoint | Behaviour |
| --- | --- |
| `GET /api/v1/health` | Confirms FastAPI is reachable; reports the mock assessment adapter's database/inference integration, not Qwen connectivity. |
| `POST /api/v1/mock/assessments` | Validates synthetic case/document references and read-only criteria context, then returns an assessment run. |
| `POST /api/v1/inference/probe` | Opt-in fixed synthetic text/JSON/image checks against the selected provider. Disabled by default; response names the provider. |
| `POST /api/v1/applications/{id}/documents` | Token-protected upload of one original PDF into an existing, owned application. |
| `GET /api/v1/applications/{id}/documents` | Token-protected metadata list; PDF bytes are not included. |
| `GET /api/v1/documents/{id}` | Token-protected download of the original PDF bytes. |

The mock assessment POST body contains `applicationId`, `criteria` (ID, version, weights,
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
`failed`; there is no job queue or worker. The connected evaluation route saves returned
synthetic runs in PostgreSQL.

The endpoint is unauthenticated and intended only for local synthetic integration
tests. It exposes no applicant records, original PDFs or decision operations.
The connected routes above enforce token identity and ownership themselves;
the legacy synthetic endpoint does not grant access to records. CORS permits local development/preview origins;
override the comma-separated `UCL_CORS_ORIGINS` for a different local port.

## Document storage API

The document routes are disabled (404) until `DOCUMENT_API_TOKENS_FILE` is set in
the server environment or ignored `backend/.env`. This private JSON file maps
SHA-256 digests of random Bearer tokens to existing database user IDs. API tokens
are the frontend account credentials and are independent of Qwen/OpenAI keys. No client
`userId`, membership list or role claim establishes server identity.

Run the explicit database migrations first (`alembic upgrade head`). The API
does not migrate, seed, connect to or import the database at startup. Its database
engine is created lazily on the first authenticated document request and disposed
on shutdown. Missing/broken database configuration produces a sanitised 503;
there is no fallback storage or simulated upload result.

Create a local credential file outside the repository, for example by running
this once. It refuses to overwrite an existing file and prints the token once:

```sh
python - <<'PY'
import hashlib, json, os, secrets
from pathlib import Path

path = Path.home() / '.config/admissions-documents/tokens.json'
path.parent.mkdir(parents=True, exist_ok=True)
token = secrets.token_urlsafe(32)
descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, 'w') as stream:
    json.dump({hashlib.sha256(token.encode()).hexdigest(): 'tutor-a'}, stream)
print(token)
PY
```

Then set `DOCUMENT_API_TOKENS_FILE=~/.config/admissions-documents/tokens.json` in
the existing backend `.env` and restart FastAPI. File permissions must be 600 or
stricter; symlinks, duplicate digests, plaintext token keys and malformed files
fail startup without printing their values. At most 100 digests are supported.
To revoke/rotate a token, change its digest mapping and restart the backend.
Account deactivation, tutor-role removal and programme ownership changes are
checked against PostgreSQL on every operation and take effect without a restart.

Every operation requires an **active tutor who owns the application's programme**
(`programmes.created_by`). Membership alone grants no access; admin permission
alone grants no access; an unowned programme grants no access. Tutors with both
roles can access their own programmes. Invalid tokens return 401; inactive,
missing or non-tutor accounts return 403; missing and inaccessible records return
the same 404. Use loopback for local tests and HTTPS for remote access.

The seed contains no applications and its example programmes are unowned. These
single-document routes require an existing database application. The connected
workspace routes create programmes/applicants and accept only authorised stored IDs. For a synthetic API test, explicitly create a dedicated owned
programme/application in the development database, for example after seeding:

```sql
INSERT INTO programmes (id, name, code, year, created_by)
VALUES ('document-api-demo', 'Document API demo', 'DOCUMENT-API-DEMO', '2026-27', 'tutor-a');
INSERT INTO applications (id, programme_id, candidate_reference, created_by)
VALUES ('document-api-demo-app', 'document-api-demo', 'SYNTHETIC-DOC-001', 'tutor-a');
```

Use the generated token as `DOCUMENT_API_TOKEN` in your local shell. Send one PDF
per POST as a raw `application/pdf` body, with `documentType` and a plain Unicode
PDF `filename` in the query. This is **not multipart or ZIP upload**:

```sh
curl --fail-with-body \
  -H "Authorization: Bearer ${DOCUMENT_API_TOKEN:?Set the generated token first}" \
  -H 'Content-Type: application/pdf' \
  --data-binary @/absolute/path/to/cv.pdf \
  'http://127.0.0.1:8000/api/v1/applications/document-api-demo-app/documents?documentType=cv&filename=cv.pdf'

curl --fail-with-body -H "Authorization: Bearer $DOCUMENT_API_TOKEN" \
  http://127.0.0.1:8000/api/v1/applications/document-api-demo-app/documents

curl --fail-with-body -H "Authorization: Bearer $DOCUMENT_API_TOKEN" \
  http://127.0.0.1:8000/api/v1/documents/DOCUMENT_ID --output downloaded.pdf
```

Successful uploads return 201, metadata and a `Location` download path. Metadata
contains `id`, `applicationId`, `documentType`, `filename`, `contentType`,
`sizeBytes`, `pageCount`, `sha256` and `uploadedAt`; list responses are arrays of
the same shape. Download returns `application/pdf`, an encoded attachment filename
and the original bytes. Document responses use `private, no-store`; listing and
denied downloads do not fetch the PDF blobs. Swagger `/docs` also exposes the
Bearer scheme and binary PDF request/response.

The server enforces 20 MiB per PDF, 1–100 pages per document and at most 100 pages
per application. It parses PDFs with pinned pypdf in a separate process, rejects
encrypted/unreadable files, calculates the hash/page count and retains the exact
uploaded bytes. Parsing has a ten-second deadline and an eight-second CPU limit;
Linux also imposes a 512 MiB process address-space limit. The body-read deadline
is 60 seconds and checks streamed bytes even without a Content-Length header.
At most two uploads run per backend process; extra concurrent uploads receive a
503 busy response before their bodies are read. The caller decides whether to retry.

All six document categories are supported. Singleton duplicates return 409;
references may repeat. Application-row locks serialize uploads before checking
the combined page total. Permissions are checked again after parsing and the
insert/commit is atomic. Invalid metadata/PDF/page totals return 422, size failures
413, wrong media types 415, interrupted bodies 400, body timeouts 408 and storage
or parser availability failures 503. Error details contain stable codes and
sanitised messages. PostgreSQL statements/locks have bounded waits. No request
invokes a model, saves an assessment or changes the browser's existing data.

Interactive server login, frontend HTTP persistence, programme/application APIs,
batch/ZIP ingestion and AI assessment remain separate milestones.

## Inference client and provider switch

`app/services/inference.py` provides the reusable async `InferenceClient.generate()` method.
It accepts a prompt, optional system prompt and one optional rendered PNG page;
JSON mode returns a parsed object. Every call builds separate messages. There is
no conversation history, agent workflow or scoring inside the client.

The FastAPI lifespan owns one pooled HTTP client and closes it on shutdown.
Startup makes no model request, so a stopped VM does not prevent FastAPI starting.
No configuration leaves the client unavailable; partial/invalid configuration
fails startup with a setting-specific error that does not print secrets.
Process environment overrides the known `backend/.env` file, independently of cwd.
The existing pinned HTTPX dependency is reused; no model or agent packages are needed.
Set `INFERENCE_PROVIDER=qwen` (the default) or `INFERENCE_PROVIDER=openai` in the
server environment or ignored `backend/.env`. Only the selected provider's key,
model and timeout settings are read. Startup does not choose a provider based on
which key is available, and failures never switch providers or silently spend
OpenAI credits. Provider changes require a backend restart, not a frontend switch.

After deploying the VM and opening its SSH tunnel, add these to your **existing,
ignored `backend/.env`**, preserving the database settings:

```dotenv
INFERENCE_PROVIDER=qwen
INFERENCE_PROBE_ENABLED=true
QWEN_BASE_URL=http://127.0.0.1:18000/v1
QWEN_MODEL=admissions-qwen
QWEN_API_KEY_FILE=~/.config/admissions-qwen/api.key
QWEN_TIMEOUT_SECONDS=90
```

The key file must contain the same Bearer API key configured on the vLLM server,
with mode 600 or stricter. The local VM deployment helper creates it during its
`init-secret` step; it is not part of this repository. Alternatively supply
`QWEN_API_KEY` in the server environment. Set exactly one key source and leave
the other empty. Never put the key in a frontend `VITE_*` setting. Leave URL/key
empty while preparing locally without a model. Restart FastAPI after
configuration changes.

For temporary OpenAI testing, use:

```dotenv
INFERENCE_PROVIDER=openai
INFERENCE_PROBE_ENABLED=true
OPENAI_MODEL=gpt-6-luna
OPENAI_TIMEOUT_SECONDS=90
# Set OPENAI_API_KEY in this ignored file, or set OPENAI_API_KEY_FILE instead.
```

OpenAI requests go only to `https://api.openai.com/v1`; Qwen's URL/key and any
`OPENAI_BASE_URL` variable do not redirect them. Supply exactly one of
`OPENAI_API_KEY` and `OPENAI_API_KEY_FILE`; key files require mode 600 or stricter.
The key needs permission to read models and create Chat Completions. This profile
uses GPT-6 Luna with `reasoning_effort=none`, at most 512 output tokens, and
`store=false`. Other model choices must support these parameters, vision and JSON
mode for all three probes. Tests use Chat Completions to exercise the same HTTP
contract as vLLM. OpenAI API usage consumes your API credits/billing; the key stays
on the backend. Only the fixed synthetic examples are sent by the probe.

The shared probe flag takes precedence over the old `QWEN_PROBE_ENABLED` setting.
The old flag remains supported for Qwen configurations that do not set the shared
flag; it cannot enable OpenAI probes. Merely adding an OpenAI key does not enable
OpenAI or make a request.

Without API credits, keep probes disabled and run `python -m pytest -q` instead.
It exercises both providers with fake responses and makes no paid API calls.
Actual OpenAI tests require usable API credits/billing and the configured key.

With FastAPI bound to `127.0.0.1:8000`, test through the backend:

```sh
curl --fail-with-body http://127.0.0.1:8000/api/v1/inference/probe \
  -H 'Content-Type: application/json' -d '{"mode":"text"}'
```

Repeat with `"mode":"json"` and `"mode":"image"`. Each checks `/v1/models` for the
served alias, then calls `/v1/chat/completions`. Text must return a known marker;
JSON must return a known object; image mode reads the bundled synthetic PNG and
checks its three facts. `status: "ok"` requires the corresponding check to pass.
Responses identify `provider` (`qwen` or `openai`) and the model that answered;
OpenAI may return the dated snapshot behind a requested alias. Qwen still requires
the configured served alias exactly. This proves connectivity and simple
instruction/image handling, not admissions quality. The PNG reuses the deployment
package's synthetic page.

The probe accepts only its mode, with no arbitrary prompts, model URLs, PDF uploads
or applicant IDs. It is an unauthenticated **local development diagnostic**;
keep the backend on loopback and set `INFERENCE_PROBE_ENABLED=false` after testing.
It neither calls the mock evaluator nor saves runs or scores. The existing frontend
continues using its current mock contract; `/health` does not probe the model.

The initial client limits are: combined system/user text at most
16,000 characters (not an exact token budget), output at most 512 tokens, one PNG
at most 2 MiB/1024 pixels per edge and responses at most 2 MiB. HTTPX phase timeouts
and a whole-request deadline bound waits. Context-length errors come from the
selected provider; these client limits do not prove every request fits Qwen's
8,192-token context. Qwen HTTP is restricted to a loopback tunnel; other hosts
require verified HTTPS. OpenAI uses its fixed official HTTPS endpoint.
Redirects and environment proxies are disabled. No generation request is retried
automatically because a timed-out request might already have used GPU time.
Raw upstream errors, request bodies and credentials are not logged or returned.
Truncated, empty, wrong-model or invalid-JSON results fail rather than falling back.

Errors return `detail.code` and `detail.message`: 404 for a disabled probe; 503 for
missing configuration/unreachable/busy/missing-model; 504 for timeouts; and 502
for rejected upstream credentials, HTTP errors, invalid/incomplete output or a
failed synthetic check. Invalid probe bodies return 422.
OpenAI credit, spend and usage-limit failures return 503 with
`INFERENCE_QUOTA_EXHAUSTED`, separately from temporary rate limits. They are not
retried, and only the bounded error code is inspected; raw provider error messages
are not exposed.

The default Python suite tests the wire contract with fake responses and a real
loopback HTTP fake server. It never connects to AWS or a real Qwen model, and
isolates both providers' environment/file configuration. Real GPU memory fit,
model output and the SSH connection still require live deployment acceptance checks.
LangGraph integration, document extraction and real admissions evaluation come later.

References: [vLLM chat API](https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server/),
[OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create),
[GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna),
[HTTPX async clients](https://www.python-httpx.org/async/),
[HTTPX timeout semantics](https://www.python-httpx.org/advanced/timeouts/) and
[FastAPI lifespan](https://fastapi.tiangolo.com/advanced/events/).

## Structure and next integration boundaries

```text
app/main.py                 App factory and CORS configuration
app/routes.py               HTTP routes and evaluator dependency
app/schemas.py              Validated requests/responses and OpenAPI models
app/services/evaluation.py  EvaluationService protocol, mock evaluator and scoring
app/services/inference.py   Shared Qwen/OpenAI client, validation and bounded failures
app/inference_config.py     Optional server-only URL/key/timeout configuration
app/inference_routes.py     Disabled-by-default synthetic connection probe
app/document_routes.py      Token-protected original PDF upload/list/download
app/document_config.py      Private hashed-token configuration; no DB imports
app/document_dependencies.py Server identity and lazy, lifespan-owned DB resources
app/services/documents.py   Ownership checks, atomic storage and application locks
app/services/pdf_validation.py Filename, original bytes, hash and bounded validation
app/services/pdf_worker.py  Isolated PDF parser; never rewrites uploaded files
app/fixtures/              Fixed synthetic PNG for the image probe
app/db.py                  Lazy database configuration, engine, sessions and ORM base
app/models/                Five SQLAlchemy table models and relationships
app/seed.py                Explicit empty-dataset demo bootstrap
alembic/                   Versioned table migrations, independent of app startup
compose.yaml               Local PostgreSQL 18.6 and persistent named volume
tests/                     HTTP/configuration tests and opt-in PostgreSQL integration tests
```

`get_evaluation_service()` is the replacement seam for a future evaluator. The
frontend transport lives in `src/services/httpAdmissions.ts`; PostgreSQL owns
records and review history while RTK Query caches current in-memory reads.
The backend enforces permissions and trusted criteria/document selection. A configured backend failure surfaces an error and
does not silently fall back to locally generated scores or save a partial run.
Newly uploaded PDFs stay in the explicit real-assessment-unavailable path.

The document API implements PDF upload/list/download for existing database
applications. Connected review routes load trusted stored criteria/document identities
and persist each run/correction/decision transactionally. Real inference and workers
remain future milestones.

## PostgreSQL: start, migrate and seed

PostgreSQL is required by the connected frontend. The legacy synthetic probe can
still run without it. Install the pinned dependencies
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

Migrations create eight domain tables plus Alembic's technical `alembic_version`.
FastAPI never creates tables, runs migrations or seeds data. SQLAlchemy models
describe database rows; `app/schemas.py` remains the separate HTTP contract.
New model instances receive UUID strings on insert; existing IDs such as
`tutor-a`, `programme-1` and `APP-2026-0143` are supported.

| Table | Purpose and key rules |
| --- | --- |
| `users` | Unique normalized email, at least one of tutor/admin, active flag. Both roles may be true. No passwords or sign-in implementation. |
| `programmes` | Named workspace, case-insensitive unique code, optional creator ownership. Names can repeat. |
| `programme_memberships` | Composite `(user_id, programme_id)` key; assignment and ownership are separate. |
| `applications` | Workspace, candidate reference and submitting tutor. Candidate references can repeat. Intake/batch and review_state JSONB preserve runs/corrections/decisions. |
| `upload_batches` | Intake-scoped uploads and immutable original batch metadata. |
| `rubrics` | Immutable per-course numeric criteria versions. |
| `audit_events` | Preserved actor/action/target/time attribution. |
| `documents` | Original `bytea` plus metadata. Six document categories; singleton types are unique per application and references may repeat. |

Database constraints enforce non-blank required labels, trimmed names/codes,
lowercase trimmed emails, foreign keys, document type, canonical PDF MIME type,
file sizes from one byte through 20 MiB, 1–100 pages, lowercase 64-character
hexadecimal hashes and exact stored byte length. Hashes are not unique. PDF
readability, calculating the true hash and the **combined 100-page application limit**
are enforced by the document upload service; the table checks do not parse PDF files.

### Document categories and migration

The document schema now matches the frontend's six categories:

| `document_type` | Documents per application |
| --- | --- |
| `transcript` | At most one |
| `cv` | At most one |
| `statement` | At most one |
| `application_form` | At most one |
| `english_test` | At most one |
| `reference` | Multiple, each with its own document ID |

Documents remain individual linked rows containing their original PDF bytes.
Original filenames are metadata, not identifiers; references can share filenames
or hashes. The database allows incomplete document sets. Readiness, PDF validation
and combined page limits are enforced by the upload/application service.

Migration `20261117_0002` expands the allowed types and replaces the old unique
constraint with a partial unique index of the same name,
`uq_documents_application_type`, excluding references. The separate full
`ix_documents_application_id` index covers all documents for application lookups
and deletion cascades. Existing IDs, bytes, metadata and timestamps are unchanged.
Run `alembic upgrade head` and `alembic check` explicitly after configuring the
database; FastAPI startup does not apply migrations.

Downgrade to `20261015_0001` restores the original three-category schema only when
all rows are transcript/CV/statement documents. It locks the document table and
refuses the downgrade if any application form, English test or reference exists.
It never deletes or relabels documents to make a downgrade succeed.
The schema migration itself adds no endpoints; the opt-in document API above now
provides file storage. Frontend persistence remains independent. The synthetic assessment HTTP
schemas and evaluator still support only their existing three-category fixtures.

Programme deletion cascades to memberships, applications and PDFs; application
deletion cascades to PDFs. Deleting a user removes memberships but is restricted
if they created a programme or submitted an application. Deactivation preserves
attribution. Foreign-key lookups have leading primary/unique or explicit indexes.
The document API requires an active tutor **and** programme ownership;
membership and admin status alone grant no applicant access.

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
They migrate/downgrade, truncate only the eight test tables, check schema/model parity,
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
backend; both browser suites now use disposable PostgreSQL fixtures.
Set distinct DATABASE_URL and TEST_DATABASE_URL values before either browser suite;
the latter must end in `_test`. Their CLI setup refuses development URLs before
resetting/migrating the test database. Never run database suites concurrently.

Verified on 17 November 2026 for the document API: **330 Python tests passed**
against the exact staged code, including all opt-in PostgreSQL integration tests
in a disposable PostgreSQL 18.6 container. Coverage includes real upload/list/
download round trips, all six categories, hashed-token identity, active tutor and
ownership checks, immediate role/ownership changes, invalid/encrypted PDFs,
streamed size limits, commit rollback, concurrent page/uniqueness enforcement,
metadata-only reads, startup isolation and resource cleanup. All three existing
FastAPI browser workflows and Ruff lint/format/whitespace checks passed. No model
calls were made; development data and browser persistence were preserved.

Verified on 17 November 2026 for the document schema: **254 Python tests passed**,
including **80 PostgreSQL integration tests**, using a disposable PostgreSQL 18.6
container and a dedicated test database. Checks cover all six document types,
singleton uniqueness, multiple references, binary round trips, reference deletion
cascades, full/partial indexes and schema/model parity. Legacy rows survive
downgrade/upgrade unchanged; downgrades with new document categories fail without
changing rows or the schema. Ruff lint/format and whitespace checks passed.
Development data and browser storage were not modified; upload/download endpoints
and frontend database integration remain unimplemented.

Verified on 16 November 2026 for the provider switch: **174 Python tests passed**,
with **57 opt-in PostgreSQL tests skipped**. The suite covers both request formats,
separate keys and configuration, provider-identifying probe responses, OpenAI
snapshot aliases, exhausted-credit/spend-limit errors and absence of automatic
provider fallback. All model responses came from fake transports or the loopback
fake server; **no paid OpenAI API calls were made**. Ruff lint/format and whitespace
checks and all three existing FastAPI browser workflows passed. Actual OpenAI
responses still require a funded API account, and Qwen's AWS/GPU deployment
remains unverified. LangGraph remains deferred.

Verified on 13 November 2026 for the Qwen client milestone: **144 Python tests
passed**, with **57 opt-in PostgreSQL tests skipped**. The suite includes actual
loopback HTTP requests to a fake vLLM server, independent message contexts,
text/image/JSON serialization, configuration/key handling, model alias checks,
HTTP/timeout/oversize/truncated/invalid-result failures and client cleanup. Real
Qwen inference and PostgreSQL were not exercised. The existing three FastAPI
browser workflows passed on desktop/mobile, including service-health recovery,
assessment persistence and disconnection. Ruff lint/format and whitespace checks
passed using the committed Python dependencies. A matching Playwright headless
browser was installed in the temporary cache; no dependency pins were changed.
The pinned Starlette TestClient emits one upstream HTTPX deprecation warning.

Verified on 15 October 2026: 102 Python tests passed with real PostgreSQL 18.6,
including the existing API tests. Migrations upgraded/downgraded in the test DB;
`alembic check` found no model/schema differences. Container recreation preserved
PDF bytes and all development row counts. Ruff lint/format and dependency checks
passed. At that milestone, the default suite ran 45 tests and skipped the 57
opt-in PostgreSQL tests.

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

## Connected PostgreSQL verification — 17 November 2026

The frontend now uses PostgreSQL through the authenticated workspace API. The
existing browser test data was explicitly migrated after a database backup:
four accounts, three programmes, nine applications, 25 original PDFs, three
rubrics, four batches and 19 audit events. All PDF hashes and application
histories matched the source; the browser database was left untouched. Private
backup files and token credentials are outside Git.

All 343 backend tests pass, including isolated PostgreSQL migration/model parity,
atomic upload/batch rollback, ownership isolation, original-byte round trips,
criteria concurrency, last-admin protection, import idempotence/conflict rollback
and persisted correction/decision histories. Ruff lint/format pass. The frontend
passes 942 unit tests plus 21 main and three API-recovery browser workflows using
disposable PostgreSQL with IndexedDB disabled. New uploads remain unassessed;
no Qwen/OpenAI calls or AWS resources were used.
