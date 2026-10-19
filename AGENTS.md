# Project context for agents

Last reviewed: 19 October 2026. Applies to this project and its subdirectories.
Read this file when starting a session, then inspect the code relevant to the
user's request. Follow newer user instructions when they change a convention
recorded here. Keep this context current after material architectural changes.

## Project and current milestone

The product is **UCL Application Review Workspace**, a final-year project for
human review of postgraduate applications. The intended complete system uses
local language-model evaluators for academic performance, CV/experience and
personal statements, with deterministic scoring and recommendations. Tutors
inspect evidence and record decisions.

The implemented milestone is the frontend under `frontend/`: React, TypeScript,
Vite, MUI, React Router, Redux Toolkit and RTK Query. All 15 screens, including
course, intake and ZIP batch selection, and browser-persistent demo workflows exist.
A small stateless FastAPI scaffold now
exists under `backend/`, serving health and mocked assessments for seeded cases.
An independent five-table PostgreSQL foundation exists; HTTP routes are not yet
connected to it. Real authentication, document assessment and local AI inference
have **not** been implemented. The demo adapter and mock endpoints are replacement
boundaries, not the final HTTP API for the full application.

Read these maintained guides before changing the corresponding area:

- [Frontend README](frontend/README.md): startup, accounts, workflows and boundaries.
- [Component guide](frontend/src/components/README.md): page/component responsibilities.
- [Content guide](frontend/src/content/README.md): display copy and the shared hook.
- [Verification record](frontend/VERIFICATION.md): last completed checks and limitations.
- [Backend guide](backend/README.md): mock API, database startup/migrations/seed and tests.

Local planning documents include `project-plan.md`, `project-requirements.md` and
`university-admissions-multi-agent-project-brief.md`. These are draft project
references, not official UCL policy. Some early plans describe one programme;
the current frontend supports multiple course workspaces at the user's request.

The proposed backend architecture is recorded in
[System architecture](design/architecture/system-architecture.md), with editable
overview and detailed-flow SVGs and a two-page PDF in
`output/pdf/system-architecture.pdf`. The user prefers plain boxes, short labels,
minimal prose and meaningful arrow labels for supervisor presentations.
The user selected PostgreSQL for application records, JSONB assessment outputs
and original PDFs stored as `bytea` in linked document rows. SQLAlchemy/Alembic
now implement the initial storage foundation. JSONB assessment outputs and
PostgreSQL-backed LangGraph checkpoints remain planned. The intended FastAPI and
Python evaluation worker will call a separate Qwen inference endpoint on UCL GPU hardware;
continuous availability, hardware, runtime and hosting access remain unconfirmed.
The worker and inference services remain planned. Do not restore
the earlier object-storage assumption as a required MVP dependency.

The FastAPI scaffold implements only `GET /api/v1/health` and
`POST /api/v1/mock/assessments`. `app/services/evaluation.py` defines the replaceable
`EvaluationService` and synthetic-only implementation; `app/schemas.py` validates
the contract. Python 3.11+ dependencies are pinned in `backend/requirements.txt`.
Enable the frontend with `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1` in ignored
`.env.local`, then restart Vite. Without it, standalone browser behaviour remains.
`src/services/evaluation.ts` selects the evaluator; `backend.ts` validates responses.
Only existing synthetic cases send IDs, document metadata and read-only criteria
context over HTTP; no applicant names, notes or PDFs are sent. Newly uploaded PDFs
still get no fabricated assessment. Browser permissions and IndexedDB history,
corrections, backups and originals remain in place. HTTP failures must not save
partial runs/corrections or silently fall back to local scores. Backend runs are
labelled `evaluationSource: 'fastapi-mock'`, an optional field compatible with the
existing dataset schema. The public mock endpoint provides no document/decision
access and is not real authentication or a persistent job service. Admin health
rows still show simulated browser services rather than monitoring the scaffold.

Run backend checks with `python -m pytest -q`, `ruff check .` and
`ruff format --check .` from `backend/`. `npm run test:e2e:backend` uses separate
ports 8001/5174 and a Python with installed backend dependencies; optionally set
`UCL_BACKEND_PYTHON` to its executable. Use a virtual environment outside OneDrive.

