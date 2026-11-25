# Project context for agents

Last reviewed: 17 November 2026. Applies to this project and its subdirectories.
Read this guide before editing, then inspect the relevant source. Newer user
instructions take precedence. Keep this file focused on current conventions;
verification history belongs in the maintained guides below.

## Product and implemented boundaries

**Admission Review System** is a final-year project for human review of
postgraduate applications. Tutors inspect evidence and record final decisions.
Example courses, rubrics and synthetic assessments are not UCL admissions policy.
The intended evaluators return structured evidence; deterministic code owns
scoring/recommendation routing, and tutors retain the final decision.

- `frontend/`: React, TypeScript, Vite, MUI/Mantis, React Router, Redux Toolkit and
  RTK Query. Tutor/admin workflows use authenticated FastAPI/PostgreSQL; only
  tab credentials and interface preferences remain in sessionStorage.
- `backend/`: FastAPI, per-account Bearer tokens, PostgreSQL workspace/application/
  document/review APIs, and optional async inference client/connection probe.
  The full synthetic assessment pilot in `app/assessments/flow/` has academic,
  CV, statement, reference and English specialists, deterministic scoring and a
  summary node. Each agent owns its active prompt/rubric in its named assessment
  folder; `shared/` owns common execution and `flow/` owns orchestration/jobs.
  See the [assessment code map](backend/app/assessments/README.md).
  An opt-in PDF allowlist enables queued evaluation
  through the tutor UI and a Python worker. Password/SSO remain future work.
- Planned architecture: FastAPI/Python workers orchestrate evaluation and call a
  separate Qwen HTTP endpoint. The synthetic full workflow passed live Qwen
  validation; continuous GPU availability remains unverified. PostgreSQL stores
  records and original PDFs as `bytea`;
  Assessment history uses JSONB; LangGraph checkpoints are planned. Do not make object
  storage a required MVP dependency.

Read the maintained guide for the area being changed:

- [Frontend](frontend/README.md): startup, accounts, workflows and boundaries.
- [Components](frontend/src/components/README.md): page/visual responsibilities.
- [Content](frontend/src/content/README.md): display copy and the shared hook.
- [Hooks](frontend/src/hooks/README.md): reusable React behaviour.
- [Services](frontend/src/services/README.md): adapters, storage and integration.
- [Tests](frontend/src/test/README.md): companions and shared test utilities.
- [Verification](frontend/VERIFICATION.md): current checks and dated history.
- [Mantis](frontend/src/mantis/README.md): supplied source and adaptations.
- [Backend](backend/README.md): API, migrations, seed and PostgreSQL safeguards.
- [Architecture](design/architecture/system-architecture.md): proposed system.

Local planning files (`project-plan.md`, `project-requirements.md` and
`university-admissions-multi-agent-project-brief.md`) are project references,
not official UCL policy. Some local planning/design files may be untracked.

## Coding conventions

- Page files and exports use the `Page` suffix, such as `LoginPage.tsx`.
- Pages own queries, mutations, route context, temporary drafts, derived values,
  validation and handlers. Extract controlled visual sections with typed props;
  do not turn a page into an empty wrapper around another component's logic.
  A private keyed controller in the same Page file is acceptable.
- Reusable hooks live in `src/hooks/`, with matching tests. Existing hooks are
  `useContent`, `useWorkspace`, `usePagination`, `useIsMounted` and typed Redux
  bindings in `redux.ts`. Generated endpoint hooks stay in `app/api.ts`;
  reducers/actions/store creation stay in `app/store.ts`.
- Guard late state updates/navigation with `useIsMounted()` after awaits. Resource
  cleanup still runs in `finally`. Keep PDF render cancellation local to each
  document/page effect; those inputs can change while the component stays mounted.
- Display copy and accessibility labels belong in matching `src/content/`
  `.content.ts` files, registered in `src/content/index.ts`. Components/pages
  owning copy use the single typed `useContent()` hook. Do not add per-screen
  content hooks. Use named formatters for dynamic sentences. Domain values,
  routes, service-returned data and tutor-entered notes are not copy resources.
  Components rendering only supplied values need no empty content file/hook.
- Every runtime page/component/module has a colocated companion with the same
  basename, such as `AssessmentPage.test.tsx`. Split grouped unit suites by owner;
  E2E specs remain workflow-oriented. Static copy, type-only contracts, bootstrap
  and supplied style factories use consumer/type/browser checks, not empty tests.
  `npm run test:structure` enforces this convention.
