# Frontend verification — 19 October 2026

This record describes the current course, intake, ZIP-batch and criteria workflows.
It replaces the accumulated per-change notes; reproducible commands are in the
[frontend guide](README.md#checks).

## Latest checks

| Check                                | Result                                                             |
| ------------------------------------ | ------------------------------------------------------------------ |
| TypeScript and Vite production build | Passed                                                             |
| ESLint and Prettier                  | Passed                                                             |
| Unit, component and service tests    | 477 passed across 38 files                                         |
| Coverage                             | 98.79% lines, 97.23% statements, 98.75% functions, 92.34% branches |
| Standalone browser suite             | 14 workflows passed                                                |
| FastAPI browser integration          | 2 workflows passed: desktop and mobile                             |
| FastAPI mock API tests               | 34 passed                                                          |

The screen audit covers all 15 screens at 1440×1000 and 390×844, including the
mobile navigation drawer, with no critical or serious axe findings. Screenshots
of the desktop application queue and mobile criteria editor were visually checked.
Automated accessibility checks do not replace a full assistive-technology audit.

## Behaviour covered

- **Courses and intakes:** sign-in routes, private course creation by name,
  owner-only deletion, course/intake switching, deep links, refresh persistence,
  empty-course recovery and administrator separation. Forged assignment lists and
  admin status alone cannot grant applicant access.
- **ZIP batches:** numbered history, local upload date/time, pending-review counts,
  intake overview and whole-course CSV export. Imports cover optional outer
  folders, filename classification, missing documents, duplicate/unsafe paths,
  corrupt PDFs, compressed/extracted limits and the combined page limit.
  Validation and storage failures leave no partial batch or PDF writes.
- **Review and evidence:** original PDF viewing/download, document/page navigation,
  invalid citations, corrections with source/reason, preserved run history,
  recommendation justification, decision acknowledgement/confirmation and override
  validation. Critical evidence blocks final decisions. New uploads have no
  fabricated scores, facts or recommendations.
- **Criteria:** owner-only numeric editing, weight/threshold validation, stale and
  unchanged draft rejection, independent course versions and explicit
  re-evaluation. Clicking or keyboard-activating a history row populates the form
  without changing storage; saving creates a new version while preserving old
  criteria, runs and decisions. Discard restores the active version.
- **Persistence:** refresh, interrupted simulated evaluations, application/course
  deletion, PDF-inclusive backup/restore and reset. Legacy ownership/intake/batch
  upgrades preserve IDs, originals and history. Existing APP-2026-0148 uploads
  survive sample installation; SAMPLE-CSML cases use separate references. The v2
  completion marker repairs older incomplete default-batch upgrades and respects
  deliberate deletions.
- **Administration:** account roles/deactivation, existing-course metadata,
  simulated model recovery, local maintenance and storage errors. Metadata edits
  cannot transfer course ownership; owned courses are read-only account information.
- **HTTP integration:** real Uvicorn/Vite requests, response validation, updated
  numeric criteria, refresh persistence and evidence navigation. Disconnection
  surfaces an error without partial runs/corrections or silent local fallback.

Unit tests use Testing Library/jsdom and fake IndexedDB. PDF parsing and HTTP
boundaries are mocked there; Chromium exercises the actual PDF.js parser and
separate FastAPI integration servers. Coverage excludes test helpers, the React
bootstrap and declarative theme. Enforced minimums are 95% lines, 90%
statements/functions and 85% branches.

## Cleanup and boundaries

The cleanup removes unused domain-label aliases, an unused dataset alias and the
RTK health query left behind by the deleted connection banner. Layout and upload
pages reuse existing workspace results instead of subscribing again. No orphaned
production files were found. Compatibility models and migration code remain
because saved browser datasets and backups depend on them.

Pages retain queries, form state, validation and actions; controlled panels stay
in `src/components/`. Display copy uses the shared typed `useContent()` hook.
Local Public Sans and the shared UCL image avoid external font/image requests.
Responsive tables remain keyboard focusable.

Authentication, document assessment, inference and service-health data remain
simulated. Persistence is browser IndexedDB; no frontend-to-PostgreSQL switch or
new upload API is included. The small backend change only extends the synthetic
fixture map. Full PostgreSQL tests and backend Ruff checks were not rerun for
this frontend change; the separate database verification is recorded in the
[backend guide](../backend/README.md) and agent context.

Browser screenshots/traces are generated under ignored `test-results/frontend/`
and `test-results/backend/`; HTML reports are under ignored `playwright-report/`.
These checks do not validate official admissions policy or a university deployment.