## PostgreSQL foundation (15 October 2026)

The authorised scope is **five domain tables**: `users`, `programmes`,
`programme_memberships`, `applications`, `documents`. SQLAlchemy models live in
`backend/app/models/`, separate from Pydantic HTTP schemas. `app/db.py` provides
lazy synchronous Psycopg 3 connections and transaction/session tools; importing
FastAPI does not import or connect the database. Alembic's versioned migration
creates actual tables; never migrate, seed or call `create_all()` at app startup.

Use Docker CLI (the user does not want screen control for Docker). From `backend/`,
copy `.env.example` to ignored `.env` and replace password placeholders in both
URLs and `POSTGRES_PASSWORD`. Run `docker compose up -d --wait`,
`alembic upgrade head`, then `python -m app.seed`. Docker uses `postgres:18.6`,
loopback-only configurable port 5432 and a named volume mounted at
`/var/lib/postgresql`, outside OneDrive. Normal container recreation preserves
data; do not remove the volume. See the backend guide for `psql` inspection commands.

Identifiers are `varchar(200)` with Python UUID defaults and existing textual IDs
supported. Timestamps are timezone-aware with server defaults. Users have separate
tutor/admin flags (at least one required), normalized unique emails and deactivation.
Programme codes are unique ignoring case; names can repeat. Ownership
(`created_by`, nullable for shared examples) and membership (composite user/course
key) are separate. These tables predate the 19 October single-owner frontend
model below; the future HTTP/database integration must use that ownership policy
instead of reintroducing shared assignments. The foundation schema remains
unchanged in this frontend milestone. Admin status alone gives no applicant access. The foundation is not authentication.

Applications reference their workspace and submitting tutor. Documents store
original PDF `bytea` with one row per application/type (transcript, CV, statement),
strict positive size through 20 MiB, 1–100 pages, canonical MIME, lowercase SHA-256
format and matching binary length. Readability, true hash calculation and the
combined 100-page limit belong to the **next upload-service milestone**. These
constraints do not parse PDFs. Programme/application deletion cascades to PDFs;
user deletion cascades memberships but restricts creator/submitter attribution.

The explicit seed only writes when **all five tables are empty**. It creates the
four demo accounts, the original two unowned example courses and four memberships;
applications/documents start empty. Repeated seeds never overwrite user edits or
regrant removed assignments. No browser import or frontend persistence switch.
Upload endpoints, assessment runs, fixed criteria, decisions and corrections remain
later MVP milestones; keep the existing mock routes/contracts unchanged.

PostgreSQL tests are opt-in: create `ucl_application_review_test` as described in
the backend guide and run `python -m pytest -q --run-postgres`. Both database URLs
must be configured; the guard rejects the development database and requires a
separate `_test` name before destructive operations. Default pytest runs skip
PostgreSQL tests and need no server. Never point destructive tests at development
data or run them concurrently against a shared test dataset.

On 15 October, 102 backend tests passed against real PostgreSQL 18.6; default
pytest passes 45 tests and skips 57 database tests. Ruff lint/format and pip checks
passed. Alembic upgrade/downgrade and model/schema comparison passed. Run
`python -m tests.verify_volume` separately to reproduce the container recreation
check (verified: identical stored PDF bytes and unchanged development row counts).
The development seed has 4 users, 2 programmes, 4 memberships and no applications
or documents. This snapshot does not replace validation after future changes.

## User's coding and interface preferences

- Page files and their exported components use the `Page` suffix, for example
  `LoginPage.tsx` and `LoginPage`.
- **Pages own screen logic:** queries, mutations, temporary form state, derived
  values, validation and event handlers. Extract visual forms and panels into
  components, passing typed values and callbacks. Do not turn a page into an
  empty wrapper around another component containing all its logic.
- A private draft controller in a page file is acceptable. Existing controllers
  are keyed to a record/run/version so switching records resets unsaved drafts.
- Reuse meaningful UI patterns. Check existing components before adding a
  duplicate. Avoid wrappers for every MUI control or generic tables that obscure
  different feature behaviour. PDF rendering/cleanup and other reusable UI
  mechanics can remain in their components.
