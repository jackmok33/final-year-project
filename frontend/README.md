# UCL Application Review Workspace

React + TypeScript frontend for the final-year admissions project. All 12 approved
Figma screens are implemented with a UCL purple theme, Redux Toolkit, RTK Query,
MUI and React Router. The design reference is the saved construction scripts in
`../design/figma/`; the user approved this fallback while Figma MCP access is quota-limited.

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
and PDFs still persist in this browser. The assessment page displays connection
status and identifies runs received from FastAPI. Without `VITE_API_BASE_URL`,
the original standalone browser demo works as before.

The Codex-bundled Node runtime used during development is:

```sh
export PATH=/Users/jack_1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
```

Use your own Node installation elsewhere. Vite's regenerable cache lives in the
system temporary directory, outside the OneDrive-synced project, to avoid cache
replacement interfering with development startup. Dependencies are pinned and
`package-lock.json` is included.

## Demo accounts

Select an account on the sign-in page; no password or real UCL credentials are used.

| Account            | Demo email             | Permissions                                                               |
| ------------------ | ---------------------- | ------------------------------------------------------------------------- |
| Jack · Demo tutor  | tutor@demo.ucl.local   | Both example courses, admissions review, read-only criteria               |
| Demo tutor B       | tutor.b@demo.ucl.local | First course and admissions review, read-only criteria                    |
| Demo administrator | admin@demo.ucl.local   | Accounts, programme metadata, simulated service health, local maintenance |

The administrator alone cannot read applicant documents or record admissions
decisions. Account deactivation and programme scope are checked by the demo
service as well as the UI. These are browser demonstration controls, not server
authentication or a security boundary against someone controlling this browser.

## Choose a course workspace

Use **Programme workspace** in the sidebar (inside the navigation drawer on
mobile). Only courses assigned to the signed-in tutor appear. The selection
changes the queue, CSV export, upload destination and criteria editor together,
and is remembered per demo account across refreshes in this browser tab. Opening
an authorised application link selects that application's course automatically.

Tutors can select **New workspace**, enter a programme workspace name (1–100
characters), and choose **Create workspace**. The new workspace is selected
immediately and starts with an empty application queue and its own example
rubric. Only its creator receives tutor access; administrators can assign other
tutors later. This also works for accounts with no assigned courses. Names must
be unique among the creator's accessible workspaces, ignoring case and outer
spaces; different tutors can use the same name for separate workspaces. Creating
a workspace does not grant administrator permissions. Criteria editing is disabled
for every account in the MVP.
Workspaces persist with the browser demo data and are included in backup/restore;
resetting the demo removes user-created workspaces. Codes and academic-year
metadata are generated initially and can be edited in administrator settings.

The creator can select **Delete workspace** for their current workspace. A
confirmation shows application, PDF and criteria-version counts and warns if
other tutors have access. Confirming deletes the entire workspace, all its
applications/review history, original PDFs, criteria versions and assignments.
Other courses remain unchanged. The app selects another accessible workspace;
if none remain, create a new one using **New workspace**. Cancellation and failed
writes preserve the workspace. Restore a previous demo backup to recover deleted
content. Assigned tutors and administrators cannot claim ownership or delete a
workspace they did not create. Earlier user-created workspaces recover their
creator from the stored creation audit; seeded/admin-created courses are shared
courses and do not show this tutor deletion action.

Jack's demo account has the original **Programme · TBC** and **Data Science ·
Example** workspaces. The first contains five cases; the second contains a sixth
synthetic case and a separate example rubric. These names and criteria are
illustrative, not official UCL courses or admissions policy.

Administrators can create courses in **Programme settings → New programme** and
assign any combination of courses in **Users & access → Edit account**. Creating
a course starts an example rubric and an empty queue; access must be assigned
explicitly. Administrator permission alone does not grant admissions access.
Each course's active criteria and version history remain independent.

Existing single-course browser data upgrades in place without resetting saved
reviews or PDFs. The upgrade adds a second example course for Jack's demo account;
if its sample application identifier is already in use, that queue starts empty.
Version 1 backups are still accepted and restored as their original single course.
New backups use dataset version 2 and include all configured courses.

## Review a sample application

