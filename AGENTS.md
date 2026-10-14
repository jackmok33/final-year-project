# Project context for agents

Last reviewed: 14 October 2026. Applies to this project and its subdirectories.
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
Vite, MUI, React Router, Redux Toolkit and RTK Query. All 12 approved screens and
browser-persistent demo workflows exist. A small stateless FastAPI scaffold now
exists under `backend/`, serving health and mocked assessments for seeded cases.
Real authentication, PostgreSQL, document assessment and local AI inference have
**not** been implemented. The demo adapter and new mock endpoints are replacement
boundaries, not the final HTTP API for the full application.

Read these maintained guides before changing the corresponding area:

- [Frontend README](frontend/README.md): startup, accounts, workflows and boundaries.
- [Component guide](frontend/src/components/README.md): page/component responsibilities.
- [Content guide](frontend/src/content/README.md): display copy and the shared hook.
- [Verification record](frontend/VERIFICATION.md): last completed checks and limitations.
- [Backend guide](backend/README.md): scaffold startup, mock HTTP contract and tests.

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
and PostgreSQL-backed LangGraph checkpoints are proposed. FastAPI and a Python
evaluation worker call a separate Qwen inference endpoint on UCL GPU hardware;
continuous availability, hardware, runtime and hosting access remain unconfirmed.
The database, worker and inference services remain planned. Do not restore
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
  button and one short demo label. Do not restore the marketing feature list,
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

Tutor screens: `/login`, `/applications`, `/applications/new`,
`/applications/:id`, `/applications/:id/evidence`, `/applications/:id/correct`,
`/applications/:id/decision` and `/criteria`.

Administrator screens: `/admin/health`, `/admin/users`, `/admin/programme` and
`/admin/data`.

The demo sign-in selects an account without a password. Seeded accounts are
`tutor-a` (Jack, both example courses), `tutor-b` (first course) and `admin-a`
(administration). All criteria are read-only for the MVP. Read the seed/README for
current details rather than assuming accounts cannot be edited.

Tutors see only assigned programmes. Programme selection controls the queue,
CSV export, upload destination and criteria editor together; an authorised
application link selects its course. Selection is remembered per account.
Administrator permission alone grants neither applicant-document access nor
admissions decisions nor criteria publication. Preserve UI and demo-service
permission checks. Browser demo controls are not real server authentication.

Tutors can create their own named programme workspaces using **New workspace**
in desktop/mobile navigation, even without existing programme assignments.
`workspace` is a dedicated demo command: it creates an empty programme and
independent example rubric, grants access only to the creator and returns its ID
for immediate selection. Names are trimmed, limited to 100 characters and unique
among that tutor's accessible workspaces (case-insensitive). Creation does not
grant publication/admin permissions. Admin metadata editing remains separate;
workspaces are included in dataset backup/restore and removed by demo reset.

Latest MVP decision on 14 October 2026 supersedes the earlier criteria-editing
request: **no account may change scoring weights or activate criteria**. The
criteria screen is read-only, including thresholds, margin and entry rule, and
the demo service rejects the `rubric` command. Admin publication controls are
removed. Legacy `canPublishCriteria` values remain solely for record/backup
compatibility and cannot bypass the MVP restriction. Preserve saved criteria,
historic runs and per-workspace defaults; do not reset user data. Owner/shared
criteria editing, document updates and the other expanded requirements remain
post-MVP work. The requirements review describes the earlier comparison against
the completed-system requirements, not the currently authorised MVP scope.

`Programme.createdBy` is optional creator ownership for tutor-created workspaces.
Old name-only workspaces recover it from their creation audit in the demo loader;
seeded/admin-created courses remain unowned shared courses. Metadata edits cannot
claim/transfer ownership. The `workspaceDeletion` query previews deletion counts;
`deleteWorkspace` requires assigned tutor access, creator ownership and explicit
confirmation. Deletion atomically removes the course, its applications/PDFs,
review history, criteria, associated audit entries and all user assignments,
then records the deletion event. The UI selects a remaining accessible workspace
or clears selection. Empty course datasets are valid for backup/restore.

## Behaviour and data invariants

- Recommendations and tutor decisions are separate records. Show **Why this
  recommendation** on assessment and decision screens, with source pages,
  criteria version, decisive rules and unresolved concerns.
- Critical unresolved evidence blocks final Offer/Reject decisions. Overrides
  require a reason. Final outcomes require tutor acknowledgement and confirmation;
  Further review keeps the case unresolved.
- Corrections require a reason and source reference. Preserve the original fact
  and create a new run; do not overwrite old runs or recorded decisions.
- Criteria are fixed/read-only for the MVP. Existing runs retain their original
  criteria and each course keeps its independent active criteria. Versioned
  activation is deferred; do not re-enable it without a newer user instruction.
- Rubric values and programme names are illustrative, **not UCL admissions policy**.
  Unavailable evidence/scores must not silently become zero.
- New uploads receive an explicit backend-unavailable state. Do not invent
  extracted facts, scores or AI explanations for newly uploaded documents.
- PDFs are validated for readability, at most 20 MB per file and 100 combined
  pages per application. Preserve originals and locally bundled PDF.js viewing.
  Validate citation document/run/page identities and encode navigation parameters.
- Records and PDF blobs persist in IndexedDB. Keep blobs outside Redux. The
  dataset/backup schema is version 2, with support for version 1 migration.
  The IndexedDB database schema version is separately defined in `storage.ts`.
- Session identity and per-account course selection use sessionStorage. Preserve
  refresh persistence and recovery of interrupted simulated evaluations.
- Backup/restore includes records, PDFs and history and applies only to this
  browser's demo dataset. Validate backups before replacement. Deletion/reset
  require confirmation. Failed writes must abort atomically and surface errors.
- PDF loading/rendering tasks must be cleaned up on errors, page changes and
  unmount. Service-health information remains visibly simulated.

## Design reference

Use the UCL theme already in `src/app/theme.ts`: dark purple `#361A54`, bright
purple `#993BFF`, off-white `#FAFAFA` and pale purple `#EEDEFF`, with labelled
green/amber/red status indicators. Font stack: `Aptos, Arial, sans-serif`.
Official UCL logo/font assets are not bundled. Preserve the 232 px desktop
sidebar, 72 px header, card hierarchy, responsive stacking and mobile navigation.

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
Playwright manages its preview on port 4173. Do not rebuild the production bundle
while that suite is running.

Last full verification on 14 October 2026: **337 frontend tests across 31 files**,
**31 Python API tests**, **8 demo browser workflows plus 2 real FastAPI integration
checks**, **98.15% frontend line coverage / 90.97% branch coverage**, with TypeScript,
lint, formatting and production build passing. Browser checks cover all 12
screens at 1440×1000 and 390×844 and find no critical/serious axe issues. These
results are a snapshot, not a substitute for validating later changes. Enforced
coverage minimums: 95% lines, 90% statements/functions and 85% branches.

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