- Share meaningful domain/UI behaviour. Avoid generic table engines, facade
  wrappers for every MUI primitive and abstractions that hide feature behaviour.

## Service and state structure

Paths here are relative to `frontend/src/`:

- `app/`: Redux state, RTK Query endpoints/caching and theme.
- `pages/`: screen logic and composition; `components/`: controlled visual sections.
- `domain/`: models, scoring/routing, validation and shared summaries/limits.
- `services/admissions.ts`: selected `AdmissionsService` implementation for typed
  queries, commands and original-document Blob reads. UI code uses this port;
  do not import `services/demo` or its internals from screens/components.
- `services/contracts.ts`: transport-neutral requests and named read models,
  including `ApplicationDetail`, `ApplicationListItem`, `AccountSummary`, `ProgrammeIntake`,
  `RubricCollection` and `QueryResults`. It has no IndexedDB/React dependency.
- `services/fileStaging.ts`: temporary PDF/ZIP references outside Redux.
  Callers release them after completion/failure, including after navigation.
- `services/errors.ts`: shared local/RTK/HTTP error normalisation. Do not load API
  initialisation into a visual component merely to format an error.
- `services/httpAdmissions.ts`: sole production adapter; explicit REST mapping,
  staged PDF/ZIP resolution and validated workspace read projections.
  `backendSession.ts` keeps tab credentials only; server identity comes from the
  Bearer token, never the passed userId. Guard late results after account changes.
- `services/workspaceResponse.ts`: validate unknown server envelopes and linked
  record relationships before Redux/UI. No fallback to browser storage.
- `services/demo.ts`, `services/demo/`, `storage.ts`, `seed.ts`, `migration.ts`,
  `evaluation.ts` and `backend.ts`: legacy regression/migration fixtures only;
  do not reconnect them to runtime screens or the production service adapter.
- `domain/applicationSummary.ts` counts current classified decisions. Callers own
  programme/intake/batch scoping. `domain/documentLimits.ts` owns PDF size/page rules
  shared by forms, parsing and ZIP import.

The HTTP adapter is selected unconditionally in `admissions.ts`. Screens retain
handlers; files stay outside Redux. Explicit backend routes own authorisation,
validation and atomic persistence. The command union is not a REST specification.
Do not trust demo userId claims/frontend guards as server identity. Normal startup
never creates sample records, imports browser data or resets PostgreSQL.

## Interface and routes

Use actual supplied **Mantis React Next TypeScript 4.0.1** source under
`src/mantis/`, sourced from `/Users/jack_1/Downloads/mantis-react-next-ts-4.0.1`.
The manifest records 63 original source/asset mappings and five layout references.
Check supplied components/examples before creating generic UI. Mantis itself uses
MUI, so `@mui/material` imports are expected. Keep admissions logic outside Mantis;
do not import demo routes/authentication or migrate the app to Next.js.

Shared source includes MainCard, AuthCard, statistics, shell/navigation, tabs,
pagination, dropzone, icon buttons, avatar, loaders and theme factories.
CustomizedDialog is a controlled adaptation of the supplied stateful dialog
example, shared by decisions, fact correction, password forms and login help. Preserve source/hash records,
unique accessible titles, focus restoration and busy-safe dismissal.

Keep the neutral white/light-grey Mantis theme, accessible blue actions and
labelled statuses. `app/theme.ts` composes theme factories; shell dimensions come
from Mantis config (260px sidebar, 64px header). Public Sans is self-hosted. Keep
typed Ant Design per-icon imports and the Vite/Vitest ESM alias; root wrappers
otherwise cause production React element-type errors. Use the bundled UCL logo;
do not hotlink or use watermarked previews. Product text is Admission Review System;
technical package/storage keys still use `ucl-admissions`.

Desktop is the presentation priority. Preserve basic responsive/keyboard access;
do not recreate deleted mobile Figma mockups unless requested. Routine demo/
backend-disconnection banners were removed; retain real validation/storage errors,
evidence concerns and destructive-operation consequences.

