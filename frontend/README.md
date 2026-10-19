# UCL Application Review Workspace

React + TypeScript frontend for the final-year admissions project. The original
12 screens plus module, intake and upload-batch selection use a neutral Mantis-style interface with Redux Toolkit, RTK Query,
MUI and React Router. The supplied Mantis React Next TypeScript 4.0.1 package
informs the presentation; this remains a Vite app. The original Figma workflows
and content hierarchy are preserved. Saved references remain in `../design/figma/`.

## Start the app

Use **Node 24 or newer**. The machine's original Node 22.11 is too old for this toolchain.

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

For the optional FastAPI mock integration, start the scaffold using the
[backend guide](../backend/README.md), copy `.env.example` to `.env.local`, and
restart Vite. Seeded-case reassessments and corrections then use HTTP; records
and PDFs still persist in this browser. Runs retain their FastAPI provenance
in the saved data; the interface does not display connection banners. Without `VITE_API_BASE_URL`,
the original standalone browser demo works as before.

The Codex-bundled Node runtime used during development is:

```sh
export PATH=/Users/jack_1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
```

Use your own Node installation elsewhere. Vite's regenerable cache lives in the
system temporary directory, outside the OneDrive-synced project, to avoid cache
replacement interfering with development startup. Dependencies are pinned and
`package-lock.json` is included.

## Interface notices

Recurring demo/environment badges, backend-connection banners, upload integration
notices and simulated-data disclaimers are intentionally removed at the user's
request. Functional upload errors, unavailable-assessment states, evidence flags
and destructive-action confirmations remain. Unavailable assessments show neutral
status text without fabricated scores, recommendations or justification rules.
Original stored runs and response metadata are preserved. The removed connection
panel no longer polls health from the assessment page; the optional HTTP evaluator
and health API contract remain available.

This presentation change does not implement authentication, document assessment,
a live service monitor or server persistence. The integration boundaries below
remain accurate even though the UI no longer repeats them.

## Demo accounts

Select an account on the sign-in page; no password or real UCL credentials are used.

| Account            | Demo email             | Permissions                                                               |
| ------------------ | ---------------------- | ------------------------------------------------------------------------- |
| Jack · Demo tutor  | tutor@demo.ucl.local   | All three example courses, admissions review, own-course criteria editing |
| Demo tutor B       | tutor.b@demo.ucl.local | Starts without courses; can add and manage their own courses              |
| Demo administrator | admin@demo.ucl.local   | Accounts, programme metadata, simulated service health, local maintenance |

The administrator alone cannot read applicant documents or record admissions
decisions. Account deactivation and programme scope are checked by the demo
service as well as the UI. These are browser demonstration controls, not server
authentication or a security boundary against someone controlling this browser.

## Choose a course and intake

Tutors land on **Courses** after every sign-in. Each card shows an accessible
course's name. Open a card to choose an intake year (for example 24/25,
25/26 or 26/27), then upload a ZIP or open a previous batch. The tutor sidebar lists
only owned courses, with the role/account and sign-out action at the bottom.
Selecting a sidebar course opens its intake picker; **All courses** returns to
the cards. Administrator navigation is unchanged.

The picker offers the module's configured year and the previous two, plus any
additional years already containing applications. Counts and new uploads use the selected intake. Applicant rows and filters
are also scoped to the opened batch. **Export course results** on Upload batches
includes every application in the selected course, across all intakes and batches.
New applications store an
`intakeYear`; legacy records inherit their existing workspace year once, keeping
original PDFs and review history intact. Selections are remembered per account
and module across refreshes. Authorised application links select their module
and intake automatically. Authorised batch links do the same. Criteria versions apply
to the whole course, across all intakes.
Technical models/services retain the existing `Programme` naming; no backend
schema or frontend-to-PostgreSQL connection changes are part of this UI milestone.

On **Courses**, tutors can select **Add course**, enter a **Course name**
(for example `Data Science & AI MSc`), then choose **Add course**. Names accept
spaces, punctuation and Unicode, retain their case and are trimmed before saving.
They must contain 1–100 characters. A tutor cannot add a name already in their
accessible courses, ignoring case; separate tutors can create independent courses
with the same name. An internal unique code is generated automatically. Cards,
navigation, intake headings and upload context show the entered name; CSVs retain
the internal code.

