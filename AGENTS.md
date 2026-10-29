# Project context for agents

Last reviewed: 29 October 2026. Applies to this project and its subdirectories.
Read this guide before editing, then inspect the relevant source. Newer user
instructions take precedence. Keep this file focused on current conventions;
verification history belongs in the maintained guides below.

## Product and implemented boundaries

**UCL Application Review Workspace** is a final-year project for human review of
postgraduate applications. Tutors inspect evidence and record final decisions.
Example courses, rubrics and synthetic assessments are not UCL admissions policy.
The intended evaluators return structured evidence; deterministic code owns
scoring/recommendation routing, and tutors retain the final decision.

- `frontend/`: React, TypeScript, Vite, MUI/Mantis, React Router, Redux Toolkit and
  RTK Query. Tutor/admin workflows persist in browser IndexedDB.
- `backend/`: a stateless FastAPI health/mock-assessment scaffold and an independent
  five-table PostgreSQL foundation. HTTP routes do not yet use the database.
- Real authentication, server PDF upload/extraction, local AI inference, workers
  and PostgreSQL-backed application APIs remain future work.
- Planned architecture: FastAPI/Python workers orchestrate evaluation and call a
  separate Qwen endpoint on UCL GPU hardware. Hosting and continuous GPU access
  are unconfirmed. PostgreSQL stores records and original PDFs as `bytea`;
  assessment JSONB and LangGraph checkpoints are planned. Do not make object
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
  including `ApplicationDetail`, `AccountSummary`, `ProgrammeIntake`,
  `RubricCollection` and `QueryResults`. It has no IndexedDB/React dependency.
- `services/fileStaging.ts`: temporary File/ZIP/backup references outside Redux.
  Callers release them after completion/failure, including after navigation.
- `services/errors.ts`: shared local/RTK/HTTP error normalisation. Do not load API
  initialisation into a visual component merely to format an error.
- `services/browserBackups.ts`: validated local restore previews (reference/counts).
  This is a browser-demo facility, not a server backup API.
- `services/demo.ts` and `services/demo/`: browser implementation, permission checks,
  migration/recovery, cross-tab lock and atomic record/PDF transactions. Preserve
  existing compatibility exports, saved-data upgrades and failure atomicity.
- `services/backend.ts` validates unknown mock HTTP results in named groups and
  normalises nullable optional fields on a copy; `evaluation.ts` selects evaluator.
- `domain/applicationSummary.ts` counts current classified decisions. Callers own
  programme/intake/batch scoping. `domain/documentLimits.ts` owns PDF size/page rules
  shared by forms, parsing, ZIP import and backup validation.

A future HTTP adapter implements `AdmissionsService` and is selected in
`admissions.ts`; screens retain their handlers. Resolve staged files in that
adapter and validate/map server responses to the shared contracts. The command
union is not an existing REST API specification. Browser backup/reset/model
commands need explicit handling. Real server authentication/permissions must not
trust the demo `userId` argument or frontend guards.

## Interface and routes

Use actual supplied **Mantis React Next TypeScript 4.0.1** source under
`src/mantis/`, sourced from `/Users/jack_1/Downloads/mantis-react-next-ts-4.0.1`.
The manifest records 62 original source/asset mappings and five layout references.
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
do not hotlink or use watermarked previews. Product text is Application Review
Workspace; technical package/storage keys still use `ucl-admissions`.

Desktop is the presentation priority. Preserve basic responsive/keyboard access;
do not recreate deleted mobile Figma mockups unless requested. Routine demo/
backend-disconnection banners were removed; retain real validation/storage errors,
evidence concerns and destructive-operation consequences.

Tutor routes: `/login`, `/modules`, `/batches`, `/batches/:batchId`, `/applications`
(legacy intake queue), `/applications/new`, `/applications/:id`, plus its
`/evidence`, `/correct` and `/decision` paths, and `/criteria`.
Admin routes: `/admin/health`, `/admin/users`, `/admin/programme`, `/admin/data`.

- Login uses email and any nonempty prototype password (for example `demo`). It
  matches active existing accounts; passwords are neither authenticated nor saved.
  Account-help links do not implement registration, reset or real UCL sign-in.
  Example emails are `tutor@demo.ucl.local`, `tutor.b@demo.ucl.local` and
  `admin@demo.ucl.local`; read the seed/README for current editable account data.
- Programme (`/modules`) shows direct programme/intake cards such as CSML 26/27.
  Stored full course names/IDs remain. The sidebar lists compact programme/intake
  links; account, role, Change password and Logout are in the header avatar menu.
  All programmes is removed. The password form validates its fields but cannot
  save until real authentication is connected; never persist/transmit its values
  or claim a password changed. Layout owns the temporary draft.
  Add Programme asks for a course name. No settings buttons, intake-picker page
  or course-management/deletion command remain. Old `/modules/:id` links fall back
  to Programme; historical deletion markers remain stored.