Tutor routes: `/login`, `/programmes`, then
`/programmes/:programmeId/intakes/:intake` (for example `2026-27`),
its `/batches/:batchId` queue and `/batches/:batchId/applications/:id` review.
Add applicant uses `applications/new`; review action suffixes are `/evidence`,
`/correct` and `/decision`. Unbatched intake queues/reviews use equivalent
`.../intakes/:intake/applications` paths. `app/paths.ts` owns typed path helpers,
intake encoding and scope matching. Stable IDs stay in URLs; readable names,
batch numbers and applicant identity stay in breadcrumb labels.
Legacy `/modules` opens Programme; `/modules/:id` still falls back there.
`LegacyRedirectPage` resolves old `/batches`, `/batches/:batchId`, `/applications`,
`/applications/new`, `/applications/:id` and action links, plus `/criteria`, through
authorised reads. Preserve raw remaining query encoding/hash and historic run/
document/page/tab bookmarks. Conflicting explicit ancestors must fail instead of
falling back to another course. No storage migration/reset is needed for URLs.
Admin routes: `/admin/users` and `/admin/health`. Admin-only login, the logo and role
switching open Users. Legacy `/admin/programme`, `/admin/data` and `/admin/backup`
links redirect to Users under admin guards.

Admin MVP has user management and read-only service health.
Users shows a full-width Mantis table with name/email, role, status and Edit, plus New account.
Create/edit use the shared Mantis dialog and page-owned keyed drafts; cancellation
discards the draft, busy saves block edits/dismissal, and late completion cannot
close another draft. Keep last-active-admin checks, deactivation and attribution.
No course-access column/assignment panel or programme query is needed for admin-only
accounts. Backup/restore page/components/content and the browser preview adapter
are removed, together with obsolete backup/restore commands and staging helpers.
Existing records, PDFs and their migrations remain. Seed reset is a test-only helper.
ServiceHealthPage uses `useBackendHealthQuery`
and `services/backendHealth.ts` to probe configured FastAPI `/health`, validating
the response with cancellation/ten-second timeout. It bypasses demo dataset locks;
show missing configuration/failures honestly, without the legacy simulated health
query or model toggles. The endpoint reports mock mode and unconfigured database/
inference; it does not verify PostgreSQL/model connectivity. Programme settings,
applicant deletion, maintenance logs and reset have no admin UI. Obsolete programme/
model/delete/backup/restore/reset commands and simulated health/audit queries are
removed. Keep recordAudit and stored audit/model fields used by current workflows
and migrations; never reset saved data to simplify UI.

- Login uses the active database email and its issued access token. A prototype
  password no longer signs in. Tokens are private account credentials, kept in
  per-tab sessionStorage and cleared on logout. Help does not enumerate accounts.
  Password reset/SSO are unimplemented. Test emails remain tutor@demo.ucl.local,
  tutor.b@demo.ucl.local and admin@demo.ucl.local; issue tokens separately for new users.
- Programme (`/programmes`) shows direct programme/intake cards such as CSML 26/27.
  Stored full course names/IDs remain. The sidebar lists compact programme/intake
  links; account, role, Change password and Logout are in the header avatar menu.
  All programmes is removed. The password form validates its fields but cannot
  save until real authentication is connected; never persist/transmit its values
  or claim a password changed. Layout owns the temporary draft.
  Add Programme asks for a course name. No settings buttons, intake-picker page
  or course-management/deletion command remain. Old `/modules/:id` links fall back
  to Programme; historical deletion markers remain stored.
- The nested intake workspace has page-level Batches / Admission criteria / Analytics tabs. The
  Batches tab contains Applications, Offers and Pending reviews,
  then ZIP upload and numbered batch rows with date/time and outcome counts.
  Other tabs show their own content. URL selection survives refresh; `/criteria`
  selects the criteria tab. A selected ZIP survives tab switching within the intake.
- Batch applicant tables have Id, Name, Student ID, State, University, Score, AI,
  Decision and Actions. All eight data headers sort; Actions does not. Sort before
  pagination, reset on sort changes, preserve equal-value order, and keep missing
  scores/universities last in either direction. Search/filter/pagination are real.
  Applicant deletion requires owner confirmation; Add applicant retains its batch.
  State is document readiness: Ready requires every document category, with at
  least one reference; otherwise Missing. `ApplicationListItem.documentTypes` is
  derived from linked source records in the query adapter, never persisted on the
  application. Table/filter/sort/CSV use `applicantReadiness()` consistently.
  Tutor decisions and AI processing do not change document readiness. Legacy
  three-document samples remain Missing until the extra categories are present.