- **Display text belongs in `src/content/`**, in matching `.content.ts` files
  mirroring the page/component folders. Every component/page that owns copy uses
  the **same typed `useContent()` hook** from `src/hooks/useContent.ts`. Do not add
  separate content hooks per component or page.
- Keep the login concise: UCL/workspace branding, account selector, Continue
  button. As of 19 October, omit demo/environment labels and connection notices.
  Do not restore the marketing feature list,
  repeated explanatory notices or read-only email field.
- Product text is **Application Review Workspace**, with UCL branding. The
  package name and persistence keys still use `ucl-admissions`; do not rename
  technical identifiers as a cosmetic wording change.

## Code map

All paths below are relative to `frontend/`.

| Path                      | Responsibility                                                              |
| ------------------------- | --------------------------------------------------------------------------- |
| `src/App.tsx`             | Lazy screen imports, routes and tutor/admin guards                          |
| `src/pages/`              | Screen composition and screen-owned logic                                   |
| `src/components/`         | Controlled visual sections, shared layout and UI mechanics                  |
| `src/content/`            | Display text, typed message formatters and content registry                 |
| `src/hooks/useContent.ts` | Shared typed content selector                                               |
| `src/app/`                | Redux session/interface state, RTK Query API, workspace selection and theme |
| `src/domain/`             | TypeScript models, deterministic scoring/routing and validation             |
| `src/services/`           | Demo service, IndexedDB, synthetic fixtures, PDFs and migration             |
| `src/test/`               | Shared test fixtures, mocks and rendering helpers                           |
| `e2e/workspace.spec.ts`   | Production-browser workflows, responsive and accessibility checks           |

Shared UI includes `common.tsx` (`Card`, `Page`, `Status`, `Loading`, `TwoColumns`,
`Confirm`, `Rationale`), `SummaryCards`, `FilePicker` and `evidence/EvidenceLink`.
EvidenceLink centralises citation navigation and document/page validation;
summary cards share queue/health presentation while each feature supplies values.

The application queue uses four columns: Application, Score, AI recommendation
and Decision (tutor record). The application reference opens the
assessment; flags and detailed workflow information remain there. Unfinished or
failed runs show their processing status instead of a recommendation/score, and
decisions from older runs are labelled Previous assessment. CSV exports retain
the fuller operational fields.

The content registry is `src/content/index.ts`. For example:

```tsx
const content = useContent("decisionForm");
const title = content.confirmationTitle(outcome);
```

Register new content files there. Use named formatter functions for dynamic
sentences instead of inline sentence fragments. Keep accessibility labels in
content too. Shared branding and domain labels already have content files.
Canonical status/outcome values, routes, input values, applicant records, tutor
notes and service-returned data are not display-copy resources. Components that
only render supplied values do not need empty content files or unused hook calls.

## Screens and permissions

Tutor screens: `/login`, `/modules`, `/modules/:id`, `/batches`, `/batches/:batchId`,
`/applications` (legacy full intake queue), `/applications/new`,
`/applications/:id`, `/applications/:id/evidence`, `/applications/:id/correct`,
`/applications/:id/decision` and `/criteria`.

Administrator screens: `/admin/health`, `/admin/users`, `/admin/programme` and
`/admin/data`.

The demo sign-in selects an account without a password. Seeded accounts are
`tutor-a` (Jack, all three example courses), `tutor-b` (starts without courses) and `admin-a`
(administration). Course owners can tune numeric criteria. Read the seed/README for
current details rather than assuming accounts cannot be edited.

Latest tutor navigation (15 October 2026) supersedes the sidebar workspace
dropdown: sign-in always opens **Courses**, with one card per owned course
(displayed by course name). Clicking a card or course sidebar link opens its intake
picker; choosing an intake opens **Upload batches**. Opening a batch shows its applicant rows. The sidebar contains module links
and a role/account/sign-out footer. Use **All courses** to return to the cards.
Admin navigation remains separate. Technical `Programme` IDs/models and `/modules`
routes stay in use. Sidebar labels wrap long course names; the compact header
keeps the full name in its title attribute.
As of 19 October, the header no longer has an intake-year shortcut button.
Intake selection remains on the course page; Upload batches and applicant queues
retain the selected intake in their subtitles and their existing Back links.