- `/batches` has page-level Batches / Admission criteria / Analytics tabs. The
  Batches tab contains Total applications, Offers given and Total pending review,
  then ZIP upload and numbered batch rows with date/time and outcome counts.
  Other tabs show their own content. URL selection survives refresh; `/criteria`
  selects the criteria tab. A selected ZIP survives tab switching within the intake.
- Batch applicant tables have Id, Name, Student ID, State, University, Score, AI,
  Decision and Actions. All eight data headers sort; Actions does not. Sort before
  pagination, reset on sort changes, preserve equal-value order, and keep missing
  scores/universities last in either direction. Search/filter/pagination are real.
  Applicant deletion requires owner confirmation; Add applicant retains its batch.
- Assessment has four tabs: AI recommendation, Review flag, Score breakdown and
  View documents. The summary contains blue Re-run AI evaluation and green Decision
  buttons. Decision opens the recording popup; it is not a tab. Rationale/evidence
  remain in AI recommendation. Saving closes the popup; Cancel/close/Escape return
  to the underlying tab/document context without saving. Busy saves block edits/
  dismissal; failures retain the draft. Old `/decision` and `?tab=decision` links
  open the popup; historical links show a read-only notice instead of a form.
- Review flag's Update detail opens a correction popup using the same Mantis
  dialog. No standalone correction page layout remains; legacy `/correct` links
  open the popup in the assessment shell. Cancel preserves the underlying tab,
  success selects the latest run, failures retain the draft, and busy saves block
  editing/dismissal. Historical links stay read-only. Preserve source/reason
  validation, original facts and mounted-state guards on asynchronous completion.
- No criteria/assessment history picker is rendered. Keep old records and historic
  run/citation bookmarks read-only, with return to latest. Re-evaluation clears the
  current-run bookmark so a new result cannot strand the user on an older run.
- Back links use explicit parent destinations, left-arrow icons and Back, at the
  far right. Export course results lives only in the intake workspace and covers
  the whole course across intakes/batches, with intake in each CSV row; filters do
  not constrain export. Preserve CSV formula escaping. Forbidden/missing batch
  links never open another queue.

## Permissions and decision rules

- Each course has one tutor owner. Active tutor role plus `Programme.createdBy`
  grants access. `User.programmeIds` is a rebuilt compatibility projection, never
  independent authority. Admin permission alone grants no applicant/PDF/decision
  or criteria access. Preserve both UI and service checks.
- Tutors create private courses with trimmed 1–100-character names, preserving
  case, punctuation and Unicode. Reject duplicates owned by the same tutor ignoring
  case; other tutors may use the same name. Generate internal codes for model/CSV
  compatibility. Admins edit existing metadata/accounts, not ownership/assignments
  or new courses. Deactivation/role removal preserves attribution and ownership.
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
- All final tutor outcomes are blocked by unresolved critical evidence. There is
  no override reason, acknowledgement checkbox or extra save-confirmation dialog.
  Keep confirmations for applicant/data deletion, reset and restore.
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
- NewApplicationPage keys drafts by account/programme/intake/batch. Late PDF
  validation/create callbacks cannot update or navigate a different screen.

## Storage, uploads and compatibility

Never reset browser data to make a UI change or screenshot match. Dataset/backup
schema v2 supports v1 migration; IndexedDB schema version is separate. Preserve IDs,
PDF bytes, runs, corrections, tutor decisions and criteria versions. Session identity
and per-account programme/intake selection use sessionStorage. Recover interrupted
simulated evaluations using stored deadlines rather than disposable timers.

Ownership migration preserves an explicit owner, otherwise uses the creation-audit
actor, then an assigned active tutor, then an assigned inactive tutor. Rebuild
compatibility lists from ownership; genuinely unassigned metadata stays unowned.
Backup validation works on a clone and applies the same upgrades.

Sample defaults must survive fresh and older browser profiles without recreating
user-deleted/edited courses or batches. Honour deletion audits/tombstones and ID/
code/rubric conflicts. `addSampleCourseBatches()` checks actual data and completes
`sample-csml-batches-v2` atomically only when defaults exist/are inserted; the older
v1 marker alone is insufficient. Conflicts stay retryable. Samples use
`SAMPLE-CSML-01` through `SAMPLE-CSML-03`, not sequential uploaded references.
Existing IDs/old fixture references remain supported. Default CSML 26/27 has three
batches/eight applicants; do not overwrite user data to restore those counts.

- ZIP import accepts applicant folders (optionally inside a common outer folder)
  with CV, transcript and personal-statement PDFs. Missing types stay missing;
  ambiguous/duplicate types, unsafe paths, non-PDF files or unreadable PDFs reject
  the entire import. Retain originals, not the ZIP container. Validate everything
  before one atomic record/PDF write. Keep the upload UI concise, without restoring
  the removed format/limits help panel.
