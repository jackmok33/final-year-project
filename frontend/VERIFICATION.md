# Frontend verification — 29 October 2026

This snapshot covers the account menu and correction popup changes, following the
frontend quality refactor and supplied Mantis integration. Earlier snapshots remain
below. Startup and reproducible commands are in the
[frontend guide](README.md#checks).

## Account menu and correction popup — 29 October

The avatar menu now offers Change password and Logout, without All programmes.
The Mantis password form validates required/matching/new values, clears drafts on
close and makes no password-storage or authentication request. A valid submission
explains that saving needs account authentication; sign-in behaviour is unchanged.

Update detail opens the existing source-based correction form in the supplied
Mantis dialog within AssessmentPage. The standalone correction layout and its
unused guidance component/content/tests were removed. Existing `/correct` links
open the popup in the review shell; historical links remain read-only. Cancellation
preserves the selected tab, and successful correction selects the latest run.
Busy saves disable edits/dismissal, failures retain the draft, and keyed mounted
guards prevent a late save from redirecting a different record or replacement run.

All 759 tests across 116 colocated companion files pass with one worker. Coverage
is 98.30% lines, 96.97% statements, 97.81% functions and 92.64% branches.
TypeScript, standard/e2e production builds, ESLint, Prettier, test-layout and
whitespace checks pass. Four targeted production-browser workflows pass: desktop
routes and role guards, account form/Logout, correction/save/history, and the
redesigned review flow. These include keyboard focus restoration and axe audits;
both popup screenshots were visually inspected.

Saved browser data and backend contracts are unchanged. The full standalone and
FastAPI browser suites and backend/PostgreSQL checks were not rerun for these UI
changes; their earlier results and scope remain below.

## Frontend quality review — 29 October

The UI now depends on typed service contracts and `admissionsService` for
queries/commands/original documents. Temporary files, error normalisation and
local backup previews have focused service modules. Demo storage, permissions,
locking and atomic writes remain behind the selected adapter. No UI module
imports demo storage or its internals. The service guide documents the future
FastAPI replacement point without presenting local demo commands as HTTP routes.

Shared domain helpers now provide current-decision counts and document limits;
pages retain their filtering, sorting, drafts and mutations. Shared mounted-state
guards prevent late callbacks from redirecting or updating another screen.
Application drafts reset by account, course, intake and batch; canonical tutor
ownership replaces the legacy assignment-array check. Restore previews are released
after cancellation/navigation while confirmed restores retain references until
completion. Backend response guards are named, reject malformed nested fields
and non-string timestamps, and normalise optional nulls without mutating input.

The final import audit found all 228 production modules reachable, including
dynamic imports, with no runtime cycles or removable dependency. Unused exports
and one registry selector were removed; migrations, saved history, original PDFs
and supplied Mantis components remain. Independent integrated reviews found no
remaining blocking regression in the changed scope.

| Check                                   | Result                                                             |
| --------------------------------------- | ------------------------------------------------------------------ |
| Naming/colocation                       | 116 matching companion files; no missing/orphaned runtime tests    |
| Unit/component/service coverage run     | 742 tests passed with `--maxWorkers=1`                             |
| Application coverage                    | 98.31% lines, 97.12% statements, 97.77% functions, 92.50% branches |
| TypeScript and Vite production build    | Passed                                                             |
| ESLint, Prettier and whitespace         | Passed                                                             |
| Standalone production-browser workflows | All 16 passed                                                      |
| FastAPI integration workflows           | Both desktop and small-screen workflows passed                     |

All newly added runtime helpers and the revised backend-response validator have
100% line/branch coverage in this run. Coverage thresholds are unchanged.
Duplicate helper tests now live beside their implementation; shared summary tests
cover the meaningful outcome rules from the removed unused helper.
Browser checks cover actual PDF.js, ZIP import/rollback, roles, criteria, decisions,
refresh recovery, backup/restore/reset, keyboard navigation and axe audits.

The current browser adapter and existing mock assessment HTTP contract retain
their behaviour. Real authentication, PDF-upload endpoints and PostgreSQL-backed
HTTP routes remain later work. Backend source, database data and unrelated local
planning edits were not changed; backend unit/Ruff/PostgreSQL checks were not rerun.

## Mantis reuse audit — 28 October

Checked actual tutor-screen imports against the supplied Mantis source. Cards,
statistics, navigation/shell, tabs, pagination, uploads and form/table patterns
reuse supplied components or documented compositions. MUI imports are expected
because the template itself uses MUI. No suitable standalone Mantis admissions
table/form was found that would replace the product-specific compositions.

Extracted the reusable structure from Mantis's supplied CustomizedDialog example
into a controlled adaptation shared by DecisionPage and LoginPage help. Removed
the separate DecisionDialog component, tests and content; dialog copy now belongs
to its calling pages. Preserved accessible titles, focus restoration and busy
dismissal guards. The browser accessibility audit also caught invalid list
semantics in login help; its account choices now use proper ListItem rows.

All 62 original source/asset hashes and five layout-reference hashes match the
supplied folder. All 54 focused tests across the shared dialog, login, decision,
assessment and routes pass. Two production-browser workflows pass, covering
login help, review navigation, decision cancellation and all three saved outcomes,
with axe audits. TypeScript/build, ESLint, Prettier, test-layout and whitespace
checks pass. Full unit/coverage/browser suites and backend checks were not rerun
for this small reuse change; earlier snapshots below keep their original scope.

## Applicant decision popup — 28 October

Assessment now has four tabs. The green Decision button and blue Re-run AI
evaluation action sit in the summary card. Decision opens the existing outcome
form in a Mantis-themed dialog. Cancel, close and Escape return to the underlying
tab/document context; saving closes the dialog. Existing decision links remain
usable, historical links show an informational read-only dialog, and critical
evidence still blocks final decisions. Save errors retain the draft, saving blocks
edits/dismissal, and a late save cannot redirect an unmounted popup.

All 678 unit/component/service tests across 109 colocated companion files pass
with one worker. TypeScript/production build, ESLint, Prettier, test-layout and
whitespace checks pass. Five targeted production-browser workflows pass: revised
navigation, all three saved outcomes, correction/history guards, re-evaluation
recovery and keyboard/small-screen access. Both FastAPI browser workflows also
pass with the unchanged mock HTTP contract.

The review and popup screenshots were visually inspected. Axe passes for the
requested screen and dialog. The dialog's accessible title excludes its close
control; accessibility checks settle portal animations before measuring contrast,
with no rules disabled. Coverage, the full standalone browser suite and
backend/PostgreSQL unit checks were not rerun for this change. The earlier
verification snapshots below retain their original scope.

## Programme workspace tabs — 28 October

The existing Mantis tabs now govern the entire intake workspace. Batches contains
the three summary cards, ZIP upload and batch list. Admission criteria and
Analytics show only their own content. URL selection still survives refresh,
`/criteria` still opens the criteria tab, and the selected ZIP remains in the page
draft when switching tabs.

All 32 focused tests across UploadBatchesPage, CriteriaPage and TabsCard pass,
including tab scoping, direct links and upload-draft preservation. The test-layout
check, TypeScript/production build, ESLint, Prettier and `git diff --check` pass.
Three production-browser workflows pass: redesigned navigation, criteria editing
and ZIP import with PDF validation. Browser checks verify tabs above the overview,
criteria-tab refresh persistence and absence of batch controls in the other tabs.
Desktop screenshots of all three workspace tabs and axe checks were reviewed.

This is a layout change using existing Mantis components; records, backend
contracts and dependencies are unchanged. Full unit/coverage, full browser suites
and backend/PostgreSQL checks were not rerun for this change. The results below
are the earlier full verification snapshots.

## Shared hooks follow-up

`useWorkspace` and the typed Redux bindings now live directly in `src/hooks/`,
with their matching tests. Imports and test mocks use the new paths; no duplicate
app-level implementations or re-export shims remain. `app/store.ts` retains the
store, reducers, actions and persistence; generated endpoint hooks stay in
`app/api.ts`.

Applicant and batch tables share `usePagination` for page/page-size state, bounded
row offsets and resets. Filtering, sorting, data queries, uploads, drafts and
validation stay in their Page files. Hook tests cover result shrinking, empty
tables, page-size changes and resets. Page tests also verify batch pagination and
the return to page one after changing its size. All 219 production modules remain
reachable.

Four production-browser workflows passed for redesigned review navigation, all
routes, programme/intake selection and applicant filtering/sorting/pagination.
The earlier full standalone and FastAPI suites below were not rerun for this
structural follow-up. No product behaviour, saved data or backend contract changes
are intended. See the [hooks guide](src/hooks/README.md).

All 661 tests across 108 companion files pass. Coverage was verified with
`npm run test:coverage -- --maxWorkers=1` after the concurrent run encountered two
worker-start timeouts; the serial run completed every test without errors. No
assertions or thresholds changed. TypeScript/build, lint and formatting pass.

## Final pre-PR review

The review found and fixed two individual-upload edge cases. An unreadable
replacement PDF now clears the earlier document from that slot instead of leaving
it ready to submit. Document removal respects the same disabled state as file
selection while validation/submission is busy. Focused tests reproduce both cases;
the browser upload flow also rejects an actual malformed PDF and verifies retry.

The test-layout check normalises path separators before applying its static-file
exceptions. The source audit found all 217 production modules reachable, and all
61 Mantis source/asset hashes plus five layout-reference hashes match the supplied
folder. No remaining blocking frontend findings were identified.

The complete 16-workflow browser suite and both FastAPI workflows passed. After
the final disabled-remove-button change, the individual-upload browser workflow
was rerun against a fresh production build and passed. Backend source, PostgreSQL
and the existing unrelated working-tree changes were not modified by this review.

## Test organisation

All 14 Page files and every application runtime module/component have a colocated
test with the same basename. The previous mixed page and feature suites have been
split into their owning modules; adapted Mantis controls, layout navigation and
utilities follow the same convention. Cross-module atomicity checks remain beside
the public `demo.ts` adapter. See the [test guide](src/test/README.md) for the small
set of static/type-only/bootstrap exceptions and shared test support.

`npm run test:structure` validates all 108 test/source pairs and runs before the
unit/coverage commands. Isolated temporary-directory checks confirmed that it
accepts matching companions and rejects missing sources/companions. New tests cover
controlled callbacks, keyboard behaviour, disabled/empty states and permission
guards. One small fix keeps FilePicker's hidden file input disabled with its button.
All earlier behaviour assertions are retained in their matching suites.

The initial test-layout follow-up reran individual-upload, ZIP/PDF-import and
administrator backup/restore workflows. The final pre-PR review above expands that
verification to the full frontend/FastAPI browser suites. No backend or database
code was changed.

## AI and decision fields

AI fields now contain Unconditional, Conditional or Reject; incomplete/unavailable
assessments show a neutral dash. The approved prototype display mapping is legacy
Offer → Unconditional and Further review → Conditional. The original mock result,
justification and HTTP contract remain unchanged. Tutor decision fields use the
three classified outcomes plus Pending. Old-run decisions and unclassified legacy
Offer/Further review tutor records remain stored and display/count as Pending.

Shared projections keep applicant tables, summaries, sorting, CSV, batch counts
and analytics aligned. Pending remains derived rather than a saved radio option.
Tests cover all choices, legacy preservation, unavailable assessments, sort order,
current-run decision matching and unclassified-offer counts. Browser assertions
check both table/detail values and the mapping from unchanged FastAPI responses.

## Structural review

The 1,027-line demo service is now a 79-line public entry point backed by focused
modules for contracts, runtime/recovery, permissions, queries, application changes,
settings and backups. The backup validator has named course, document, history
and integrity stages. Prepared mutations still commit records and PDFs atomically
under the same cross-tab lock. RTK Query explicitly distinguishes reads/commands;
it no longer guesses using a string list and type casts.

Layout shrank from 337 to 193 lines. It retains deep-link selection, queries and
navigation state; controlled header/sidebar components render the Mantis shell.
The permission guard now lives under `auth/`. Recommendation markup and batch-list
states/pagination are controlled components. Pages keep queries, derived values,
drafts and handlers. Matching content moves with each visual section, and the
registry is alphabetised.

The unused course-deletion command and obsolete feature tests are removed. Active
ownership, empty-backup, metadata and invalid-owner checks remain. Earlier deletion
audit entries and migration tombstones are preserved for saved-data compatibility.
The import audit found no unreachable production modules or runtime import cycles.
Guides document the new boundaries; no frontend dataset reset, HTTP contract or
PostgreSQL change is included.

## Earlier pre-commit cleanup

Removed 68 unused content entries and the orphaned intake-label content file,
unused section-panel props, standalone padding options for embedded review pages,
the old deletion-preview query/type and the unused frontend HTTP health probe.
The backend health route remains unchanged. Obsolete batch-summary counts are no
longer calculated; visible counts still use current final tutor decisions.

Queues, assessment summaries, decision forms and synthetic evidence now share
assessment-readiness logic. A rejected replacement ZIP clears the earlier file
rather than leaving it available for upload. Regression tests cover rejection,
reselection, unfinished/unavailable results and legitimate zero scores.

An import/symbol audit found no unreachable production modules after cleanup.
Dynamic import bindings, Vite title content, structurally passed control labels
and Mantis theme declarations were checked separately. Component-prop and package
checks found no further unused props or removable dependencies. All 61 source
mappings and five layout references still match the supplied Mantis hashes.
Domain-specific components remain controlled compositions of Mantis UI.

The earlier simplifications also remove course-card settings, the management
page/deletion dialog, criteria history and applicant assessment-history panels.
Old management URLs return to Programme. Historical records, criteria IDs, PDFs,
permissions and backup compatibility remain intact. Existing old-run/citation
bookmarks stay read-only; re-evaluation is available from the assessment header.

## Current checks

| Check                                   | Result                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Test naming and colocation              | 108 matched source/test pairs; no missing/orphaned runtime companions           |
| TypeScript and Vite production build    | Passed                                                                          |
| ESLint, Prettier and `git diff --check` | Passed                                                                          |
| Unit/component/service tests            | 661 passed across 108 files using one worker                                    |
| Application coverage                    | 98.21% lines, 97.01% statements, 97.45% functions, 91.70% branches              |
| Latest targeted browser regression      | Four routes/workspace/navigation/table workflows passed after hook extraction   |
| Previous full standalone browser suite  | All 16 workflows passed during the earlier pre-PR review                        |
| Previous FastAPI browser integration    | Both desktop and small-screen workflows passed during the earlier pre-PR review |

Coverage exceeds the existing 95% line, 90% statement/function and 85% branch
minimums. Imported Mantis source is excluded from application coverage totals and
has focused companion suites for components, navigation and utilities. Unit tests use Testing Library/jsdom and fake
IndexedDB. Browser checks exercise actual PDF.js, production bundles and isolated
FastAPI/Uvicorn integration servers. No assertions or coverage thresholds were
weakened to accommodate the design change.

## Design and source verification

The authoritative fallback reference is the user's full-resolution export:
`UCL Application Review Workspace — Frontend Review.png` (7844×6458). Figma MCP
identified the `final` page (`50:27395`) in `T0kdTyHiQDCy4NCIge7ssx`, then reached
the account's Starter-plan quota. Final-page component IDs, token bindings and
measurements could not be retrieved. Implementation follows the exported desktop
layout and local Mantis source; this is visual comparison, not an automated
pixel-difference assertion against a Figma frame.

The source manifest verifies original SHA-256 hashes for 61 source/asset mappings
and five adapted layout references against Mantis React Next TypeScript 4.0.1.
Imported components now include tabs, table pagination and the SingleFile dropzone
with its original SVG, plus four additional theme factories. Mantis is a source
template over MUI; product queries/rules/fixtures remain custom application code.
No Next.js or TanStack Table migration was introduced.

Desktop screenshots for login, programme/intake cards, intake workspace, criteria,
batch table and all five review tabs were visually inspected. Data-derived counts
and saved assessment values intentionally take precedence over inconsistent
numbers in the design's mock data. Existing records/PDFs were not reset to match
screenshot values.

## Browser and accessibility coverage

The 16 production workflows cover:

- Programme/intake links, refresh persistence, creation, removed management-route fallback and forbidden
  owner/admin deep links.
- ZIP validation/atomic import, persisted originals, individual applicant creation
  within a batch and confirmed owner-only applicant deletion.
- Search, status filters, score sorting, pagination bounds and whole-course CSV.
- Recommendation/source navigation, original PDF viewing, critical-evidence
  blocking, correction history and read-only historic assessments.
- Conditional, Unconditional and Reject saving directly with optional notes,
  independent AI recommendations and refresh persistence.
- Active criteria validation/saving, no visible history controls and unchanged prior runs.
- Interrupted evaluation recovery and administrator edit/delete/backup/restore/reset.
- Desktop screen/tab axe audits and a small-screen keyboard/sidebar regression.

Axe found no critical/serious issues in the audited desktop routes and review tabs.
The FastAPI suite also performs accessibility checks. Desktop is the presentation
priority; this is not a comprehensive assistive-technology or mobile audit.
The browser test for interrupted evaluation waits until its queued run is committed
before refreshing, distinguishing recovery from an uncommitted click. The deletion test waits for dialog closure and table reload. A background link is hidden
from accessibility queries while a modal is open, so its absence alone cannot prove
that deletion has committed. No product storage behaviour was weakened for the test.

Focused control tests verify keyboard tab changes, disabled actions, bounded
pagination, ZIP rejection and busy upload behaviour. They caught an input that
remained enabled during upload; the hidden file input is now explicitly disabled.
The hidden input is also outside the clickable dropzone, avoiding nested
interactive controls. Navigation labels use spans rather than extra heading levels.
Typed Ant Design ESM aliases and MUI 9-compatible override adaptations remain.

## Data and backend boundaries

New tutor decisions accept only Conditional, Unconditional and Reject. Legacy
Offer/Further review records remain valid in existing datasets/backups and are
not reclassified. The unchanged AI mock evaluator still produces Offer, Further
review or Reject. Critical evidence blocks all new final decisions. No extra
checkbox, override explanation or confirmation dialog is required to save.

Expanded evidence/identity values are presentation fixtures for known synthetic
cases only. Newly uploaded applicants never receive those facts or invented
assessments. The sign-in password is presentation-only; real authentication,
registration and reset are not implemented. Original PDFs, ownership permissions,
criteria versions, corrections and browser persistence remain intact.

FastAPI checks verify real requests, changed criteria, source-page links,
persistence and disconnection without silent local fallback. Backend source,
HTTP response contracts and the five-table PostgreSQL foundation are unchanged
by the redesign. Database tests and backend Ruff were not rerun. No claim is made
about live extraction, inference, real service monitoring or deployment.

Browser artifacts are ignored under `test-results/frontend/`, `test-results/backend/`
and `playwright-report/`. Local preview checks do not alter the user's browser data.