- Assessment has four tabs: AI recommendation, Review flag, Score breakdown and
  View documents. The summary contains blue Re-run AI evaluation and green Decision
  buttons. Decision opens the recording popup; it is not a tab. Rationale/evidence
  remain in AI recommendation. Saving closes the popup; Cancel/close/Escape return
  to the underlying tab/document context without saving. Busy saves block edits/
  dismissal; failures retain the draft. Old `/decision` and `?tab=decision` links
  open the popup; historical links show a read-only notice instead of a form.
- Add applicant supports transcript, CV, statement, application form, English test
  report and multiple reference PDFs, reusing Mantis MainCard/buttons and the
  existing FilePicker. Canonical extra types are `application_form`, `english_test`
  and `reference`. Only references may repeat. All files count toward existing
  size/page limits and remain available in View documents.
- Score breakdown shows academic, CV, statement and references. Legacy runs stay
  unchanged and show missing sections as unavailable. `Rubric.weights.references`
  is optional for old records; legacy criteria show 0% in the editor. New private
  courses start with illustrative 40/25/25/10 weights. Positive reference weight
  requires an actual assessed reference score; never renormalise incomplete totals
  or invent reference assessments. English eligibility and consistency flags are
  separate from weighted scores. Numeric criteria edits create new versions.
- Recommendation and section-score summaries show no PDF shortcut links. Use
  View documents for originals. The unused EvidenceLink component/content/tests
  are removed; preserve stored citations, backend contracts and validated legacy
  document/page bookmarks.
  Recommendation sections use MainCard's larger headers for Why this recommendation
  and Evidence summary. Evidence categories use smaller headings and MainCards in
  a two-column desktop grid, preserving supplied order rather than fixed columns.
- Review flag's Update detail opens a correction popup using the same Mantis
  dialog. No standalone correction page layout remains; legacy `/correct` links
  open the popup in the assessment shell. Cancel preserves the underlying tab,
  success selects the latest run, failures retain the draft, and busy saves block
  editing/dismissal. Historical links stay read-only. Preserve source/reason
  validation, original facts and mounted-state guards on asynchronous completion.
- No criteria/assessment history picker is rendered. Keep old records and historic
  run/citation bookmarks read-only, with return to latest. Re-evaluation clears the
  current-run bookmark so a new result cannot strand the user on an older run.
- Page headings use the actual Mantis Breadcrumbs custom-links adaptation. Every
  segment is clickable, including the current page with `aria-current="page"`
  and the sole semantic h1. Back buttons are removed.
  Keep the supplied custom-links appearance: h6 secondary-text grey for every
  linked item, no text decoration, MainCard mb:3, Grid spacing:1 and default
  eight-item collapse. Do not add custom typography, hover/focus, current-colour
  or wrapping overrides. Use MUI 9's `color="textSecondary"` prop to preserve the
  original grey; the old dotted colour prop is unsupported. Keep only routing,
  MUI API and semantic/ARIA compatibility changes. Global keyboard focus remains.
  Pages validate actual programme/intake/batch ancestry before showing review/evidence/mutation controls;
  explicit URL scope takes precedence over saved preferences. Export course
  results lives only in the intake workspace and covers
  the whole course across intakes/batches, with intake in each CSV row; filters do
  not constrain export. Preserve CSV formula escaping. Forbidden/missing batch
  links never open another queue.

## Permissions and decision rules

- Each course has one tutor owner. Active tutor role plus `Programme.createdBy`
  grants access. `User.programmeIds` is a rebuilt compatibility projection, never
  independent authority. Admin permission alone grants no applicant review,
  individual-document viewing, decisions or criteria access. Preserve
  both UI and service checks for normal tutor records.
- Tutors create private courses with trimmed 1–100-character names, preserving
  case, punctuation and Unicode. Reject duplicates owned by the same tutor ignoring
  case; other tutors may use the same name. Generate internal codes for model/CSV
  compatibility. Admins manage accounts and inspect service health, not course ownership/
  assignments or creation. Deactivation/role removal preserves attribution and ownership.
- AI display values are Unconditional, Conditional, Reject, or a neutral dash for
  unavailable results. The approved prototype projection maps raw AI Offer to
  Unconditional and Further review to Conditional. Preserve the raw result,
  justification and HTTP contract; use `aiRecommendation()` consistently.
