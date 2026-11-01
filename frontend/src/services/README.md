# Services and adapters

Start with `admissions.ts`. It selects the implementation used by RTK Query and
original-PDF reads. The `AdmissionsService` interface has three operations:
typed `query`, `command` and `originalDocument`. The current implementation
delegates to `demo.ts`; screens do not import demo storage or permission helpers.

`contracts.ts` contains request types and named read models, including
`ApplicationDetail`, `AccountSummary`, `ProgrammeIntake` and `RubricCollection`.
`QueryResults` gives each operation one result type shared by the adapter and RTK
Query. It is independent of IndexedDB, React and the demo mutation context.

`fileStaging.ts` holds temporary PDF/ZIP references outside Redux. Both
the UI and selected adapter use the same registry. Release references after the
operation finishes, including after failure or navigation. `errors.ts` extracts
useful local/RTK/HTTP messages without importing API initialisation into the UI.

The browser backup/restore interface, preview adapter, commands, archive validation
and staging helpers have been removed. Existing records and PDF blobs are unchanged.
Server database backup belongs to deployment/operations when backend persistence is
integrated. `src/test/resetDemo.ts` prepares fresh fixtures for tests; it is not an
application command.

## Browser implementation

`demo.ts` serialises operations, loads and recovers the dataset, checks the active
account and commits prepared mutations. UI code uses the neutral entry points above.

| Module                 | Responsibility                                                                   |
| ---------------------- | -------------------------------------------------------------------------------- |
| `demo/contracts.ts`    | Demo-only mutation context; shared command types come from `contracts.ts`        |
| `demo/runtime.ts`      | Cross-tab lock, dataset migration/recovery and audit                             |
| `demo/access.ts`       | Active account, administrator, course ownership and current-run checks           |
| `demo/queries.ts`      | Permission-checked read projections                                              |
| `demo/applications.ts` | Individual/ZIP uploads, evaluation, correction, decisions and applicant deletion |
| `demo/settings.ts`     | Account management, private course creation and criteria updates                 |

Application/settings handlers mutate only the loaded working copy and collect
new/removed PDF references. `demo.ts` commits those changes together through
`storage.ts`. A failed validation or evaluator call never saves a partial mutation.
Review flags are advisory when recording tutor decisions: they do not block
Conditional, Unconditional or Reject. Decision commands still require an active
owner and a current, available assessment. Saving a decision never clears flags
or changes the AI recommendation.
All operations share the same lock, including original-document reads.
PDFs and staged archives stay outside
Redux and are released by their callers.

`storage.ts` owns IndexedDB. `migration.ts` upgrades existing records without a
reset. `seed.ts` contains the required synthetic dataset and its one-time sample
upgrades. `batchImport.ts`, `zip.ts` and `pdf.ts` validate originals before storage.
These are active data/validation paths, not obsolete UI components.

`evaluation.ts` selects the local fixture or `backend.ts` FastAPI adapter. The
backend still accepts only known synthetic cases; real upload assessment and server
persistence are later work. `applicantPresentation.ts` supplies presentation data
for known fixtures and never invents identities/evidence for uploads.

`assessmentNarrative.ts` expands recognised short text for current core synthetic
cases (APP-2026-0142–0146) into a display-only assessment clone. It explains the
available evidence, limitations and score contributions using the rubric matching
`run.rubricId`, after checking score/weight consistency. Original strings stay as
the first paragraphs. Stored runs, HTTP responses, scores, flags, citations and
decisions are untouched. Uploads, unknown cases, historical bookmarks, unavailable
results, custom evaluator text and missing sections are not given invented prose.
This is presentation of mock fixtures, not new extraction or inference.

`backend.ts` validates unknown JSON in named stages for context/identity, timing,
scores, sections, flags, citations and recommendation consistency. It normalises
nullable optional fields on a copy and rejects invalid results before storage.

`backendHealth.ts` probes the configured FastAPI `/health` endpoint without touching
browser records or holding the demo dataset lock. The separate RTK Query
`backendHealth` endpoint supports cancellation, a ten-second timeout, response
validation and explicit available/unavailable/not-configured reports. It does not
fall back to the legacy simulated `health` query. The API currently reports mock
mode and unconfigured database/inference; connectivity to those systems is not tested.

PDF size, document page counts and combined application-page limits come from
`domain/documentLimits.ts`. File parsing and persistent validation share those
rules; UI limit checks do not need to load PDF.js.

## Future FastAPI integration

Implement `AdmissionsService` in an HTTP adapter and select it in `admissions.ts`.
Map validated server response models to `contracts.ts`; return original PDF blobs
from `originalDocument`. Resolve staged file references in that adapter when
building upload requests, rather than passing File objects through Redux.
The current command union is an adapter contract, not a list of existing REST
routes. Removed browser maintenance commands must not be reintroduced as assumed
server endpoints.

RTK Query keeps caching and invalidation; pages retain queries, drafts, validation
and handlers. A real backend must establish authenticated identity and enforce
permissions itself. The current `userId` argument supplies browser-demo context,
not authentication. This refactor adds no HTTP routes, authentication or database
integration. The existing mock assessment contract remains unchanged.

Course deletion has no current interface and its unused demo command is removed.
Tutor applicant deletion remains. Historical records, ownership and saved-data
migrations remain supported. Every runtime module has a matching
test beside it, including `demo/access.test.ts`, `demo/applications.test.ts` and
`demo/settings.test.ts`. They may use the public service boundary to verify durable
behaviour and atomic writes. Cross-module transaction and HTTP-failure checks stay
in `demo.test.ts`. Storage, migration, PDF, ZIP and backend modules retain their own
tests. Type-only `contracts.ts` and `demo/contracts.ts` are checked by TypeScript
and their consumers.
See the [test guide](../test/README.md) for naming and the automated structure check.

Admin UI exposes account management and read-only HTTP health. Obsolete programme,
model, generic delete, backup/restore/reset commands and simulated health/audit queries
are removed from the adapter and RTK Query. Stored audit events/model state still
support evaluation, ownership migration and sample tombstones; they are preserved.
