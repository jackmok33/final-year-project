# Page and component structure

Start in `src/pages/` to understand a screen. Each page owns its data queries,
mutations, temporary form state, derived values, validation and event handlers.
Page files and their exported components use the `Page` suffix, such as
`LoginPage.tsx` and `LoginPage`. `App.tsx` loads the pages lazily.

`src/components/` contains the visual sections that pages compose. Forms and
panels receive typed values and callbacks from the page; they do not fetch screen
data or perform admissions or administration commands.

Display text belongs in the matching file under `src/content/`. Pages and
components read it using the shared `useContent()` hook; for example,
`useContent('decisionForm')` selects
`content/components/assessment/DecisionForm.content.ts`. Dynamic copy uses typed
formatter functions. See the [content guide](../content/README.md) for conventions.

| Folder          | Visual sections                                                       |
| --------------- | --------------------------------------------------------------------- |
| `auth/`         | Sign-in introduction and demo account form                            |
| `applications/` | Filters, application table, summaries and document upload form        |
| `assessment/`   | Recommendation, scores, flags, history, correction and decision forms |
| `evidence/`     | Document/page navigation, PDF rendering and cited claims              |
| `criteria/`     | Controlled criteria editor and preserved version history              |
| `admin/`        | Service health panels, accounts, programme forms, backup and deletion |
| `workspace/`    | Course/intake cards and workspace creation/deletion dialogs           |
| `batches/`      | ZIP selection and numbered batch history with review counts           |

For example, `pages/ApplicationsPage.tsx` fetches and filters applications.
It renders `QueueSummary`, `ApplicationFilters` and `ApplicationTable`.
The table shows Application, Score, AI recommendation and Decision; its application-reference
link opens the assessment. It distinguishes AI recommendations from recorded
tutor decisions and labels historical decisions and unfinished assessments.
`pages/NewApplicationPage.tsx` owns file selection, PDF validation, upload staging and
submission; `NewApplicationForm` renders the controlled fields and upload cards.

`AssessmentPage.tsx` owns the selected assessment, history expansion, queries and
re-evaluation command. Its private review controller is keyed by application so
navigation resets history and selection. Assessment, decision, correction and
evidence pages use the
query's current application data, showing loading while a different record is
fetched rather than displaying the previous record. `RecommendationSummary` renders the compact score,
AI recommendation, tutor decision and primary decision action. `ReviewFlags`
shows actionable concerns near the top, without raw flag codes or an empty
success panel. The shared `Rationale` has a compact presentation with inline
citations and expandable rules. `SectionAssessments` keeps scores visible and
expands each section's explanation, uncertainty and evidence on demand.
`RunHistory` is a controlled, initially collapsed panel containing the run picker,
corrections, decisions and re-evaluation action. Historical results cannot expose
actions that change the latest result; the page provides an explicit return to
the latest assessment. The header retains document viewing and Back.
The correction draft starts from the selected run's extracted grade, including
zero and fractional values; it does not prefill an example correction.

`DecisionPage` accepts a tutor outcome independently of the AI recommendation.
`DecisionForm` uses the same optional review note for every outcome; there is no
override-specific field or required explanation. The evidence-review checkbox and
its state/props are removed. The record action calls the page's save handler
directly; there is no extra decision confirmation dialog or modal state. The demo
`decide` command has no acknowledgement flag. It retains permission, current-run,
valid-outcome and critical-evidence checks, and stores the recommendation separately from the decision. Blank
notes display as Decision recorded in history, without implying AI agreement.

Some pages include a private draft controller in the same file, keyed to an
application run, criteria version, account or programme. This resets the draft
when the selected record changes while keeping all of its state and actions in
the page. The visual form remains in `components/`.

`Layout.tsx`, `common.tsx` and `FilePicker.tsx` provide shared navigation, cards,
dialogs, status indicators and accessible file selection. `files.ts` contains
download and display helpers. Reusable UI mechanics, such as the PDF viewer's
canvas rendering and cleanup, remain inside their components.

`ModulesPage.tsx` owns course creation drafts, mutations and errors and renders
the controlled `ModuleCards` and `CreateWorkspaceDialog`. The dialog asks for a
course name through **Add course**. The page and service share name validation;
the service generates a unique internal code. Cards show the saved name. Existing
technical component names and `/modules` routes are retained. It opens the new course's
intake picker after creation. `ModuleIntakesPage.tsx` owns application counts,
intake selection and workspace deletion. Intake selection now opens upload batches. `IntakeCards` receives year/count values
and a selection callback. Pages retain the logic; the cards do not fetch data.