The new course opens its intake picker with empty queues and its own example
rubric. Each course belongs to one tutor, who alone can review its applicants and
delete it. Course sharing and administrator assignment controls are removed.
Creation also works without existing courses. The owner can tune the course's
numeric criteria. Workspaces persist in browser demo data and
backup/restore; reset removes user-created workspaces. The initial academic year
is generated and can be edited in administrator settings. The technical
`Programme.name` field supplies display names. Metadata edits preserve existing
course names. Administrators can edit metadata for existing courses, but cannot
create courses, transfer ownership or grant another tutor access.

On any owned course's intake page, its owner can select **Delete course**. A
confirmation shows application, PDF and criteria-version counts.
Confirming deletes the entire course, all its
applications/review history across all intakes, original PDFs, criteria versions and assignments.
Other modules remain unchanged. The app returns to the module cards;
if none remain, create a new one using **Add course**. Cancellation and failed
writes preserve the workspace. Restore a previous demo backup to recover deleted
content. Other tutors and administrators cannot claim ownership or delete a
course they do not own. All three example courses belong to Jack and can be
deleted. Demo tutor B starts without courses and can add private courses.

Older shared records upgrade in place: explicit ownership wins, then a saved
creation audit, then the first active assigned tutor (or an inactive assigned
tutor when none are active). Unassigned legacy records remain available only as
administrator metadata; no new applicant access is granted. Existing IDs, PDFs,
applications, decisions and corrections remain intact. `User.programmeIds` is
retained as a compatibility projection of ownership, not an access-grant control.
Backup restore applies the same upgrade without changing the imported backup.

Jack's demo account has **Computational Statistics and Machine Learning MSc**,
**Machine Learning MSc** and **Computer Science MSc** as example workspaces.
The first contains eight cases across three batches, the second contains one
synthetic case and a separate example rubric, and the third starts empty. Applicant data and criteria
are illustrative, not UCL admissions policy. Saved default example labels upgrade
in place on load, adding the third empty example for Jack if he still has both
earlier courses. Customised workspaces and linked applications, PDFs and review
history are preserved. Later loads do not recreate
the third course. No demo reset is needed. The independent PostgreSQL seed still
contains its original two courses; this change affects browser demo data.

**Programme settings** edits existing course metadata. **Users & access** edits
account roles/status and shows owned courses as read-only information.
Administrator permission alone does not grant admissions access.
Each course's active criteria and version history remain independent.

Existing single-course browser data upgrades in place without resetting saved
reviews or PDFs. The upgrade adds a second example course for Jack's demo account;
if its sample application identifier is already in use, that queue starts empty.
Version 1 backups are still accepted and restored as their original single course.
New backups use dataset version 2 and include all configured courses.

## Upload a ZIP batch

The main tutor flow is **Courses → intake → Upload batches → batch applicants**.
Above **Upload applications**, the intake overview shows **Total applicants**, **Offers given** and
**Reviewed by tutor** as a reviewed/total count across all batches in that course
and intake. The offer and review counts use each application's latest tutor decision for its current
assessment; AI recommendations and decisions for older assessments do not count.
Further review counts as a human review while remaining unresolved. Select a ZIP,
then choose **Upload batch**; the action reads **Uploading…** while processing.
The intake opens `/batches`, with a ZIP picker and previous batch rows showing
a numbered name (Batch 1, Batch 2, …), date, applicant count and **Pending human review** count. Pending means no tutor decision for the current assessment; Further review has already been reviewed but remains unresolved. New uploads, failed assessments and decisions for older runs remain pending. Each import creates a separate
batch, even when the same filename or applicant references were used before.
Numbers start at 1 within each module/intake in chronological upload order, with
newest rows displayed first. The date column includes the local upload time in
24-hour format (for example, 15 Oct 2026, 14:30); original ZIP filenames and full
timestamps remain saved as metadata. Click a batch to open
`/batches/:batchId`; each applicant is a row in the existing
four-column review table. **← Back** on assessment returns to these rows.
Page return actions use **← Back** at the far right, with links to the parent course, intake,
batch or assessment. **Admission criteria** is available from Upload batches;
the application queue has no criteria shortcut.
**Export course results** downloads the full course as CSV, including intake year,
scores, AI recommendations, tutor decisions and criteria versions. Queues have no
per-batch export. Existing CSV escaping and spreadsheet-formula protection apply.

