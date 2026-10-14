# Frontend verification — 14 October 2026

Verified with Node 24 and Chromium against the production demo bundle, plus the
optional FastAPI integration using local development servers.

The application queue uses four columns: Application, Score, AI recommendation
and Decision. Browser checks verify the headers and linked application references;
component tests cover missing scores, processing/failed states, independent AI
recommendations and tutor decisions, and labels for decisions from older runs.

| Check                                    | Result                                               |
| ---------------------------------------- | ---------------------------------------------------- |
| TypeScript and Vite production build     | Passed                                               |
| ESLint                                   | Passed, no warnings                                  |
| Prettier                                 | Passed                                               |
| Vitest unit, component and service tests | 337 passed across 31 files                           |
| Unit coverage                            | 98.15% lines, 90.97% branches                        |
| Playwright browser workflows             | 8 demo workflows + 2 FastAPI checks passed           |
| Python API tests                         | 31 passed                                            |
| Backend Ruff lint and formatting         | Passed                                               |
| Responsive screen coverage               | All 12 screens at 1440×1000 and 390×844              |
| Automated accessibility                  | No critical or serious axe findings on those screens |

The browser tests cover course workspace switching on desktop and mobile,
per-account selection persistence, admin course creation/assignment, role guards, real PDF parsing and page citations,
correction history, read-only programme criteria, final-decision confirmation and override
validation, CSV export, refresh persistence, account/programme editing, local
deletion, PDF-inclusive backup/restore and reset. They exercise corrupt, oversized
and over-page-limit uploads and the backend-unavailable state. Keyboard checks
cover sign-in, the skip link and PDF file selection. Service tests verify recovery
of interrupted simulated runs and preserve old facts, decisions and criteria.
They also check independent active criteria per course, multi-course backups, and
version 1 storage/backup migration without discarding original reviews or PDFs.

The MVP criteria screen is read-only for all accounts, including workspace
creators and accounts with legacy publication permission. Draft/activation and
administrator publication controls are absent. The service rejects criteria
updates, and tests verify preserved weights, previous versions and original run
references after attempted changes. Existing active criteria are retained rather
than reset; newly created workspaces receive the default example rubric.

Tutor-created workspaces are verified on desktop and mobile: name-only entry,
keyboard submission, automatic selection, duplicate-name errors, independent
queues, uploads, refresh persistence and exclusion from other tutors' access.
The creation dialog passes axe checks once its opening transition finishes.
Service tests verify example criteria initialisation, permission preservation,
name validation, workspace backup/restore and reset. Component tests cover
first-workspace creation, cancellation, long names and surfaced storage errors.

Creator-only workspace deletion is verified with populated workspaces, original
PDF removal, criteria/history cleanup, assignment removal, confirmation and
cancellation. Desktop/mobile dialogs pass accessibility checks. Assigned tutors
cannot delete another tutor's workspace. Refresh preserves deletion, unrelated
courses remain available and deleting the last accessible course permits creating
a new workspace. Unit/service checks cover deletion failures and retries,
ownership recovery from earlier creation audits, immutable ownership during
metadata edits, PDF-inclusive restore and backups with no remaining courses.

Desktop and mobile screenshots are saved under `test-results/`; the browser
report is in `playwright-report/`. Both are generated, ignored artefacts. Visual
review checks the sidebar/header, stacked panels, document canvas, forms and
recommendation hierarchy. Wide data tables scroll inside their cards on mobile.
Automated accessibility checks are limited to their rules and do not replace a
full assistive-technology audit.

Authentication, inference and admin service-health rows remain simulated. Newly
uploaded PDFs receive no invented scores. IndexedDB persistence and backups
apply to the current browser's demo dataset. These checks do not validate a real
admissions policy, database/inference service or university deployment.

The FastAPI scaffold is verified separately: real HTTP reassessments on desktop
and mobile return the expected weighted score, recommendation, criteria identity,
source citations and explicitly mocked rationale. The returned run survives
refresh; original PDF/page navigation works and axe finds no serious/critical
issues on the connected assessment screen. An aborted request surfaces an error
and preserves the previous run. Unit/service tests cover malformed responses,
HTTP failures, no fabricated scores for new uploads, permission checks before
requests, correction rollback, run history and PDF-inclusive backup/restore of
backend results. The health request measures API connectivity only; PostgreSQL,
real document processing, LangChain/LangGraph and Qwen remain unconnected.

The Python tests cover the HTTP contract, seeded outcomes, null scores, critical
evidence, inclusive margins, mock model failure/recovery, invalid criteria and
document references, rejection of non-seeded cases, CORS, OpenAPI and replacement
of the evaluator dependency. Backend tests use FastAPI's in-process TestClient;
the two additional browser checks run actual Uvicorn/Vite servers on ports
8001/5174. See [backend guide](../backend/README.md) for reproducible commands.

See [README.md](README.md) for reproducible commands, demo accounts and the
backend integration boundary.

Unit tests cover all 12 pages, their controlled visual sections, lazy route imports,
role guards, per-user Redux session/course persistence, RTK Query mappings and
cache invalidation, scoring, simulated evaluation, PDF inspection/viewer cleanup,
IndexedDB writes, administration validation, migration and backup integrity.
The PDF parser is mocked in unit tests and exercised directly in Chromium.
Coverage excludes test helpers, the React bootstrap and declarative theme;
minimum aggregate thresholds are enforced by `npm run test:coverage`.

Regression tests exposed and verified fixes for string error messages being
replaced with generic text; a crash when no courses are configured; invalid
recommendation/section evidence links and unencoded document/run identifiers;
an invalid default correction page for one-page transcripts; partial PDF changes
after a failed IndexedDB transaction; and leaked PDF loading tasks after parsing
fails. Failed writes now abort the full transaction, and failed PDF loads release
their task while preserving the original error.

The revised component refactor was verified with the same checks. All 12 pages
own their screen queries, form state and actions, composing controlled forms and
visual panels under `src/components/`. Routes, document handling, session state, permissions,
criteria and persistent demo behaviour are preserved. The component structure is
documented in [src/components/README.md](src/components/README.md).

The reuse audit consolidated summary-card layouts and evidence links, and reused
the existing two-column layout for application uploads. Citation tests cover
encoded identifiers, missing or mismatched documents and invalid page numbers.
Correction guidance now opens page 1 for a one-page transcript and disables the
source link when the transcript is absent. Page logic remains in the page files.

The content refactor was verified with the complete unit and browser suites.
Display copy now lives in matching `src/content/` files and is selected through
one typed `useContent()` hook. Tests cover key selection and typing, dynamic
decision/criteria messages, missing text values and operational-log line breaks.
Canonical outcomes, workflow values, route guards and page-owned queries and
form state are preserved. Vite uses the shared branding content for the browser
title. See [src/content/README.md](src/content/README.md) for the content convention.