Queue rows, summary counts and uploads are scoped to the selected
module and intake; an opened upload batch additionally scopes rows and counts
to its own applicants. As of 19 October, **Export course results** is available
only on Upload batches and includes the entire selected course across all intakes
and batches. Keep intake year in CSV rows; queue filters do not limit this export.
`Application.intakeYear` is an optional additive field in the
version-2 dataset/backup: missing legacy values are populated once from the
existing programme year, preserving documents and history. New uploads record
the selected intake; valid descriptive legacy year labels remain supported.
The picker shows the configured year and previous two years plus any additional
populated years. Criteria versions apply to the whole course rather than an individual
intake. Per-account/per-module intake choices use sessionStorage
(`ucl-demo-intakes`) alongside existing workspace selection. An authorised
application deep link selects both module and intake; upload drafts reset when
either changes. This is frontend demo behaviour; backend intakes/integration
have not been implemented.

Tutors see only courses they own.
Administrator permission alone grants neither applicant-document access nor
admissions decisions nor criteria publication. Preserve UI and demo-service
permission checks. Browser demo controls are not real server authentication.

Tutors can create their own course workspaces using **Add course**
on the Courses page, even without existing courses.
`workspace` is a dedicated demo command: it creates an empty programme and
independent example rubric, grants access only to the creator and returns its ID
for opening its intake picker. As of 19 October the form asks only for **Course name**
(such as `Data Science & AI MSc`), superseding earlier code-only tutor creation.
Names are trimmed, preserve case, spaces, punctuation and Unicode, and must contain
1–100 characters. The page and service share `domain/courseName.ts` validation.
The command accepts `name` and generates `code = COURSE-<uppercase UUID>` for model,
CSV and backup compatibility. Names already owned by the same tutor are
rejected ignoring case; different tutors can create independent courses with the
same name. Administrator metadata forms only edit existing courses and preserve
course names and ownership. Administrator course creation and assignment controls
are removed. Tutor cards/navigation/headings and admin owned-course labels show
`Programme.name`.
The three browser examples are **Computational Statistics and Machine Learning MSc**,
**Machine Learning MSc** and **Computer Science MSc**. The loader upgrades only
unchanged old shared example labels while preserving IDs, edits, histories, PDFs
and intake selections. During that upgrade it adds the third empty example and
independent rubric if there is no ID/code/rubric conflict. Jack receives access
only if he still has both earlier courses and a tutor role. Subsequent loads do
not recreate a deleted example. Ownership is authoritative over legacy assignments. The independent
backend seed remains at two courses and never overwrites existing PostgreSQL rows.
Creation does not
grant publication/admin permissions. Admin metadata editing remains separate;
workspaces are included in dataset backup/restore and removed by demo reset.

Latest criteria decision on 19 October 2026 supersedes the earlier read-only MVP
restriction: an active tutor can tune section weights, offer/reject thresholds and
the review margin for their own course. Weights must total 100%; thresholds and
margin must pass `validateRubric`. The unimplemented mandatory academic rule is
hidden from the UI at the user's request for the professor demonstration. Its
stored value remains fixed for backup/mock API compatibility. Do not show disabled
placeholder controls for functionality that is not implemented. **Save criteria**
creates and activates a new version, retaining all previous versions, assessment
results and tutor decisions.
Only a subsequent explicit evaluation/correction uses the new active criteria.
Draft state lives in `CriteriaPage` and resets on course/active-version changes.
Version history rows are accessible buttons: clicking or keyboard activation
loads that version's numeric settings into the form, highlights the selected row,
announces the loaded version and returns focus/scroll to the form. Selection makes
no storage change. Save keeps the current active ID/version/internal rule as its
base and creates a new version through the existing command; never submit the
historic ID or reactivate/mutate an old record. Discard or selecting the active
row restores active settings. History selection is disabled during saving and
for accounts without editing access.
The demo `rubric` command checks ownership, rejects stale/unchanged/invalid drafts,
generates version metadata and saves the version/active pointer/audit atomically.
Admin permission and legacy `canPublishCriteria` flags grant no editing rights.
Versions remain browser-persistent and join existing backup/restore; no HTTP
editing endpoint or PostgreSQL criteria table is implemented. Document updates
and other expanded requirements remain later work. Do not reset existing data.

