# UCL Application Review Workspace

React, TypeScript and Vite frontend using the supervisor-supplied **Mantis React
Next TypeScript 4.0.1** source, MUI, React Router, Redux Toolkit and RTK Query.
The desktop interface follows the user's revised Figma export of 23 October 2026.
Mantis components and theme factories live in `src/mantis/`; this is still a Vite
app, not a Next.js migration. See the [source map](src/mantis/README.md).

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
| Administrator | admin@demo.ucl.local   | Accounts, existing programme metadata, simulated health and data maintenance   |

Administrator permission alone grants no applicant, PDF, decision or criteria
access. Both UI and demo-service commands enforce active tutor ownership. These
browser controls are not real server authentication.

## Programme and intake workflow

The main flow is **Programme → intake workspace → batch → applicant review**.
The Programme page has direct intake cards. The sidebar lists programme/intake
links, and the header avatar opens account details, All programmes and Sign out.
The three examples display as **CSML**, **ML** and **CS** with years such as 26/27.
Their full stored names remain Computational Statistics and Machine Learning MSc,
Machine Learning MSc and Computer Science MSc. Other programme names display as
entered. Technical `Programme` models and `/modules` routes remain compatible.

Select **Add Programme**, enter a name (1–100 trimmed characters) and save. Names
accept punctuation and Unicode and cannot duplicate another name owned by the
same tutor, ignoring case. A unique internal code is generated. Different tutors
can use the same name. Creation opens the new intake workspace with no applicants
and independent example criteria.

Programme cards open intake workspaces directly, without settings buttons or a
separate course management/deletion page. Existing programmes and their records
remain saved. Administrators can still edit existing metadata but cannot transfer
ownership, assign access or create courses.

Available intakes include the configured year, previous two years and populated
legacy years. Selection is remembered per account/programme across refreshes.
Authorised applicant and batch deep links select their programme and intake;
forbidden links do not fall back to another queue. Criteria versions apply to the
whole programme across intakes.

## Intake workspace and uploads

The intake workspace shows **Total applications**, **Offers given** and **Total
pending review**. Counts use the latest tutor decision matching the latest run.
Conditional and Unconditional are offers; Reject is a completed decision. Older
run decisions and legacy Further review/generic Offer records remain pending. A
generic old offer must receive an explicit Conditional/Unconditional decision
before it counts as a current classified offer. Original records remain stored. AI recommendations
do not count as tutor decisions.

Use the Mantis ZIP drop area to drop or browse for a ZIP, then **Upload batch**.
The panel below has **Batches**, **Admission criteria** and **Analytics** tabs.
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
  APPLICANT-002/
    cv.pdf