- Tutor decisions are Unconditional, Conditional or Reject, with optional notes.
  Pending is derived, not a saved choice. Legacy generic Offer/Further review and
  superseded-run tutor records remain stored and display/count as Pending until
  an explicit current classified decision exists. Do not guess a tutor's offer type.
  Counts/analytics/CSV use shared projections; only current classified decisions
  contribute to offers/resolved totals. AI recommendations are separate records.
- Review flags, including critical flags, are advisory for tutor decisions. They
  do not disable outcomes or prevent recording a decision; keep the flags and AI
  recommendation intact. Preserve active ownership and current/available assessment
  checks. There is no override reason, acknowledgement checkbox or extra save-confirmation dialog.
  Keep confirmation for applicant deletion; do not reintroduce removed admin maintenance UI.
- Corrections require a reason and valid source reference, preserve the original
  fact and create a new run. Prefill the selected run's extracted grade, including
  zero. Course owners can tune numeric criteria; validate weights/thresholds,
  save immutable active versions, and never automatically reassess old applications.
  The mandatory rule remains internal and cannot be edited in the UI; do not add
  a disabled placeholder control.
- Processing, failed and unavailable runs must not expose fabricated/precomputed
  scores or explanations. New uploads get no invented identities, evidence or
  assessment. Known synthetic presentation fixtures never apply to uploaded cases.
  Use `currentData` to avoid showing another record during query transitions.
- `services/assessmentNarrative.ts` expands recognised short mock text for current
  core examples (APP-2026-0142–0146) into a display-only clone, preserving originals
  as first paragraphs. Use the rubric matching `run.rubricId` and consistent scores;
  never rewrite saved runs/HTTP responses or apply it to uploads, unknown/custom
  evaluator text, unavailable results, historical bookmarks or unassessed sections.
  Paragraph rendering supports richer future evaluator output without new schemas.
  An optional zero-weight reference section does not suppress the core narrative;
  leave its unassessed text untouched. Evidence grades use the selected run's
  extractedGrade, including zero and historical values, rather than hard-coded
  sample marks/classifications. Reference scores appear only when actually present
  in that run; fixture profiles never apply to uploads or another applicant's run.
- NewApplicationPage keys drafts by account/programme/intake/batch. Late PDF
  validation/create callbacks cannot update or navigate a different screen.

## Storage, uploads and compatibility

PostgreSQL owns all active business records and original PDF bytes. Never reset
saved records to simplify a UI change. Migration `20261117_0003` adds batches,
immutable rubrics, audit events, intake/batch links, PDF ordering and review_state
JSONB (runs/corrections/decisions). `app.import_browser` explicitly imports an
exported version-2 dataset with base64 originals in one transaction, validating
hash/size/pages and rejecting conflicting applicants/PDFs/criteria. It is a one-off
migration CLI, never an HTTP route or startup operation. Preserve IDs, original
bytes, criteria, histories and attribution. Actual backups stay outside Git.
The old browser database remains untouched as a backup and is not read at runtime.

Legacy storage/ownership/sample upgrades remain tested for exported data and
synthetic test fixtures only. Do not generate new browser samples or resurrect
deleted programmes/batches on login. Migrated CSML 26/27 has three batches/eight
applicants; default counts must never overwrite saved records.

- ZIP import accepts applicant folders (optionally inside a common outer folder)
  with all six document categories. Reference filenames require a recognisable
  reference/ref/referee/recommendation marker and may repeat as distinct files.
  Missing types stay missing; ambiguous/duplicate singleton types, unsafe paths,
  non-PDF files or unreadable PDFs reject
  the entire import. Retain originals, not the ZIP container. Validate everything
  before one atomic record/PDF write. Keep the upload UI concise, without restoring
  the removed format/limits help panel.
- Current limits: 20 MiB per PDF; 1–100 pages per document and at most 100 combined
  pages per application; 100 MiB compressed ZIP, 200 MiB expanded, 100 applicants.
  Use `domain/documentLimits.ts` and ZIP service constants, not repeated literals.
- Keep blobs/staged references outside Redux and release references in `finally`.
  PDF.js is locally bundled; clean up loading/render tasks on errors, page changes
  and unmount. Validate document/run/page citations and encode navigation parameters.