The CSML example course has three batches in the 26/27 intake: five unreviewed
applicants, a two-applicant batch with one pending review, and a fully reviewed
one-applicant batch. Sample decisions include one Offer and one Reject. The two
additional batches are added once to unchanged existing example courses, keeping
original records and PDFs; refresh never recreates deleted examples.
These are code-defined defaults for every browser. Refreshing an older saved
dataset upgrades its batch metadata too, including earlier incomplete upgrades;
there is no need to reset existing uploads or tutor decisions.
The legacy `/applications` route still supports the full intake queue and
individual upload workflow; it is not the intake landing page.

Use one applicant folder per ZIP, containing PDFs directly inside it. An outer
folder around all applicants is supported too:

```text
November applications.zip
  APPLICANT-001/
    cv.pdf
    transcript.pdf
    statement.pdf
  APPLICANT-002/
    cv.pdf
    transcript.pdf
```

Folder names become candidate references. Common names such as `resume.pdf`,
`academic-transcript.pdf` and `personal_statement.pdf` are recognised. Missing
CV/transcript/statement files are allowed and remain missing. Unknown/ambiguous
PDF names, non-PDF documents and duplicate document types are rejected with a
message; use one file per type. Standard macOS ZIP metadata is ignored.

Limits: **100 MB per ZIP**, **200 MB extracted**, **100 applicant folders**,
**20 MB per PDF** and **100 combined pages per applicant**. The importer checks
folder structure, bounded extraction, unsafe/duplicate paths and PDF readability.
It validates the complete batch before atomically saving batch metadata,
applications and original PDF blobs. If validation or storage fails, the whole
import fails without saving partial applicants. Keep the page open until import
finishes; a refresh before saving requires selecting the ZIP again.

This remains browser demo storage. No ZIP/PDF is sent to FastAPI; imported
applicants receive no invented scores, facts or AI recommendations. Batch metadata
retains the ZIP filename and timestamp, while the original ZIP container is not
retained; the original extracted PDFs are saved and viewable/downloadable.
Browser backup/restore includes batches and PDFs, subject to the existing 100 MB
backup limit. Workspace deletion removes its batches; reset removes imported
batches. Earlier records are grouped into a numbered batch per module and intake,
without claiming they came from a ZIP or changing their review history. Batch
rows show the batch number, date/time, applicant count and pending human reviews.