`workspace/DeleteWorkspaceDialog.tsx` reuses `Confirm` and renders the deletion
impact. The intake page owns the impact query, errors, deletion mutation and
return to the course cards. Every owned course, including examples, offers deletion.
The service enforces single ownership and atomically removes the course's records
and blobs. The dialog has no shared-tutor warning. Metadata editing does not
transfer ownership.

`admin/UserPermissions` now displays owned courses as read-only information; it
does not render assignment checkboxes. `ProgrammeSettingsPage` only edits existing
course metadata and has an empty state when no courses exist. Tutors create their
own courses through Add course. `useWorkspace` and the demo service require tutor
role and `Programme.createdBy` ownership; legacy `User.programmeIds` cannot grant
access.

`Layout.tsx` provides the tutor's course sidebar and role/sign-out footer,
with the existing administrative navigation for administrators. Authorised
application deep links select both the module and intake. The selected intake
also keys the upload draft so unsaved inputs cannot move between years.

`UploadBatchesPage.tsx` owns file selection, staged archive references, import
mutations, errors and batch queries. The private controller is keyed by module
and intake to clear unsaved selections when context changes. `batches/ZipUploadPanel`
renders controlled upload/progress controls;
`batches/BatchList` shows numbered batch links with local date/time cells and applicant
and pending-review counts. Numbering is computed per module/intake by the demo service for consistent
list and detail headings. The importer validates and
prepares PDFs outside UI code. `ApplicationsPage` reuses the queue for an explicit
batch, using its authorised module/intake and filtering rows and summaries
by batch ID. The batch query never falls back to the full queue on an access error.
`UploadBatchesPage` owns whole-course CSV export (all intake years and batches),
with shared CSV escaping and the original criteria version for each assessment.

`SummaryCards.tsx` shares the responsive metric-card layout used by the application
queue and service health screens. Each feature supplies its own labels, values
and hints. `evidence/EvidenceLink.tsx` shares document/page validation and citation
navigation across recommendation rationales, section assessments and correction
guidance. New application uploads reuse `TwoColumns` for their form/guidance layout.
Keep feature-specific tables and fields in their own components; MUI already
provides the underlying controls.

The Mantis-style presentation is shared across screens: `Card` supplies a bordered
heading and padded content, `Page` aligns titles and actions before stacking them
on mobile, and metric cards keep their own compact typography. Palette, Public
Sans typography and control/table defaults live in `app/theme.ts`. Table containers
are keyboard focusable so horizontal overflow remains usable on smaller screens.
Use semantic palette tokens in panels; keep presentation changes separate from
the existing page logic and admissions rules.

Storage, permissions, assessment rules, PDF parsing and persistence remain in
`src/services/` and `src/domain/`. Shared Redux state and RTK Query definitions
remain in `src/app/`.

`CriteriaPage.tsx` owns criteria drafts, validation, ownership checks, save/reset
handlers and mutations, with a private editor keyed by course and active version.
`CriteriaForm` and `CriteriaFields` render the controlled numeric fields and save
actions. The course owner can edit weights, thresholds and margin. The UI omits
the unimplemented academic-rule field; legacy stored values remain compatible.
Saving creates a new active version in the demo service without
changing earlier assessments or decisions. Legacy publication flags do not grant
access. Drafts cannot move between courses or overwrite a newer active version.
The editor uses a single column with a short versioning note by its save actions;
the static recommendation-routing card is intentionally removed.
`CriteriaHistory` renders accessible version-row buttons with a selected state.
The page handles selection and copies only numeric settings into a draft based
on the current active version. It returns focus/scroll to the form and provides
the loaded-version feedback. Selection performs no mutation; saving creates a
new version through the existing command. Resetting returns to active settings.

Recurring demo/environment badges and integration notices are intentionally absent.
The old `BackendConnection` component/content/tests were removed, and AssessmentPage
no longer polls health for a connection banner. HTTP evaluation and response
validation remain in `services/backend.ts`. `hasUnavailableAssessment` supplies
consistent neutral assessment text for legacy unavailable runs, preserving stored
run data. Missing results show no fabricated score or recommendation; critical
evidence warnings and destructive-action confirmations remain. Summary-card hints
are optional so health cards do not render repeated environment labels.

When adding a screen, put its logic and composition in its page. Extract a form
or panel when it has a distinct visual purpose, passing its values and actions as
props. Use shared primitives without creating wrappers for every element or a
second screen container that merely duplicates the page.