The application queue has four columns: **Application** (click the reference to
open the assessment), **Score** (overall assessment score out of 100), **AI
recommendation** and **Decision** (the tutor's recorded choice). Processing
and failure statuses appear in AI recommendation until an assessment is available; no
unfinished score is displayed. Decisions from older runs are marked **Previous
assessment**. Evidence flags and full workflow details remain on the assessment
page, and CSV exports retain the fuller operational fields.

1. Sign in as the first tutor and open **APP-2026-0142**.
2. Read **Why this recommendation**, then open the transcript citation on page 2.
3. Inspect the original synthetic PDF: the grade is 74%, while the initial
   extraction is 71%. Accessible embedded page text is available below the viewer.
4. Correct the fact to 74% with a source page and reason. A new simulated run
   preserves the previous extraction, assessment and any recorded decision.
5. Review the new result. The illustrative score remains 78.4, within the review
   margin of the offer threshold. Further Review keeps the case open; an Offer or
   Reject override requires a reason, evidence-review acknowledgement and a
   separate confirmation dialog. Critical flags block final decisions.
6. Export the filtered application queue as CSV.

Other seeds cover Offer, Reject, missing mandatory evidence and model failure.
An administrator can simulate model recovery; a tutor can then re-evaluate the
failed seeded case. All inference and health states are explicitly simulated.

The three-section weights (50/25/25), thresholds (60/80) and inclusive review
margin (±3 points) are illustrative. They are not official UCL admissions policy.
Unresolved critical evidence takes precedence, and unavailable sections never
silently become zero. **Admission criteria** is read-only for the MVP: weights,
thresholds, review margin and entry rules cannot be changed or activated. Existing
stored criteria and earlier assessment versions remain intact; new workspaces
receive the default example rubric. Legacy publication permission flags are
retained for backup compatibility but grant no editing ability. Configurable
criteria and the other additions in the requirements review are deferred until
after the minimal review workflow is complete.

## Uploads, persistence and recovery

- Upload transcript, CV and personal-statement PDFs: at most 20 MB per file and
  100 pages in total. Non-PDF, empty, corrupt and password-protected documents
  receive validation errors. Incomplete applications may be saved.
- Newly uploaded documents receive an explicit backend-unavailable review state.
  The demo does **not** invent scores or extracted facts for them. OCR and actual
  document assessment are backend work.
- Versioned IndexedDB stores records and original PDF blobs; blobs never enter
  the Redux store. Session identity and per-account workspace selections are kept in session storage. Refresh preserves
  work, and stored deadlines recover in-flight simulated evaluations.
- As administrator, **Data operations → Create backup** exports records, original
  PDFs and history. **Restore backup** verifies structure, document hashes and
  references before asking to replace the current browser dataset. Backup import and export
  are limited to 100 MB. Keep downloaded files if you need recovery after clearing
  browser data.
- Confirmed local deletion removes the application, files, runs, corrections and
  decisions, retaining a minimal deletion event. Downloaded backups are separate.
- **Reset demo dataset** requires confirmation and restores the six original
  applications across two example courses and demo accounts. No automatic retention policy is configured.
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

PostgreSQL, real document assessment, local AI, real login, institutional retention
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
real FastAPI/browser integration on separate test ports. The normal browser suite
should run with `VITE_API_BASE_URL` unset (or set to an empty string) to verify the
standalone demo. See the backend guide for selecting a virtual-environment Python.

The browser suite checks all 12 screens at 1440×1000 and 390×844, role redirects,
source pages, corrections, decision overrides, independent course criteria, workspace switching, PDF uploads,
refresh persistence, account/programme edits and backup/delete/restore/reset.
It checks keyboard sign-in, skip navigation and PDF selection, runs axe accessibility checks for critical/serious findings and saves screen
images and failure traces under ignored `test-results/` and `playwright-report/`.
The unit suite covers all 12 pages and their visual sections, routed screen imports,
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

## Brand reference

Colours follow [UCL's current palette](https://www.ucl.ac.uk/brand-and-experience/brand/visual-guidelines/colour).
The font stack is `Aptos, Arial, sans-serif`, following the fallback described in
[UCL typography guidance](https://www.ucl.ac.uk/brand-and-experience/brand/visual-guidelines/typography).
Brand text reads “UCL Application Review Workspace”; official logo artwork and UCL Sans
font files are not distributed with this project.
