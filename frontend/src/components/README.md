# Page and component structure

Pages use RTK Query and the `services/admissions.ts` port for application data and
original documents. Temporary file references come from `services/fileStaging.ts`;
error text is normalised in `services/errors.ts`. Components do not import demo
storage, dataset recovery or API initialisation for formatting an error.

Start in `src/pages/`. Pages own screen queries, mutations, temporary form state,
derived values, validation and handlers. File/component names have the `Page`
suffix. A keyed private controller may reset a draft when the selected record,
intake or active criteria version changes. Do not move all logic into a visual
component and leave an empty page wrapper.

`src/components/` contains controlled visual sections with typed values/callbacks.
Reusable UI mechanics such as PDF rendering, cancellation and cleanup can stay
in components. Copy belongs in matching `src/content/` files, selected through the
same typed `useContent()` hook; dynamic messages use named formatters.

Each page/component has a matching colocated test, for example
`pages/AssessmentPage.test.tsx` and `components/assessment/DecisionForm.test.tsx`.
Keep screen orchestration checks in page tests and controlled UI behaviour in
component tests. See the [test guide](../test/README.md) for the enforced convention.

Shared workspace selection, typed Redux bindings and table pagination belong in
`src/hooks/`. Both table pages use `usePagination`; each page still owns filtering,
sorting and its queries. See the [hooks guide](../hooks/README.md) before creating
another shared state helper.

| Area            | Responsibilities                                                                 |
| --------------- | -------------------------------------------------------------------------------- |
| `auth/`         | Mantis email/password layout, existing-account/help dialogs and UCL branding     |
| `layout/`       | Controlled Mantis header/account menu and programme/admin navigation             |
| `workspace/`    | Programme/intake cards and name-entry dialog                                     |
| `batches/`      | ZIP drop area, numbered batch table and outcome analytics                        |
| `applications/` | Search/filter/sort toolbar, applicant table and PDF submission form              |
| `assessment/`   | Summary, evidence groups, flags, score accordions, correction and decision forms |
| `evidence/`     | Original PDF navigation, rendering and validated source links                    |
| `criteria/`     | Controlled active criteria fields and save actions                               |
| `admin/`        | Existing account/programme controls, health and browser-data maintenance         |

`ModulesPage` queries owned programmes and available intakes and controls creation.
`ModuleCards` renders only direct intake links. The obsolete management page, its
settings shortcuts, deletion dialog, content and RTK deletion-preview query have
been removed. Old management URLs return to the Programme list through the route
fallback; no stored courses are deleted.
`Layout` owns workspace queries, deep-link selection, drawer/account-menu state
and sign-out handlers. `layout/WorkspaceHeader` and `WorkspaceNavigation` render
the controlled Mantis shell. `auth/ProtectedRoute` owns route permission/session
checks separately from the layout. Authorised deep links update programme/intake
selection; the visual sections do not fetch or mutate application data.

`UploadBatchesPage` owns the selected URL tab, upload draft, archive staging,
queries, pagination and whole-course CSV export. Its private controller is keyed
by programme/intake. It composes the metrics, `ZipUploadPanel`, `BatchList`,
`CriteriaPage` and `CourseAnalytics` under page-level Mantis tabs. The metrics,
upload panel and batch list live inside Batches; criteria and analytics show only
their respective content. The page retains the selected ZIP across tab switches.
`BatchList` owns the visual loading/error/empty
states and Mantis pagination controls; its values and callbacks come from the page.
Criteria is also available via `/criteria`,
which selects this workspace's criteria tab. Passing the explicit programme ID
to the criteria editor prevents a preceding selection from appearing during a
route transition.

`ApplicationsPage` owns scoped filtering/sorting/pagination and confirmed applicant
deletion. The table has nine design columns and labelled view/delete actions. The page owns
typed column/direction sort state and compares displayed data across all eight data
columns. The controlled table renders Mantis-styled sort toggles and aria-sort;
Actions stays unsorted. Quick-sort choices stay synchronised with header sorting.
Status/score/decision helpers prevent incomplete assessments and old decisions
from appearing current. `NewApplicationPage` validates PDF drafts and the optional
batch context before staging files. Its private editor is keyed by account,
programme, intake and batch, so switching context starts a fresh draft. Creation
requires an active tutor who owns the course; compatibility assignment arrays do
not grant access. Late PDF inspection/create results cannot update or redirect a
different screen. Import parsing and atomic persistence stay in services.

AI fields use `aiRecommendation()` for Unconditional/Conditional/Reject, or `—`
while unavailable. It projects legacy Offer/Further review to Unconditional/
Conditional for the prototype without changing source runs. `decisionOutcome()`
provides the three tutor outcomes plus Pending; unclassified legacy decisions and
old-run decisions remain pending. Table sorting, summaries, intake counts/analytics
and CSV exports use these same current values. Pending is not a saved radio option.