Batch fields are optional additions to version-2 datasets/backups; version-1 and
earlier version-2 backups remain supported. Files stay outside Redux; commands
use temporary archive references and RTK Query. `services/zip.ts` handles bounded
ZIP reading with [fflate](https://github.com/101arrowz/fflate), and
`services/batchImport.ts` prepares records/PDFs for the demo service's single
IndexedDB transaction. Future HTTP batch uploads and PostgreSQL batch storage
have not been implemented in this UI milestone.

## Review a sample application

The application queue has four columns: **Application** (click the reference to
open the assessment), **Score** (overall assessment score out of 100), **AI
recommendation** and **Decision** (the tutor's recorded choice). Processing
and failure statuses appear in AI recommendation until an assessment is available; no
unfinished score is displayed. Decisions from older runs are marked **Previous
assessment**. Evidence flags and full workflow details remain on the assessment
page, and CSV exports retain the fuller operational fields.

The assessment starts with a compact summary: overall score, AI recommendation,
tutor decision and **Record decision**. Any **Needs attention** concerns appear
immediately below it with a correction link when applicable. The explanation and
source-page links stay visible; **Scoring rules**, individual **Score breakdown**
sections and **Assessment history** expand when needed. History contains previous
assessments, corrections, decisions and **Re-evaluate application**. When viewing
an older result, return to the latest assessment before recording a decision or
correcting a fact. The page header keeps **View documents** and **Back**.

1. Sign in as the first tutor, choose Computational Statistics and Machine Learning MSc → 26/27 → **Batch 1**,
   then open **APP-2026-0142**.
2. Read **Why this recommendation**, then open the transcript citation on page 2.
3. Inspect the original synthetic PDF: the grade is 74%, while the initial
   extraction is 71%. Accessible embedded page text is available below the viewer.
4. Correct the fact to 74% with a source page and reason. A new simulated run
   preserves the previous extraction, assessment and any recorded decision.
5. Review the new result. The illustrative score remains 78.4, within the review
   margin of the offer threshold. Further Review keeps the case open; an Offer or
   Reject decision saves directly with **Record offer** or **Record reject**,
   without an acknowledgement checkbox or an additional confirmation dialog.
   Tutors can choose any permitted outcome independently of
   the AI recommendation; review notes are optional. Critical flags block final decisions.
6. On Upload batches, choose **Export course results** to download the complete course CSV.

Other seeds cover Offer, Reject, missing mandatory evidence and model failure.
An administrator can simulate model recovery; a tutor can then re-evaluate the
failed seeded case. Inference and health still use simulated data internally;
repeated demo/environment notices are intentionally omitted from the interface.

The three-section weights (50/25/25), thresholds (60/80) and inclusive review
margin (±3 points) are illustrative. They are not official UCL admissions policy.
Unresolved critical evidence takes precedence, and unavailable sections never
silently become zero. An active tutor can change their own course's weights,
offer/reject thresholds and review margin on **Admission criteria**. Weights must
total 100%; all values must be finite and between 0 and 100, with rejection below
the offer threshold. The unimplemented academic-rule field is hidden from the UI;
its stored value remains for backup and mock API compatibility.

**Save criteria** creates and activates a new version for the whole course,
including all intakes. Existing assessments, recommendations and tutor decisions
remain unchanged; an explicit re-evaluation or correction uses the new version.
**Discard changes** restores the current active settings. Unsaved drafts reset
when switching courses or when the active version changes. The service rejects
stale or unchanged drafts and saves new version IDs, labels and audit records
atomically. New workspaces receive their own default example rubric.

Click a row in **Version history** to load that version's numeric settings into
the form. The selected row is highlighted and the form identifies the loaded
version. This does not change the active criteria or saved assessments.
**Save criteria** creates a new active version from those values; older versions
stay intact. The active version's metadata and internal rule stay current when
copying old settings. History rows work with keyboard activation and return focus
to the form. **Discard changes** or selecting the active row restores its settings.

Administrator permission alone and legacy publication flags grant no editing
rights. Criteria versions persist in IndexedDB and join browser backup/restore.
The optional FastAPI mock evaluator receives the chosen version with each request;
HTTP criteria storage/editing and PostgreSQL criteria tables remain future work.

## Uploads, persistence and recovery

- Upload transcript, CV and personal-statement PDFs: at most 20 MB per file and
  100 pages in total. Non-PDF, empty, corrupt and password-protected documents
  receive validation errors. Incomplete applications may be saved.
- Newly uploaded documents remain unassessed. The assessment view shows Not assessed
  and No assessment available, without technical backend warnings or invented scores.
  The demo does **not** invent scores or extracted facts for them. OCR and actual
  document assessment are backend work.
- Versioned IndexedDB stores records and original PDF blobs; blobs never enter
  the Redux store. Session identity and per-account module/intake selections are kept in session storage. Refresh preserves
  work, and stored deadlines recover in-flight simulated evaluations.
- As administrator, **Data operations → Create backup** exports records, original
  PDFs and history. **Restore backup** verifies structure, document hashes and
  references before asking to replace the current browser dataset. Backup import and export
  are limited to 100 MB. Keep downloaded files if you need recovery after clearing
  browser data.
- Confirmed local deletion removes the application, files, runs, corrections and
  decisions, retaining a minimal deletion event. Downloaded backups are separate.
- **Reset demo dataset** requires confirmation and restores the nine synthetic
  applications, three example courses and demo accounts. No automatic retention policy is configured.
- Storage failures remain visible rather than reporting a successful save.

## Architecture and backend integration

`src/app/` contains the typed store, session/UI slices, theme and RTK Query API.
`src/domain/` defines records and deterministic demo routing rules.
`src/services/` owns IndexedDB, synthetic fixtures, PDF validation, permissions,
audit events, simulated transitions and backup integrity checks.
`src/pages/` contains one page per screen, owning its queries, mutations, form
state, validation and event handlers. Pages compose controlled forms and visual
panels from `src/components/`, organised into `auth`, `applications`, `assessment`,
`evidence`, `criteria` and `admin` folders. Components receive typed values and
callbacks; screen logic stays in the page file.
`src/content/` mirrors pages and components with their display text and typed
message formatters. The shared `src/hooks/useContent.ts` selects a content file
by key, retaining the exact field and argument types. Labels are separate from
canonical domain values. See the [content guide](src/content/README.md).
See the [component structure guide](src/components/README.md) for navigation and
maintenance conventions.

The RTK Query base query is the integration boundary. Replace the browser demo
adapter with authenticated FastAPI queries/mutations while retaining typed view
models. Preserve document-page references, run/criteria versions, correction and
decision history, and recommendation justification fields. Validate actual server
responses and keep scoring/inference and authorisation on the backend. The current
operation union describes local capabilities; it is not a frozen HTTP API contract.

An optional stateless FastAPI mock scaffold now serves health and synthetic
assessment responses. `src/services/backend.ts` validates HTTP responses, and
`evaluation.ts` selects the configured evaluator. Backend errors are explicit;
no replacement scores or partial corrections are saved after a failed request.
New uploaded PDFs do not go through the synthetic endpoint. The admin health
rows still describe simulated browser services.

PostgreSQL integration with HTTP routes, real document assessment, local AI, real login, institutional retention
policy, official admissions integration and deployment remain unimplemented.
See [backend README](../backend/README.md) for the small contract, tests and next
replacement boundaries.

## Checks

```sh
npm run lint
npm test
npm run test:coverage
npm run build
npx playwright install chromium
npm run test:e2e
```

With Python backend dependencies installed, `npm run test:e2e:backend` runs the
real FastAPI/browser integration on separate test ports. The normal browser script uses a dedicated Vite `e2e` mode that clears the optional
API URL, so it tests the standalone demo without inheriting `.env.local`. See the backend guide for selecting a virtual-environment Python.

The browser suite checks all 15 screens at 1440×1000 and 390×844, role redirects,
source pages, corrections, independent tutor decisions, course criteria, workspace switching, PDF uploads,
refresh persistence, account/programme edits and backup/delete/restore/reset.
It checks keyboard sign-in, skip navigation and PDF selection, runs axe accessibility checks for critical/serious findings and saves screen
images and failure traces under ignored `test-results/frontend/` and
`playwright-report/`. The backend suite writes to `test-results/backend/` to keep
the two suites from deleting each other’s screenshots and traces.
The unit suite covers all 15 pages and their visual sections, routed screen imports,
role guards, Redux session/workspace persistence, RTK Query request mapping and
cache invalidation, scoring rules, PDF validation/cleanup, IndexedDB transactions,
administration commands and backup integrity. React tests use Testing Library
with jsdom and interact through labelled controls; async API/PDF dependencies are
mocked at the boundary. Service tests use fake IndexedDB to exercise real storage
and mutations. Chromium tests separately exercise the actual PDF.js parser and
the complete browser workflows.

`npm run test:watch` starts the unit tests in watch mode. Tests live beside the
code as `*.test.ts` or `*.test.tsx`; shared fixtures and rendering utilities live
in `src/test/`. The unit tests run without a browser installation or a backend.
Run a focused file with `npm test -- src/pages/ReviewPages.test.tsx`.

`npm run test:coverage` produces an ignored HTML report at `coverage/index.html`
and a machine-readable `coverage/coverage-summary.json`. Coverage includes
application logic and components, excluding test utilities, the React bootstrap
and declarative theme configuration. Minimum aggregate coverage is 95% lines,
90% statements/functions and 85% branches. Coverage does not prove correctness;
the failure-case assertions and browser regression tests complement it.

For this session the browser runtime was installed in a temporary directory:

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/ucl-admissions-browsers npm run test:e2e
```

Use the standard installation command on another machine. Formatting commands:

```sh
npm run format
npm run format:check
```

## Interface reference

The current visual direction, requested on 15 October 2026, follows the supplied
Mantis template: white surfaces, a light grey canvas, charcoal text, subtle
borders and restrained blue controls. `src/app/theme.ts` centralises the palette,
typography and MUI overrides. Action blue is darkened to keep white button text
accessible. Green/amber/red statuses retain explicit labels.

Public Sans (400/500/600/700, Latin) is self-hosted through `@fontsource/public-sans`;
the app does not request fonts from Google at runtime. The shell uses a 260 px
sidebar and 64 px header, with a temporary mobile drawer and stacked panels.
Shared `Card`, `Page` and `SummaryCards` keep spacing and hierarchy consistent.

The sidebar displays the UCL logo alone; sign-in pairs it with “Application Review
Workspace”. Shared `UclLogo` uses a locally bundled PNG from UCL's public Indigo
assets on a black background, matching the user's requested reference. Its source
is recorded in `src/assets/README.md`; it requires no external image request.
UCL fonts and Mantis branding, demo pages, mock authentication and Next.js runtime
are not bundled. The existing React pages own screen logic and shared controlled
components own presentation, as described in the component guide.