- Intake/batch fields are additive v2 data. Populate missing legacy intake once
  from the programme year; retain valid descriptive legacy year labels. Scope
  queues/uploads by course and intake, and batch when applicable. Criteria apply
  to the whole course. Derive batch numbering/counts; do not persist stale totals.

## FastAPI and PostgreSQL

The connected frontend always uses `services/httpAdmissions.ts`. Vite proxies
`/api` to port 8000; an ignored VITE_API_BASE_URL can override the server URL.
Production needs a same-origin reverse proxy or HTTPS API. There is no local mode.
`app/workspace/` owns workspace reads, courses, accounts, criteria and applicant/batch
operations. `app/assessments/` owns review runs, decisions, corrections and the synthetic
evaluator. Each feature keeps its HTTP routes and schemas next to its operations.
`app/auth/permissions.py` owns active-account and single-owner checks.
`app/transactions.py` owns database timeouts, commit/rollback and safe error mapping.
Admin permission alone grants no applicant/PDF access. Uploads enforce bounded
multipart parts/deadlines, original validation and whole-batch transactionality.
Imported known fixtures may use stored criteria/documents with the synthetic
assessor; new uploads cannot receive fabricated assessments. HTTP failures never
save partial corrections/runs. Legacy public health/mock endpoints remain local
diagnostics, and the inference probe stays separately opt-in. Public `/health`
reports the mock integration contract, not actual PostgreSQL/Qwen readiness.

`app/inference/client.py` owns the reusable async Qwen/OpenAI client. FastAPI
lifespan owns its pooled HTTP connection; startup never calls the model or imports the database.
`app/inference/config.py` reads optional server-only settings from the known
backend `.env`, with process environment taking precedence. Configure a Qwen
`/v1` URL, served alias and exactly one API key/key-file source.
`INFERENCE_PROVIDER=qwen` is the default; `openai` explicitly selects independent
`OPENAI_*` settings and a fixed `https://api.openai.com/v1` endpoint for testing.
The OpenAI test profile uses GPT-6 Luna, reasoning disabled, bounded completion
tokens and `store=false`. It consumes API credits only when explicitly probed;
there is no automatic provider fallback. Qwen HTTP is loopback-only; remote URLs
require HTTPS. Keys stay outside Git/frontend code. Redirects and
environment proxies are disabled, deadlines/body/image/token limits are bounded,
and generation is not automatically retried. Invalid, incomplete and unavailable
responses raise typed errors with no fabricated fallback.

The synthetic probe is disabled unless `INFERENCE_PROBE_ENABLED=true`; keep it local
and disable it after connection testing. It accepts only text/json/image mode,
checks the configured model alias and fixed synthetic output, and never saves an
assessment. Responses identify the actual provider/model; an OpenAI result does
not verify Qwen. Legacy `QWEN_PROBE_ENABLED` applies only when the shared flag is
absent and Qwen is selected. The normal `/health` contract still describes the
mock assessment adapter, not Qwen readiness. Use the explicit probe for inference connectivity.
Tests isolate both providers' configuration and use fake transport/loopback HTTP only.
The opt-in `assessments/flow/` workflow reads allowlisted synthetic uploads,
uses versioned specialist prompts and saves scores and an overall summary.
Its worker processes both full assessments and standalone English checks.
Keep actual document assessment separate from the presentation-fixture assessor
and connection probe. See the backend guide for configuration and current limits.

PostgreSQL's document schema supports transcript, CV, statement, application form,
English test and reference PDFs. A partial unique index permits multiple references
while keeping the other five types unique per application; a full application-ID
index also covers references. Migration `20261117_0002` preserves existing rows;
downgrade refuses new categories instead of deleting or relabelling PDFs.
`app/documents/routes.py` provides token-protected upload/list/download for existing
database applications. `DOCUMENT_API_TOKENS_FILE` enables the routes and maps
SHA-256 token digests to stored user IDs; it must be a private regular JSON file.
Tokens are frontend account credentials, separate from Qwen/OpenAI credentials. Active tutor
role and `Programme.created_by` ownership are checked server-side on every call;
membership/admin permission alone grants no access. Database resources are lazy,
lifespan-owned and never imported/connected at startup. `app/documents/service.py`
uses the shared transactions and application locks. `app/documents/pdf_validation.py` and its
bounded child parser validate PDFs without rewriting originals. Uploads enforce
20 MiB, 1–100 pages per document and 100 combined pages, and calculate hashes/counts
server-side. Extra concurrent uploads receive a busy response (two per process).
Frontend HTTP persistence and application/programme APIs are connected. Interactive
password/SSO login remains future work; never trust client role/userId claims.

