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
| `criteria/`     | Criteria fields, activation dialog, routing explanation and history   |
| `admin/`        | Service health panels, accounts, programme forms, backup and deletion |

For example, `pages/ApplicationsPage.tsx` fetches and filters applications and handles
CSV export. It renders `QueueSummary`, `ApplicationFilters` and `ApplicationTable`.
`pages/NewApplicationPage.tsx` owns file selection, PDF validation, upload staging and
submission; `NewApplicationForm` renders the controlled fields and upload cards.

Some pages include a private draft controller in the same file, keyed to an
application run, criteria version, account or programme. This resets the draft
when the selected record changes while keeping all of its state and actions in
the page. The visual form remains in `components/`.

`Layout.tsx`, `common.tsx` and `FilePicker.tsx` provide shared navigation, cards,
dialogs, status indicators and accessible file selection. `files.ts` contains
download and display helpers. Reusable UI mechanics, such as the PDF viewer's
canvas rendering and cleanup, remain inside their components.

`SummaryCards.tsx` shares the responsive metric-card layout used by the application
queue and service health screens. Each feature supplies its own labels, values
and hints. `evidence/EvidenceLink.tsx` shares document/page validation and citation
navigation across recommendation rationales, section assessments and correction
guidance. New application uploads reuse `TwoColumns` for their form/guidance layout.
Keep feature-specific tables and fields in their own components; MUI already
provides the underlying controls.

Storage, permissions, assessment rules, PDF parsing and persistence remain in
`src/services/` and `src/domain/`. Shared Redux state and RTK Query definitions
remain in `src/app/`.

When adding a screen, put its logic and composition in its page. Extract a form
or panel when it has a distinct visual purpose, passing its values and actions as
props. Use shared primitives without creating wrappers for every element or a
second screen container that merely duplicates the page.