`domain/applicationSummary.ts` provides current-decision counts for applicant
queues, intake metrics, analytics and batch rows; each caller supplies its own
scope. `domain/documentLimits.ts` shares PDF size/page validation between forms,
PDF parsing, ZIP import and backup validation. Stateful async completion guards
belong in `hooks/useIsMounted.ts`; resource cleanup still runs after navigation.

`AssessmentPage` owns queries, tab navigation, URL-backed decision-popup state and
re-evaluation. It
shows the latest run by default without history controls; existing run/citation
bookmarks remain supported as read-only views. It composes the summary and four
tabs: recommendation/evidence, flags, scores and original documents. The summary
accepts controlled action buttons for Re-run AI evaluation and Decision. Evidence
URLs enter the documents tab; legacy decision URLs open the popup. `EvidencePage`
and `DecisionPage` retain their own screen logic while rendering within that
shell. Current query data avoids showing
the previous applicant's PDF or form. Historic runs disable mutation actions.

`RecommendationSummary` renders only score, AI and tutor decision. `RecommendationPanel`
renders the explanation, source links and supplied evidence groups. `EvidenceSummary`
renders supplied evidence groups without extraction. `ReviewFlags` renders Mantis
alerts and supported correction links. `SectionAssessments` renders section
accordions and validated `EvidenceLink` sources. The unused `RunHistory` panel and
its old `Rationale` rendering path were removed. The recommendation still displays
its justification and source-page links.

`DecisionPage` owns the decision query/mutation, keyed draft and optional note.
The supplied-source `mantis/components/CustomizedDialog` renders both the decision
popup and login help; its caller supplies labels and state. The former separate
`DecisionDialog` wrapper and its content were removed. `DecisionForm` and
`OutcomeOptions` are controlled, using Mantis card/radio patterns. Successful save
closes the popup and updates the summary; Cancel/close/Escape preserve the review
tab without saving. Saving disables edits and dismissal; errors retain the draft.
Historical deep links show a read-only notice instead of the form. An unmounted
popup cannot navigate after an in-flight save completes.
No override reason, acknowledgement checkbox or extra save dialog exists. The
service still enforces active ownership, current run and critical-evidence rules.
Original recommendations and legacy decisions remain separate stored records.

`CriteriaPage` owns draft validation, save/reset and mutations;
its private editor is keyed by course/active version. Only active settings are
shown, without a history list or version-loading state. Saving retains immutable
versions internally; old results remain linked to their original settings.
Displaying this page inside the workspace does not transfer its logic into a
component.

The supplied Mantis source lives in `src/mantis/` with a provenance manifest.
`MainCard`, `AuthCard`, `AnalyticEcommerce`, `FormActions`, header/drawer/NavItem,
SimpleBar, avatar, icon buttons and loaders are shared imports. New controlled
adaptations include `TabsCard`, `TablePagination` and `SingleFileUpload`, plus the
actual template upload SVG. `CustomizedDialog` extracts the reusable chrome from
the supplied dialog example; source hashes and adaptations are documented in the
Mantis manifest/guide. Check supplied Mantis components and examples before adding
a generic UI control. Keep custom components for admissions-specific composition,
not duplicate buttons, fields, tables or modal mechanics.
Theme factories style underlying MUI controls; Mantis
itself imports MUI, so a MUI import is not evidence of a separate design system.
Avoid aliases/wrappers that merely rename every MUI primitive.

`common.tsx` supplies Page, Card, status/error/loading and confirmation
patterns. `SummaryCards` supplies values to Mantis statistics cards. `files.ts`
contains download/display helpers. `EvidenceLink` centralises citation identity,
page validation and encoded navigation. Confirmations remain for delete/reset/
restore. Keyboard focus, explicit labels and table overflow stay accessible.

Domain rules, persistence, permissions, extraction boundaries, validation and audit
records belong in `src/domain/` and `src/services/`; shared Redux and RTK Query in
`src/app/`. Reuse meaningful patterns without introducing a generic table engine
that hides different feature behaviour.

The pre-commit cleanup removes obsolete content entries, the unused deletion-preview
service query and the frontend HTTP health probe. The backend health route remains
available; no screen monitors it. Assessment readiness is shared in `domain/types.ts`
so queues, summaries, evidence fixtures and decision forms agree about unfinished
results. Section panels accept only the values they render. Domain-specific
components still compose Mantis controls and should not be removed just because
Mantis now supplies their visual foundation.

The structural follow-up removes the unexposed course-deletion service command
and its obsolete tests. Backup/ownership invariants stay covered in the active
service suites. See [service structure](../services/README.md) for the demo adapter's
internal responsibilities and transaction boundaries.
