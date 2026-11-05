# Admission Review System

React, TypeScript and Vite frontend using the supervisor-supplied **Mantis React
Next TypeScript 4.0.1** source, MUI, React Router, Redux Toolkit and RTK Query.
The desktop interface follows the user's revised Figma export of 23 October 2026.
Mantis components and theme factories live in `src/mantis/`; this is still a Vite
app, not a Next.js migration. See the [source map](src/mantis/README.md).

Use the supplied Mantis components and examples before adding generic interface
code. Cards, navigation, statistics, tabs, pagination and uploads share those
adaptations. The source-backed `CustomizedDialog` is shared by decision recording
and sign-in help. Mantis uses MUI controls internally; admissions-specific fields,
queries and actions remain in the feature code.

For implementation changes, start with the relevant Page file. The
[component guide](src/components/README.md), [content guide](src/content/README.md)
and [service guide](src/services/README.md) explain where screen logic, visual
sections, copy and persistence operations belong. Tests sit beside the matching
source file with the same name, such as `AssessmentPage.test.tsx`. See the
[test guide](src/test/README.md) for conventions and shared helpers.
Reusable workspace, Redux and pagination hooks live in `src/hooks/`; see the
[hooks guide](src/hooks/README.md). Pages retain feature-specific logic.

## Start

Use **Node 24 or newer**:

