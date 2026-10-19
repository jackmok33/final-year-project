# Frontend verification — 19 October 2026

This record describes the current course, intake, ZIP-batch and criteria workflows.
It replaces the accumulated per-change notes; reproducible commands are in the
[frontend guide](README.md#checks).

## Latest checks

| Check                                | Result                                                             |
| ------------------------------------ | ------------------------------------------------------------------ |
| TypeScript and Vite production build | Passed                                                             |
| ESLint and Prettier                  | Passed                                                             |
| Unit, component and service tests    | 496 passed across 38 files                                         |
| Coverage                             | 98.84% lines, 97.64% statements, 98.88% functions, 92.78% branches |
| Standalone browser suite             | All 16 workflows passed                                            |
| FastAPI browser integration          | 2 workflows passed                                                 |
| FastAPI mock API tests               | 34 passed; backend code unchanged                                  |

The screen audit covers all 15 screens at 1440×1000 and 390×844, including the
mobile navigation drawer, with no critical or serious axe findings. Screenshots
of the desktop/mobile application review, including expanded details and history,
were visually checked. The correction action is visible in the first viewport on
both screen sizes.
Automated accessibility checks do not replace a full assistive-technology audit.

## Direct decision recording and optional notes

Tutors may select a different outcome from the AI recommendation without entering
an explanation. Every outcome uses the same optional review note. The UI and demo
service no longer enforce override reasons; original recommendations, decisions
and optional notes remain separate stored records. The evidence-review checkbox,
its state/props and the local decision command's acknowledgement field are removed.
The Record button saves directly without a required note, tick box or extra dialog.
Critical evidence still blocks final outcomes. The extra confirmation dialog, its
state/props and its display copy are removed. Deletion/reset/restore
confirmations retain the shared Confirm component. Further review remains unresolved.
Blank-note history uses Decision recorded, without implying agreement with the AI.

Browser workflows cover all 15 screens at desktop/mobile sizes,
correction followed by a blank-note decision, independent Offer/Reject recording,
saving without a checkbox or decision dialog, refresh persistence and duplicate-decision
protection. Desktop/mobile decision-form screenshots were saved. FastAPI integration
checks also pass after the review cleanup.

## Application review layout

The summary groups score, AI recommendation, tutor decision and the decision
action. Concerns appear before the explanation; raw flag codes and an empty
success panel are omitted. Sources remain visible while scoring rules, individual
section explanations and assessment history expand on demand. Re-evaluation is
inside history. Tests cover keyboard expansion, source navigation, old-run review,
returning to the latest result and disabled actions for historic results.
Processing/failed/unavailable results display no precomputed overall score.
No stored assessment, document, correction or decision records are changed by
this presentation update.

## Review cleanup and regression fixes

Recommendation cards and scoring-rule markup each have one rendering path.
Obsolete decision props, copy and a duplicate browser assertion are removed.
Queries and review state remain in the page files, with controlled visual sections
in components. A private controller keyed by application clears history expansion
and old-run selection when navigating away and back.

Assessment, evidence, correction and decision pages use only the query's current
application data. Regression tests cover loading a different record while the
query retains the preceding result, preventing stale forms and document display.
The correction form now starts from the actual extracted grade rather than a
hardcoded 74%; zero and fractional values are covered, and the browser workflow
explicitly enters the corrected value.
Accessibility audits wait for queried controls, fonts and finite animations to
settle before analysing contrast. The intake-switching workflow explicitly waits
for export data to finish loading.

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
  recommendation justification, direct decision recording without acknowledgement controls and optional
  review notes. Critical evidence blocks final decisions. New uploads have no
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
new upload API is included. The existing mock API supports the synthetic fixture
map. Backend source, contracts and PostgreSQL storage are outside this frontend PR.
Full PostgreSQL tests and backend Ruff checks were not rerun; the separate database
verification is recorded in the
[backend guide](../backend/README.md) and agent context.

Browser screenshots/traces are generated under ignored `test-results/frontend/`
and `test-results/backend/`; HTML reports are under ignored `playwright-report/`.
These checks do not validate official admissions policy or a university deployment.