## Single-owner courses (19 October 2026)

Each course belongs to one tutor. `Programme.createdBy` is the sole owner for
new courses, and tutor access requires both the tutor role and matching ownership.
`User.programmeIds` is retained only as a compatibility projection, recalculated
from ownership; it must never independently grant applicant, PDF, criteria or
batch access. `useWorkspace` filters by ownership too. Jack owns all three sample
courses and may delete any of them; tutor B and the inactive former tutor start
without courses and can create private courses after an active tutor sign-in.

`assignCourseOwners` in `services/migration.ts` upgrades saved data without a reset:
keep an explicit owner, otherwise recover the creation-audit actor, otherwise use
the first active tutor already assigned (falling back to the first inactive
assigned tutor). Remove all shared assignments by rebuilding the compatibility
lists. Legacy unassigned records without a creator stay as administrator metadata;
do not grant arbitrary applicant access. IDs, PDFs, runs, decisions and corrections
remain intact. Backup validation works on a clone and applies the same ownership
upgrade before restore. Existing version-1/version-2 backups remain supported.

Administrators edit account roles/status and existing course metadata. Owned-course
lists are read-only; no assignment checkboxes, course transfer or administrator
course creation is supported. The service rejects forged assignment changes and
metadata creation. Metadata edits preserve the stored owner. Deactivation or
removing the tutor role retains ownership and attribution while blocking tutor
access; restoring the role restores the owner's access.

`workspaceDeletion` previews application, document and criteria counts.
`deleteWorkspace` requires owner tutor access and explicit confirmation, including
for seeded examples. Deletion atomically removes the course, its applications,
original PDFs, batches, review history, criteria and related audit entries, then
records the deletion event. There is no other-tutor count or shared-access warning.
The owner opens **Delete course** from the intake page. The UI returns to Courses,
preserves other courses and offers Add course when none remain. Empty datasets
remain valid for backup/restore. This changes browser demo behaviour; PostgreSQL
models, tables and HTTP routes are unchanged in this milestone.

## ZIP upload batches (15 October 2026)

The ZIP format/limits help panel is removed while real archive requirements are
unconfirmed. Keep the upload panel concise; current demo importer validation
remains in the service layer.

`/batches` is the intake landing page, showing ZIP upload controls and batch
history. As of 19 October, a three-card overview above **Upload applications**
shows **Total applicants**, **Offers given** and **Reviewed by tutor** (reviewed / total), scoped to all
applications in the selected course/intake, across batches and individual uploads.
Offer and review totals use only the latest tutor decision matching the current assessment; AI
recommendations and older-assessment decisions do not. Further review counts as a
human review but remains unresolved. Loading/failing queries never show false
zero counts, and upload controls remain usable. The action is **Upload batch**,
with **Uploading…** while busy. The shared `SummaryCards` adapts to the number of cards.
Previous batches appear as rows labelled **Batch 1, Batch 2, …**, with local upload date/time (24-hour
format) and applicant count. `/batches/:batchId`
reuses `ApplicationsPage` for that batch's applicant rows, without an export action.
Authorised batch deep links select their module/intake; forbidden/missing batches
must never fall back to another queue. Assessment links back to its batch.
Page-header return links use a left-arrow icon and **Back**, retaining explicit
parent destinations rather than browser-history navigation. Put Back last in the
page actions so it remains at the far right; the shared Page toolbar right-aligns
actions at desktop and mobile widths. This applies to the
course intake picker, upload batches, applicant queue, assessment, evidence and
criteria views. **Admission criteria** is linked only from Upload batches; the
application queue no longer has a criteria shortcut. The global **All courses**
navigation and form-level actions retain their existing labels.
Batch rows also show **Pending human review**, calculated as applications without
a latest tutor decision matching the current run. Recorded Further review counts
as reviewed, while remaining unresolved. New/no-run/failed and superseded-run
decisions remain pending. `currentDecision()` shares this rule with the dashboard;
`BatchSummary.pendingReviewCount` is derived, never persisted in batch metadata.
The browser seed now has two additional CSML batches (2 applicants/1 pending and
1 applicant/0 pending), giving 8 CSML applicants and 3 batches in the 26/27 intake.
The original 5-applicant batch remains intact. `addSampleCourseBatches()` upgrades
unchanged existing example courses once, preserving PDFs, decisions and histories.
An audit marker prevents deleted examples from returning; ID conflicts and edited
course names/ownership are preserved. Sample originals use real synthetic PDFs.
The completion marker is now `sample-csml-batches-v2`. The older v1 marker could
be saved before installation, so it is not sufficient proof that defaults exist.
The loader checks actual batch metadata, repairs grouped legacy synthetic cases,
and adds missing defaults. Existing runs, decisions and PDF bytes are preserved;
deletion audit events are honoured. Mark v2 complete only when defaults are present
or inserted, in the same atomic storage write. Conflicts do not consume completion
and can be retried later. Fresh profiles and older saved browser profiles must
both show the code-defined defaults without requiring a browser-data reset.
Samples use `SAMPLE-CSML-01` through `SAMPLE-CSML-03` so they cannot take the
sequential references used by existing uploads. Earlier sample references remain
supported by the mock API for browser-data compatibility.
FastAPI's existing mock fixture map also recognises the three sample cases;
its HTTP contracts and PostgreSQL foundation are unchanged.
`/applications` remains a legacy full-intake route; individual uploads are still
supported and grouped with earlier applications, rather than added to a ZIP batch.