```sh
cd frontend
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. For a production preview:

```sh
npm run build
npm run preview
```

The local development runtime is available with:

```sh
export PATH=/Users/jack_1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
```

Use an installed Node runtime elsewhere. Dependencies are pinned with a committed
lockfile. Vite's regenerable cache lives in the system temporary directory to avoid
OneDrive cache replacement conflicts.

To enable the optional FastAPI mock evaluator, follow the
[backend guide](../backend/README.md), copy `.env.example` to `.env.local`, set
`VITE_API_BASE_URL` and restart Vite. Without that variable, the standalone browser
adapter is used. Records and PDFs stay in IndexedDB in either mode.

## Sign in

The redesigned form accepts an existing account's email and any nonempty prototype
password (for example `demo`). Passwords are **not authenticated** or saved. Do not
enter real UCL credentials. “I don't have an account” opens the existing-account
chooser; it does not register an account. Forgot password explains the current
boundary rather than sending a reset email. The footer links describe the prototype.

| Account       | Email                  | Permissions                                                                    |
| ------------- | ---------------------- | ------------------------------------------------------------------------------ |
| Jack          | tutor@demo.ucl.local   | Owns the three example programmes; reviews applicants and edits their criteria |
| Tutor B       | tutor.b@demo.ucl.local | Starts without programmes; can create private programmes                       |
| Administrator | admin@demo.ucl.local   | User accounts and service health                                               |

Administrators cannot open applicant review, view individual PDFs or record
decisions. Those routes and commands require active tutor ownership.
These browser controls are not real server authentication.

## Programme and intake workflow

The main flow is **Programme → intake workspace → batch → applicant review**.
The Programme page has direct intake cards. The sidebar lists programme/intake
links, and the header avatar opens account details, Change password and Logout.
Change password opens a Mantis form with current/new password and confirmation.
The form validates its fields but cannot save until account authentication is
connected; entered passwords are never persisted or sent to the mock backend.
The three examples display as **CSML**, **ML** and **CS** with years such as 26/27.
Their full stored names remain Computational Statistics and Machine Learning MSc,
Machine Learning MSc and Computer Science MSc. Other programme names display as
entered. The Programme list now lives at `/programmes`; old `/modules` links
remain compatible.

Page headings use the supplied Mantis breadcrumbs instead of Back buttons. Every
segment is linked, including the current page: **Programme / CSML 26/27 / Batch 1 /
1 - Carson Darrin - 24738849**. Programme, intake and batch links open their own
pages directly. Applicant names and batch numbers are display labels; stable IDs
identify records in the URL so renaming/reordering does not break bookmarks.

```text
/programmes
/programmes/:programmeId/intakes/2026-27
/programmes/:programmeId/intakes/2026-27/batches/:batchId
/programmes/:programmeId/intakes/2026-27/batches/:batchId/applications/:id
```

Add applicant uses the same parent path with `applications/new`. Original-document
links append `/evidence`; correction/decision dialogs also retain their legacy
action suffixes. Intake queues and unbatched applicants have the equivalent
`.../intakes/:intake/applications` paths. `src/app/paths.ts` owns path construction
and intake-segment encoding. Pages verify actual programme/intake/batch ancestry
before showing data or mutation controls.
Numeric intakes use `2026-27`; descriptive legacy labels use a reserved, reversible
URL-safe segment so literal slashes, percent sequences and Unicode round-trip
through React Router without changing the stored label.

Old `/batches`, `/batches/:batchId`, `/applications` and applicant/action URLs
resolve through authorised reads and redirect to their canonical nested URL.
Run/document/page/tab bookmarks and hashes are retained; conflicting explicit
ancestors show an error. The old `/criteria` URL selects the criteria tab in the
nested intake workspace. No saved records or PDF bytes are migrated or reset.

Select **Add Programme**, enter a name (1–100 trimmed characters) and save. Names
accept punctuation and Unicode and cannot duplicate another name owned by the
same tutor, ignoring case. A unique internal code is generated. Different tutors
can use the same name. Creation opens the new intake workspace with no applicants
and independent example criteria.

Programme cards open intake workspaces directly, without settings buttons or a
separate course management/deletion page. Existing programmes and their records
remain saved. Tutors manage their courses; the admin interface has no course
settings, ownership transfer, access assignment or course creation controls.

Available intakes include the configured year, previous two years and populated
legacy years. Selection is remembered per account/programme across refreshes.
Authorised applicant and batch deep links select their programme and intake;
forbidden links do not fall back to another queue. Criteria versions apply to the
whole programme across intakes.

## Intake workspace and uploads

The intake workspace has page-level **Batches**, **Admission criteria** and
**Analytics** tabs. Batches contains **Applications**, **Offers** and
**Pending reviews**, followed by the ZIP upload area and batch table.
Counts use the latest tutor decision matching the latest run.
Conditional and Unconditional are offers; Reject is a completed decision. Older
run decisions and legacy Further review/generic Offer records remain pending. A
generic old offer must receive an explicit Conditional/Unconditional decision
before it counts as a current classified offer. Original records remain stored. AI recommendations
do not count as tutor decisions.

Use the Mantis ZIP drop area to drop or browse for a ZIP, then **Upload batch**.
The overview and upload area appear only in Batches; the other tabs show their
own content. Switching tabs preserves the selected ZIP until leaving the intake.
The selected tab survives refresh in the URL; `/criteria` opens the same workspace
with the criteria tab selected.

Batch rows show Batch 1, Batch 2, etc., local upload date/time, applicants,
Unconditional, Conditional, Reject and Pending. Numbers are chronological within
the intake; newest batches appear first. Earlier generic Offer decisions remain
saved without being reclassified. The table shows only its designed columns and counts.
Pagination, page size and bounded Go to controls operate on real rows.

**Export results as CSV** exports the entire course across intakes and batches,
including intake, score, AI recommendation, tutor decision and criteria version.
It is unavailable on the individual batch page. Formula escaping is retained.
Analytics summarises final tutor outcomes for the selected intake.

The default CSML 26/27 dataset contains eight applicants across three batches.
Fresh profiles and older unchanged browser profiles receive the code-defined
samples without a reset. Upgrade markers and deletion events prevent deliberately
deleted samples from returning. Existing IDs, PDFs and histories are preserved.

A ZIP should contain one folder per applicant with PDFs directly inside; one
common outer folder is accepted:

```text
November.zip
  APPLICANT-001/
    cv.pdf
    transcript.pdf
    statement.pdf
    application_form.pdf
    english_test.pdf
    reference-1.pdf
    reference-2.pdf
  APPLICANT-002/
    cv.pdf