- Current limits: 20 MiB per PDF; 1–100 pages per document and at most 100 combined
  pages per application; 100 MiB compressed ZIP, 200 MiB expanded, 100 applicants.
  Use `domain/documentLimits.ts` and ZIP service constants, not repeated literals.
- Keep blobs/staged references outside Redux and release references in `finally`.
  PDF.js is locally bundled; clean up loading/render tasks on errors, page changes
  and unmount. Validate document/run/page citations and encode navigation parameters.
- Backups include browser records, originals and history. Validate structure,
  references and hashes before atomic replacement; retain an active administrator.
  Browser backup size cap is 100 MiB. Release abandoned/cancelled restore previews,
  but retain confirmed in-flight references until the command completes.
- Intake/batch fields are additive v2 data. Populate missing legacy intake once
  from the programme year; retain valid descriptive legacy year labels. Scope
  queues/uploads by course and intake, and batch when applicable. Criteria apply
  to the whole course. Derive batch numbering/counts; do not persist stale totals.

## FastAPI and PostgreSQL

The scaffold exposes only `GET /api/v1/health` and
`POST /api/v1/mock/assessments`. `app/services/evaluation.py` defines the replaceable
EvaluationService; `app/schemas.py` owns the HTTP schemas. Set ignored frontend
`.env.local` to `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1` and restart Vite
for optional synthetic reassessment. Send only fixture IDs, document metadata,
grade/model state and read-only criteria context; no applicant names, tutor notes
or PDF bytes. Uploaded PDFs remain unassessed. HTTP failures must not silently
fall back or save partial runs/corrections. Keep `evaluationSource: 'fastapi-mock'`
and raw Offer/Further review/Reject responses. The mock API is not authentication,
a persistent job service or document/decision access. Admin health is simulated.

The five domain tables are users, programmes, programme_memberships, applications
and documents. SQLAlchemy models in `backend/app/models/` are separate from
Pydantic HTTP schemas. Use lazy synchronous Psycopg 3 sessions; never migrate,
seed or call `create_all()` at FastAPI startup. Use explicit Alembic migrations.
The older membership schema does not override the frontend's single-owner policy
when future HTTP integration is implemented.

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
constraints, original PDF `bytea`, per-application document-type uniqueness and
specified deletion cascades/attribution restrictions. Database constraints alone
establish neither PDF readability, true SHA calculation nor the combined page
limit; those belong to the future upload service. Keep mutable databases, Python
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
Standalone E2E builds with `--mode e2e` to clear the optional API URL and serves
production output on port 4173. Do not rebuild `dist` during that suite. FastAPI
browser checks own ports 8001/5174 and accept `UCL_BACKEND_PYTHON`; use an executable
with installed backend dependencies. Backend checks from `backend/` are
`python -m pytest -q`, `ruff check .` and `ruff format --check .`; PostgreSQL tests
add `--run-postgres` only after the dedicated database safeguards are satisfied.

Last completed frontend verification (29 October, account/correction popups): 759
tests across 116 companions; 98.30% lines, 96.97% statements, 97.81% functions and
92.64% branches. TypeScript/production builds, lint/format and four focused browser
workflows with axe/focus checks passed. Earlier that day the quality refactor passed
all 16 standalone and both FastAPI browser workflows and verified 228 reachable
production modules without runtime cycles. Those broader browser/import audits
and backend unit/Ruff/PostgreSQL checks were not rerun for the popup changes.
These are dated results, not a substitute for checks after edits.

Origin is `https://github.com/jackmok33/final-year-project.git`. Inspect current
branch, status and remote state before committing; use `codex/` branches by default.
Respect requested scope and preserve unrelated backend/planning changes. Keep
credentials, dependencies, generated output, coverage/reports, local Figma snapshots
and macOS metadata out of commits. Root `.gitignore` owns shared ignore rules;
do not hide real source changes just to shorten status. Some local planning/design
assets are untracked and may not exist in a GitHub clone. Keep maintained Markdown,
agent context, scripts, lockfiles and canonical Figma state eligible for version control.

## Figma references

Prefer Figma MCP for design work and load the required Figma skills. The current
review file is `T0kdTyHiQDCy4NCIge7ssx` in the final year project team. MCP located
final page `50:27395`, then reached quota; do not claim its final node/token mapping
was retrieved. The supplied desktop export is
`/Users/jack_1/Downloads/UCL Application Review Workspace — Frontend Review.png`,
with later accepted UI changes recorded in the frontend guides. The earlier file
is `JUJzxkc6pTAUdqLOhBMhPu`. Inspect live state before resuming and respect the user's
deletions. Saved `design/figma/` scripts are snapshots, not safe to replay over the
current file. Do not recreate mobile presentation frames without a request.