`UploadBatch` metadata and optional `Application.batchId` / `Dataset.batches` are
additive version-2 fields. The loader groups earlier records into a batch per
module/intake, keeping IDs, PDFs and review histories. Its internal metadata
retains **Existing applications**; the table displays its batch number. No fake
ZIP filename or uploader is assigned to earlier records.
Batch numbering is computed chronologically within each module/intake (stored
order breaks equal-timestamp ties). Both list and detail queries return the same
sequence; newest rows display first. Table rows have no example/individual-upload
descriptions. Batch detail uses the numbered heading and retains original metadata.
New ZIP imports retain their true filename, uploader and timestamp, and separate
uploads remain separate batches even for repeated filenames/candidate references.

Use one folder per applicant, with CV/transcript/statement PDFs directly inside;
one common outer folder is accepted. The folder name becomes candidate reference.
Common resume/transcript/personal-statement filenames are recognised; ambiguous
names, duplicate types, unsafe/duplicate paths, non-PDF documents and unreadable
PDFs reject the whole import. Missing document types remain missing. Limits are
100 MB compressed, 200 MB extracted, 100 applicants, 20 MB per PDF and 100 combined
pages per applicant. macOS ZIP metadata is ignored and archive entry count is capped.
`services/zip.ts` uses pinned fflate for bounded extraction; `batchImport.ts`
prepares records/PDFs before one atomic IndexedDB commit in the demo service.
Temporary archive references stay outside Redux and are released after mutation.

Batch metadata and original extracted PDFs persist and join browser backup/restore,
workspace deletion and reset. The ZIP container itself is not retained. Backups
still have a 100 MB cap; validate batch uniqueness, uploader/module references and
application module/intake/batch consistency before replacement. A refresh before
an import is committed requires reselecting the ZIP; no partial records should remain.
New uploads have no fabricated extraction, scores or recommendations. This is
frontend/browser persistence only; no new FastAPI routes or PostgreSQL batch tables
are implemented. Keep the five-table backend foundation unchanged for this milestone.

## Behaviour and data invariants

- Recommendations and tutor decisions are separate records. Show **Why this
  recommendation** on assessment and decision screens, with source pages,
  criteria version, decisive rules and unresolved concerns.
- Critical unresolved evidence blocks final Offer/Reject decisions. Overrides
  require a reason. Final outcomes require tutor acknowledgement and confirmation;
  Further review keeps the case unresolved.
- Corrections require a reason and source reference. Preserve the original fact
  and create a new run; do not overwrite old runs or recorded decisions.