```

Folder names become candidate references. Common CV/resume, transcript,
personal-statement, application-form, English/IELTS/TOEFL/PTE and reference names
are recognised. References may have multiple PDFs; other categories accept one.
Give references a recognisable prefix (for example `reference-1.pdf`); a name-only
letter cannot be classified from its filename. Missing types remain missing.
Ambiguous names, duplicate singleton types, unsafe/duplicate paths, non-PDF files
and unreadable PDFs reject the entire import. macOS archive metadata is ignored.

Service-layer limits remain 100 MB compressed, 200 MB extracted, 100 applicants,
20 MB per PDF and 100 combined pages per applicant. Bounded extraction uses
`fflate`; PDF readability uses locally bundled PDF.js. Validation finishes before
one atomic IndexedDB write. Failure leaves no partial applications or PDFs. A
refresh before commit requires selecting the ZIP again.

The original extracted PDFs are retained, not the ZIP container. **Add applicant**
on a batch opens the individual PDF form and preserves that batch association.
The form uses the existing Mantis upload cards for transcript, CV, personal
statement, application form, English test report and references. Add references
in one selection or incrementally and remove each independently. A failed
multi-reference selection adds none of that selection and preserves earlier
valid references. All originals are available through View documents.
New uploads receive no invented facts, scores or recommendations. Uploads are
not yet sent to FastAPI or PostgreSQL.

## Applicant review

A batch has searchable, filterable and sortable applicant rows: Id, Name, Student
ID, State, University, Score, AI, Decision and Actions. The eye/name opens review;
the delete action requires confirmation and removes only that applicant and PDFs.
Every data-column heading toggles ascending/descending sorting; Actions remains
reserved for buttons. Numeric IDs/scores sort numerically, equal values keep their
original order, and missing scores/universities stay last in both directions.
Sorting covers all filtered rows before pagination and returns to page one; the
quick-sort selector reflects the selected column/direction.
State describes document completeness: **Ready** requires all six categories,
including at least one reference; **Missing** means a category is absent. The table,
two-option filter, sorting and CSV use the same projection from linked document
records. A tutor decision or completed AI run does not make missing documents ready.
Older three-document examples therefore remain Missing. Uploading all six categories
can produce Ready while AI remains unavailable and the tutor decision is Pending.
Queued, failed and unassessed cases never expose precomputed scores as completed
results. Decisions from older assessments remain saved; the current result stays pending.

The AI field contains **Unconditional**, **Conditional** or **Reject**. The tutor
Decision field contains those values or **Pending**. Missing/unfinished AI results
show `—`; processing status remains available in the assessment. The same projection is used in the applicant
summary, sorting and CSV export. Pending is derived when no current classified
decision exists, rather than saved as a fourth tutor outcome.

The approved prototype AI mapping is legacy `Offer` → `Unconditional` and
`Further review` → `Conditional`. Raw runs, explanations and mock HTTP responses
are preserved; this display mapping does not implement a new admissions policy.

The review has a compact score/AI/decision summary and four Mantis tabs:

- **AI recommendation:** justification and a two-column evidence
  summary for English, education, references, transcript, publications, projects
  and work experience.
- **Review flag:** actionable evidence alerts; Update detail opens a correction
  popup with a source page and reason, keeping the review tab in place.
- **Score breakdown:** four Mantis accordions for academic performance, CV and
  experience, personal statement and references, with explanations and uncertainty.
  A section absent from an older assessment displays Score unavailable; stored
  totals, criteria versions and runs are not rewritten.
- **View documents:** original PDF selection, page navigation and download.

Recommendation and section-score summaries have no PDF shortcuts. Use View
documents to inspect originals; stored citations and existing document bookmarks
remain supported.
The recommendation tab separates Why this recommendation and Evidence summary
with larger Mantis section headers. Evidence categories use individual cards in
a two-column desktop layout, with smaller subheadings and consistent spacing.

The five core synthetic examples include longer recommendation and section-score
explanations covering supporting evidence, limitations, weighting and why the
outcome follows. Existing short mock text is expanded for display using its
original criteria version; saved assessments and scores are preserved. These are
predefined examples, not output from live AI. Uploaded records and historical
bookmarks do not receive invented explanations.

The green **Decision** button in the summary opens a **Record decision** popup
with Conditional, Unconditional or Reject and an optional note. Cancel, the close
button or Escape returns to the selected review tab without saving. The popup
keeps the draft on save failure and prevents dismissal/duplicate submits while
saving. Existing `/decision` and `?tab=decision` links open the popup too.

Fact correction uses the same supplied Mantis dialog. Cancel/close/Escape discard
the draft and return to the current tab; saving preserves the original fact and
creates a new assessment. Failed saves keep the draft, and in-flight saves block
edits and dismissal. Old `/correct` links open the popup within the review shell;
historic-run links remain read-only.

These are the only choices accepted by new decision commands. Saving is direct,
without a review checkbox, override reason or extra confirmation dialog. Review
flags remain visible as guidance and do not block any tutor outcome. The AI recommendation is stored
separately and can still be Offer, Further review or Reject under the unchanged
mock evaluator contract. Historical generic Offer/Further review decisions remain
readable and are never silently converted to a different outcome.

The page shows the latest assessment without a history panel or run picker.
**Re-run AI evaluation** sits beside Decision in the summary. Corrections retain the
original fact and create a new assessment internally; they do not rewrite older
results. APP-2026-0142 starts with extracted grade 71%; its original synthetic
transcript confirms 74% on page 2. Existing bookmarked source/run links remain
valid and older results are read-only, with a return to the latest result.

Names/student IDs and the expanded evidence summary for known synthetic cases
are **presentation fixtures**, not PDF extraction or new HTTP fields. Transcript
module values use the existing sample PDF, and the overall extracted grade follows
the selected run, including a corrected or historical mark. Unsupported fixed degree
classifications and per-referee scores are not substituted for assessment data.
The evidence summary shows an overall reference score only if the run contains one.
The English bands and ranking are coherent illustrative fixture metadata. Real
uploads get no fixture identity/evidence. These additions
do not establish evidence provenance for a deployed admissions system.

The sample weights, thresholds, rankings and recommendations are illustrative,
not official UCL admissions policy. Persistent demo/environment banners are omitted
at the user's request; functional errors and destructive confirmations remain.

## Criteria

Active owners can edit four section weights, offer/reject thresholds and review
margin from the intake's criteria tab. Weights total 100%; finite values and
threshold ordering are validated. Additional thresholds expand on demand. The
unimplemented mandatory academic rule remains internal for compatibility.
New private programmes start with illustrative weights of 40/25/25/10 for
academic/CV/statement/references. Existing courses retain their saved weights;
a legacy rubric displays References at 0% until the owner allocates a weight.
Positive reference weight requires an actual reference assessment for a complete
total. Missing reference scores stay unavailable; totals are not renormalised.
English-language eligibility and cross-document concerns are separate from the
four weighted sections and require the future evaluator, not fabricated upload data.

**Save criteria** creates and activates a new version. Existing runs and decisions
retain their original criteria; only explicit re-evaluation uses the new version.
The editor shows only active criteria. There is no version-history list, version
picker or restore-old-settings action. Saving still keeps previous criteria
internally so assessments retain the settings they used; no stored versions,
results or decisions are deleted by the UI simplification.

## Persistence and boundaries

Versioned IndexedDB stores records and original PDF blobs outside Redux. Session
identity and programme/intake choices use sessionStorage. Refresh preserves work
and recovers interrupted simulated evaluations. Existing version-1/version-2
browser records and ownership/intake/batch upgrades remain supported without a data reset.

## Administration

Admin login opens **Users**. The sidebar has **Users** and **Service health**.
The account table shows name/email, readable role labels and active status. New
account and Edit open a Mantis dialog with name, email, role and active status;
cancel discards the draft and save errors keep it for retry. The last active
administrator cannot be deactivated or lose the admin role. Deactivation preserves
course ownership and attribution; account deletion is not exposed.

**Service health** (`/admin/health`) performs a read-only `GET /health` against
`VITE_API_BASE_URL`, with a ten-second timeout and a manual Refresh status action.
It shows Available only after validating the response. Missing configuration,
connection failures and invalid responses remain explicit; no simulated status is
substituted. The current API reports mock assessment mode and unconfigured database/
inference integrations. This check does not probe PostgreSQL or the model itself.

Browser backup/restore, simulated service controls, programme settings, applicant
deletion, maintenance logs and reset controls are removed from the admin interface.
Old `/admin/programme`, `/admin/data` and `/admin/backup` URLs redirect to Users.
Removing these screens does not change existing records or PDFs. Their obsolete
service commands and archive helpers are also removed. Fixture reset lives only
in test utilities; server database backups will be an operational concern when
persistence is integrated.

`src/app/` owns Redux and RTK Query; `src/domain/` owns models and deterministic
rules; `src/services/` owns storage, fixtures, permissions, imports and evaluation.
Pages own screen logic and compose controlled components. Copy lives in matching
`src/content/` files through the shared `useContent()` hook. See the
[component guide](src/components/README.md) and [content guide](src/content/README.md).

`services/admissions.ts` is the shared query/command/original-PDF boundary used by
RTK Query and document consumers. `services/contracts.ts` holds typed requests and
read models; `fileStaging.ts` keeps temporary files outside Redux. A future HTTP
adapter can implement that interface without changing screen-level handlers.
See the [service guide](src/services/README.md#future-fastapi-integration) for the
integration boundary and remaining work.

The separate `services/evaluation.ts` selects the current evaluator. With the
optional mock API, synthetic reassessments send fixture IDs,
document metadata and criteria, not original PDFs or tutor notes. HTTP errors do
not silently fall back or save partial corrections. The HTTP response contract
and independent five-table PostgreSQL foundation are unchanged by this redesign.
The existing FastAPI mock accepts only three scored sections. Zero-weight
references preserve that request shape and extra document metadata stays local.
A positive reference weight is rejected before a mock request rather than
silently dropping its contribution or modifying existing runs. Real four-section
inference and the server's expanded document constraints remain backend work.

Real authentication, upload APIs, extraction, inference, PostgreSQL-backed HTTP
routes, database/model health checks and deployment remain future work.

Current-decision summaries and PDF limits are shared domain helpers; pages retain
their own filtering, drafts and mutation logic. Upload drafts reset when account,
programme, intake or batch changes. Async completion guards prevent old validation
or create requests from updating a later screen, while temporary files are still
released after each operation.

## Checks

```sh
npm run lint
npm run format:check
npm run test:structure
npm test
npm run test:coverage
npm run build
npx playwright install chromium
npm run test:e2e
```

For the local cached Chromium runtime:

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/ucl-admissions-browsers npm run test:e2e
```

The browser script builds in standalone `e2e` mode without inheriting a local API
URL. Playwright serves production output on port 4173; do not rebuild `dist` during
a browser run. Desktop is the design priority; a basic small-screen keyboard and
navigation regression remains. Axe checks complement, rather than replace, manual
accessibility testing. Reports/screenshots are ignored under `test-results/frontend/`
and `playwright-report/`.

`npm run test:e2e:backend` separately starts FastAPI/Vite on 8001/5174. Set
`UCL_BACKEND_PYTHON` if needed to select a virtual environment with backend
dependencies. Its artifacts use `test-results/backend/`.

Tests live beside source with shared helpers under `src/test/`. Unit tests use
Testing Library/jsdom and fake IndexedDB; Chromium checks actual PDF.js and complete
workflows. Application coverage excludes imported template code, bootstrap and
declarative theme. Minimums: 95% lines, 90% statements/functions, 85% branches.
See [VERIFICATION.md](VERIFICATION.md) for the latest completed results and limits.