The expanded frontend document types and fourth score section are not implemented
by the mock API yet. The mock adapter rejects positive reference weights before
HTTP; a zero-weight reference field is omitted along
with extra document metadata to retain the legacy synthetic request shape. Do not
silently fall back or imply that the server assessed uploaded references.

The core domain tables are users, programmes, programme_memberships, applications,
documents, rubrics, upload_batches and audit_events. The assessment pilots add
english_test_checks and assessment_jobs. SQLAlchemy models in `backend/app/models/` are separate from
Pydantic HTTP schemas. Use lazy synchronous Psycopg 3 sessions; never migrate,
seed or call `create_all()` at FastAPI startup. Use explicit Alembic migrations.
The older membership schema does not override server-enforced single-owner policy.

Use Docker CLI; the user does not want screen control for Docker. From `backend/`,
prepare ignored `.env` from `.env.example` with real local credentials, then run:

```sh
docker compose up -d --wait
alembic upgrade head
python -m app.seed
```

Docker uses `postgres:18.6`, loopback port 5432 by default and a persistent named
volume mounted at `/var/lib/postgresql`, outside OneDrive. Normal recreation must
preserve data; do not delete the volume or use `down -v` for routine shutdown.
Only seed when all five domain tables are empty; subsequent seeds preserve rows.
The database seed has four accounts, two unowned example programmes, four memberships
and no applications/documents, independently of browser examples. Read the backend
guide for connection URLs and inspection commands; commit placeholders only.

Keep textual/UUID-compatible IDs, timezone-aware timestamps, role/unique/FK/check
constraints, original PDF `bytea`, per-application singleton-type uniqueness,
repeatable references and specified deletion cascades/attribution restrictions.
Database constraints alone
establish neither PDF readability, true SHA calculation nor the combined page
limit; the document upload service enforces them. Keep mutable databases, Python
virtual environments and model weights outside OneDrive.

Destructive PostgreSQL tests require separate configured development/test URLs and
an approved `_test` database such as `ucl_application_review_test`; never run against
development data or concurrently against a shared test dataset. Default backend
tests need no database. Database verification history is in the backend guide.

## Runtime, verification and Git

Use Node 24+ and npm with the committed lockfile. On this machine the bundled
runtime is `/Users/jack_1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`.
From `frontend/` run `npm ci` when needed, then `npm run dev -- --port 5173 --strictPort`.
Check existing servers before starting another; do not terminate unrelated processes.
Vite's regenerable cache lives in the system temporary directory to avoid OneDrive
cache replacement conflicts.

```sh
npm run test:structure
npm run test:coverage -- --maxWorkers=1
npm run lint
npm run format:check
npm run build
npm run test:e2e
npm run test:e2e:backend
```

Serial coverage avoids previously observed worker-start timeouts. Enforced minimums
are 95% lines, 90% statements/functions and 85% branches. Imported Mantis source is
outside application coverage totals and has companion/browser checks. Install
Chromium on a fresh machine; if the temporary runtime exists, set
`PLAYWRIGHT_BROWSERS_PATH=/private/tmp/ucl-admissions-browsers`.
Both E2E suites require distinct development/test DATABASE_URL and TEST_DATABASE_URL
values; the test name must end in `_test`. CLI setup migrates/resets only that test
database and imports synthetic fixtures. Never use the migrated development data
or run database suites concurrently. E2E mode uses FastAPI on 8001 and serves
production output on 4173. Do not rebuild `dist` during that suite. FastAPI
browser checks own ports 8001/5174 and accept `UCL_BACKEND_PYTHON`; use an executable
with installed backend dependencies. Backend checks from `backend/` are
`python -m pytest -q`, `ruff check .` and `ruff format --check .`; PostgreSQL tests
add `--run-postgres` only after the dedicated database safeguards are satisfied.

Current verification and dated evidence are maintained in `frontend/VERIFICATION.md`
and `backend/README.md`. Re-run the required checks after changing the connected
HTTP, schema, permissions or upload paths. Do not use historical counts as proof
of current results.