- Criteria tuning requires active tutor ownership of the course. Saving numeric
  settings creates a new version for future assessments. Existing runs and tutor
  decisions retain their original criteria; each course keeps its own active version.
  Legacy academic-rule text stays internal and fixed; it is not an editable or
  disabled UI field. Do not auto-reassess applicants on save.
- Rubric values and programme names are illustrative, **not UCL admissions policy**.
  Unavailable evidence/scores must not silently become zero.
- New uploads remain unassessed. Show neutral Not assessed / No assessment available
  text instead of technical backend-unavailable warnings. Preserve the internal
  unavailable flag/state and never invent extracted facts, scores or AI explanations.
- PDFs are validated for readability, at most 20 MB per file and 100 combined
  pages per application. Preserve originals and locally bundled PDF.js viewing.
  Validate citation document/run/page identities and encode navigation parameters.
- Records and PDF blobs persist in IndexedDB. Keep blobs outside Redux. The
  dataset/backup schema is version 2, with support for version 1 migration.
  The IndexedDB database schema version is separately defined in `storage.ts`.
- Session identity and per-account module/intake selection use sessionStorage. Preserve
  refresh persistence and recovery of interrupted simulated evaluations.
- Backup/restore includes records, PDFs and history and applies only to this
  browser's demo dataset. Validate backups before replacement. Deletion/reset
  require confirmation. Failed writes must abort atomically and surface errors.
- PDF loading/rendering tasks must be cleaned up on errors, page changes and
  unmount. Service health remains simulated internally; do not treat it as actual
  external-service monitoring, even though the user has removed repeated UI notices.

## Interface notice cleanup (19 October 2026)

The user explicitly removed recurring notices that the app is a demo or is not
connected to a backend. This supersedes earlier requirements for visible demo
labels, simulation hints, connection banners and integration warnings. Remove
these from sign-in, the header, ZIP/batch views, uploads, assessments, criteria and
administrative pages. Keep actual operation/validation errors, evidence concerns,
confirmation dialogs and storage-replacement/deletion consequences.

The unused BackendConnection component, its content and tests are deleted;
AssessmentPage no longer polls backend health solely for a banner. HTTP evaluation
and API health support remain intact, as do `evaluationSource` / `simulated`
metadata. `hasUnavailableAssessment` detects the existing backend-unavailable flag
for presentation: display neutral status text and suppress unavailable-score
recommendations, stale justification rules and integration-specific messages.
Stored runs, originals and history are unchanged. SummaryCards permits omitted
hints, avoiding empty or repetitive environment captions. Fixture names, service
responses and operation-specific backup/reset labels remain data, not blanket
notices to restore. Documentation continues to describe the actual mocked and
browser-only integration boundaries; no backend capability was added by this UI
change.

## Design reference

Latest visual direction (15 October 2026): the user and supervisor prefer a plain
**Mantis-style interface**. This supersedes the earlier UCL purple theme and Figma
shell dimensions. The supplied reference is Mantis React Next TypeScript 4.0.1,
locally at `/Users/jack_1/Downloads/mantis-react-next-ts-4.0.1`. Adapt its visual
patterns within the existing React/Vite/MUI application; do not migrate to Next.js
or copy its demo routes, authentication or backend integrations.

`src/app/theme.ts` owns a white/light-grey palette, charcoal text, restrained blue
controls and labelled green/amber/red statuses. Public Sans is self-hosted through
`@fontsource/public-sans` (Latin weights 400/500/600/700); no external font request
is required. The action blue is darkened for accessible white labels. Preserve
the 260 px sidebar, 64 px white header, bordered card headers, compact typography,
responsive stacking, mobile drawer and centred concise sign-in card. Keep theme
tokens in components instead of restoring hard-coded purple colours. Product
name remains. The sidebar shows only the UCL logo; sign-in shows it alongside
Application Review Workspace (stacked on mobile). `components/UclLogo.tsx` reuses
the locally bundled white portico/lettering PNG on black, requested by the user
on 19 October. `src/assets/README.md` records its UCL Indigo source and CleanPNG
visual reference. Do not use the watermarked preview or hotlink images at runtime.
UCL fonts are not bundled.