```

Folder names become candidate references. Common CV/resume, transcript and
personal-statement names are recognised. Missing types remain missing. Ambiguous
names, duplicate types, unsafe/duplicate paths, non-PDF files and unreadable PDFs
reject the entire import. macOS archive metadata is ignored.

Service-layer limits remain 100 MB compressed, 200 MB extracted, 100 applicants,
20 MB per PDF and 100 combined pages per applicant. Bounded extraction uses
`fflate`; PDF readability uses locally bundled PDF.js. Validation finishes before
one atomic IndexedDB write. Failure leaves no partial applications or PDFs. A
refresh before commit requires selecting the ZIP again.

The original extracted PDFs are retained, not the ZIP container. **Add applicant**
on a batch opens the individual PDF form and preserves that batch association.
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
Queued, failed and unassessed cases never expose precomputed scores as completed
results. Decisions from older assessments remain saved; the current result stays pending.

The AI field contains **Unconditional**, **Conditional** or **Reject**. The tutor
Decision field contains those values or **Pending**. Missing/unfinished AI results
show `—`; processing remains in State. The same projection is used in the applicant
summary, sorting and CSV export. Pending is derived when no current classified
decision exists, rather than saved as a fourth tutor outcome.

The approved prototype AI mapping is legacy `Offer` → `Unconditional` and
`Further review` → `Conditional`. Raw runs, explanations and mock HTTP responses
are preserved; this display mapping does not implement a new admissions policy.

The review has a compact score/AI/decision summary and five Mantis tabs:

- **AI recommendation:** justification, source-page links and a two-column evidence
  summary for English, education, references, transcript, publications, projects
  and work experience.
- **Review flag:** actionable evidence alerts; supported grade discrepancies link
  to correction with a source page and reason.
- **Score breakdown:** expandable section scores, explanations and citations.
- **View documents:** original PDF selection, page navigation and download.
- **Record decision:** Conditional, Unconditional or Reject, with an optional note.

These are the only choices accepted by new decision commands. Saving is direct,
without a review checkbox, override reason or extra confirmation dialog. Critical
unresolved evidence blocks every final decision. The AI recommendation is stored
separately and can still be Offer, Further review or Reject under the unchanged
mock evaluator contract. Historical generic Offer/Further review decisions remain
readable and are never silently converted to a different outcome.

The page shows the latest assessment without a history panel or run picker.
**Re-evaluate application** is available in the header. Corrections retain the
original fact and create a new assessment internally; they do not rewrite older
results. APP-2026-0142 starts with extracted grade 71%; its original synthetic
transcript confirms 74% on page 2. Existing bookmarked source/run links remain
valid and older results are read-only, with a return to the latest result.

Names/student IDs and the expanded evidence summary for known synthetic cases
are **presentation fixtures**, not PDF extraction or new HTTP fields. Transcript
module values use the existing sample PDF, and the overall extracted grade follows
the selected run. Real uploads get no fixture identity/evidence. These additions
do not establish evidence provenance for a deployed admissions system.

The sample weights, thresholds, rankings and recommendations are illustrative,
not official UCL admissions policy. Persistent demo/environment banners are omitted
at the user's request; functional errors and destructive confirmations remain.

## Criteria

Active owners can edit three section weights, offer/reject thresholds and review
margin from the intake's criteria tab. Weights total 100%; finite values and
threshold ordering are validated. Additional thresholds expand on demand. The
unimplemented mandatory academic rule remains internal for compatibility.

**Save criteria** creates and activates a new version. Existing runs and decisions
retain their original criteria; only explicit re-evaluation uses the new version.
The editor shows only active criteria. There is no version-history list, version
picker or restore-old-settings action. Saving still keeps previous criteria
internally so assessments retain the settings they used; no stored versions,
results or decisions are deleted by the UI simplification.

## Persistence, backup and boundaries

Versioned IndexedDB stores records and original PDF blobs outside Redux. Session
identity and programme/intake choices use sessionStorage. Refresh preserves work
and recovers interrupted simulated evaluations. Existing version-1/version-2
backups and ownership/intake/batch upgrades remain supported without a data reset.

The administrator's Data operations exports/restores the browser dataset, including
PDFs and all review history. Backup restore validates structure, hashes and
references before a confirmation to replace data; the backup cap is 100 MB.
Confirmed reset restores the original nine applications and three courses.
Storage errors are visible, and failed writes abort atomically. Downloaded backups
are separate from deleted browser records.

`src/app/` owns Redux and RTK Query; `src/domain/` owns models and deterministic
rules; `src/services/` owns storage, fixtures, permissions, imports and evaluation.
Pages own screen logic and compose controlled components. Copy lives in matching
`src/content/` files through the shared `useContent()` hook. See the
[component guide](src/components/README.md) and [content guide](src/content/README.md).

The RTK Query adapter and `services/evaluation.ts` are future backend replacement
boundaries. With the optional mock API, synthetic reassessments send fixture IDs,
document metadata and criteria, not original PDFs or tutor notes. HTTP errors do
not silently fall back or save partial corrections. The HTTP response contract
and independent five-table PostgreSQL foundation are unchanged by this redesign.

Real authentication, upload APIs, extraction, inference, PostgreSQL-backed HTTP
routes, live health monitoring and deployment remain future work.

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