The Figma file is `JUJzxkc6pTAUdqLOhBMhPu`. When doing Figma work, prefer Figma MCP
as requested by the user and follow the applicable Figma skills. Local saved
design references are in `design/figma/`, including its README and construction
scripts. Those scripts are snapshots, not safe to replay over the completed file.
MCP quota blocked work on 9–10 October; check access again if a task needs it.
The recommendation-justification refinement is implemented in the frontend,
while the local design notes record its pending Figma-canvas update.

The app currently uses a shared loading state, including a route-level Suspense
fallback. Keeping the layout visible during loading was discussed but has not
been implemented; do not describe it as completed work.

## Runtime and verification

Use **npm and Node 24+**, with the committed lockfile. On this machine:

```sh
export PATH=/Users/jack_1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
cd frontend
npm ci
npm run dev
```

Use an installed Node 24+ runtime on other machines. Do not depend on the local
absolute path there. Vite's regenerable cache is configured in the system temp
directory to avoid problems with the OneDrive-synced workspace.

Run checks appropriate to a change; for substantial UI/logic changes:

```sh
npm run lint
npm run format:check
npm run test:coverage
npm run build
npm run test:e2e
```

`npm run format` applies formatting. Tests live alongside code as `*.test.ts` or
`*.test.tsx`; use the existing Testing Library/jsdom and fake IndexedDB utilities.
Test behaviours and failure cases, not just implementation details. Keep fixes
for discovered bugs covered by meaningful regression tests.

For Chromium, use `npx playwright install chromium` on a new machine. This local
session installed it at `/private/tmp/ucl-admissions-browsers`; if that directory
exists, run `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/ucl-admissions-browsers npm run test:e2e`.
The standalone browser script builds with Vite `--mode e2e`, explicitly clearing
the optional API URL so local `.env.local` cannot require a running backend. The
separate backend suite retains its own integration servers and artifact directory.
Playwright manages its preview on port 4173. Do not rebuild the production bundle
while that suite is running.

Latest frontend verification on 19 October 2026 after the cleanup:
**477 tests across 38 files**, **98.79% line / 92.34% branch coverage**;
TypeScript, production build, lint and formatting pass. All **14 frontend browser
workflows** and **2 FastAPI browser workflows** pass. The 15-screen desktop/mobile
audit at 1440×1000 and 390×844 finds no critical/serious axe issues, including the
mobile drawer and criteria history interaction. Browser checks cover private
courses, ZIP batches, default-data upgrades, PDF originals, corrections, decisions,
versioned criteria, refresh, deletion and backup/restore/reset. The mock API suite
passes **34 tests**. Full PostgreSQL tests and backend Ruff were not rerun for this
frontend change; the database foundation remains unchanged. See
[frontend verification](frontend/VERIFICATION.md) for coverage and limits.

The cleanup removes unused domain-label and dataset aliases, plus the RTK health
query left behind by the deleted connection banner. Layout and upload pages reuse
workspace results. The HTTP health helper/contract and saved-data compatibility
code remain. These results are a snapshot, not a substitute for validating future
changes. Enforced coverage minimums are 95% lines, 90% statements/functions and
85% branches.

## Repository and handover

Git is initialized at the project root. `origin` is
`https://github.com/jackmok33/final-year-project.git`; `main` tracks `origin/main`.
The initial upload was commit `f5e8666` and contained **only `frontend/`**.
Root planning documents, guidelines, design/output folders and scripts were
left untracked. They may be available locally but absent from a GitHub clone.
Inspect current Git state before changing it and respect the requested commit
and push scope; do not stage unrelated root files along with frontend changes.

Do not commit dependencies, build output, test reports, coverage, local environment
files or macOS metadata. Preserve unrelated user changes. In handovers, state
what changed, what was verified and what remains simulated or incomplete. Update
the relevant guides and this context when the recorded architecture changes.

The root `.gitignore` owns repository-wide ignore rules; do not duplicate them in
`frontend/.gitignore`. Generated `output/` documents, local Figma inspection
snapshots and `FYProjectGuidelines.pdf` remain local-only. Keep maintained Markdown,
rendering/design scripts, `AGENTS.md`, package lockfiles and canonical Figma
`state.json` / `final-state.json` eligible for version control. Do not hide source
changes simply to shorten Git status.
