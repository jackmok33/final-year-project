# Services and adapters

Start with `admissions.ts`. It selects the implementation used by RTK Query and
original-PDF reads. The `AdmissionsService` interface has three operations:
typed `query`, `command` and `originalDocument`. The current implementation
delegates to `demo.ts`; screens do not import demo storage or permission helpers.

`contracts.ts` contains request types and named read models, including
`ApplicationDetail`, `AccountSummary`, `ProgrammeIntake` and `RubricCollection`.
`QueryResults` gives each operation one result type shared by the adapter and RTK
Query. It is independent of IndexedDB, React and the demo mutation context.

`fileStaging.ts` holds temporary File/ZIP/backup references outside Redux. Both
the UI and selected adapter use the same registry. Release references after the
operation finishes, including after failure or navigation. `errors.ts` extracts
useful local/RTK/HTTP messages without importing API initialisation into the UI.

`browserBackups.ts` validates and stages a restore, returning only its reference
and preview counts to the administrator page. This feature applies to the local
demo dataset; it is not a server backup API. Pages do not cast unknown JSON into
stored records. Pending previews are released on cancellation/navigation, while
confirmed in-flight restores keep their reference until completion.

## Browser implementation

`demo.ts` serialises operations, loads and recovers the dataset, checks the active
account and commits prepared mutations. Existing exports remain available for
compatibility and service tests. UI code uses the neutral entry points above.

| Module                 | Responsibility                                                                   |
| ---------------------- | -------------------------------------------------------------------------------- |
| `demo/contracts.ts`    | Demo-only mutation context; shared command types come from `contracts.ts`        |
| `demo/runtime.ts`      | Cross-tab lock, dataset migration/recovery and audit                             |
| `demo/access.ts`       | Active account, administrator, course ownership and current-run checks           |
| `demo/queries.ts`      | Permission-checked read projections                                              |
| `demo/applications.ts` | Individual/ZIP uploads, evaluation, correction, decisions and applicant deletion |
| `demo/settings.ts`     | Account/programme metadata, course creation, criteria and service toggles        |
| `demo/backups.ts`      | Backup creation, staged validation, restore and reset                            |

Application/settings handlers mutate only the loaded working copy and collect
new/removed PDF references. `demo.ts` commits those changes together through
`storage.ts`. A failed validation or evaluator call never saves a partial mutation.
Backup/restore/reset own their replacement transactions. All operations share the
same lock, including original-document reads. PDFs and staged archives stay outside
Redux and are released by their callers.

`storage.ts` owns IndexedDB. `migration.ts` upgrades existing records without a
reset. `seed.ts` contains the required synthetic dataset and its one-time sample
upgrades. `batchImport.ts`, `zip.ts` and `pdf.ts` validate originals before storage.
These are active data/validation paths, not obsolete UI components.

`evaluation.ts` selects the local fixture or `backend.ts` FastAPI adapter. The
backend still accepts only known synthetic cases; real upload assessment and server
persistence are later work. `applicantPresentation.ts` supplies presentation data
for known fixtures and never invents identities/evidence for uploads.

`backend.ts` validates unknown JSON in named stages for context/identity, timing,
scores, sections, flags, citations and recommendation consistency. It normalises
nullable optional fields on a copy and rejects invalid results before storage.

PDF size, document page counts and combined application-page limits come from
`domain/documentLimits.ts`. File parsing and persistent validation share those
rules; UI limit checks do not need to load PDF.js.

## Future FastAPI integration

Implement `AdmissionsService` in an HTTP adapter and select it in `admissions.ts`.
Map validated server response models to `contracts.ts`; return original PDF blobs
from `originalDocument`. Resolve staged file references in that adapter when
building upload requests, rather than passing File objects through Redux.
The current command union is an adapter contract, not a list of existing REST
routes. Browser backup/reset/model controls need explicit handling and must not
be presented as implemented server endpoints.

RTK Query keeps caching and invalidation; pages retain queries, drafts, validation
and handlers. A real backend must establish authenticated identity and enforce
permissions itself. The current `userId` argument supplies browser-demo context,
not authentication. This refactor adds no HTTP routes, authentication or database
integration. The existing mock assessment contract remains unchanged.

Course deletion has no current interface and its unused demo command is removed.
Applicant deletion and administrator data maintenance remain. Historical deletion
audit entries and older backups remain readable. Every runtime module has a matching
test beside it, including `demo/access.test.ts`, `demo/applications.test.ts` and
`demo/backups.test.ts`. They may use the public service boundary to verify durable
behaviour and atomic writes. Cross-module transaction and HTTP-failure checks stay
in `demo.test.ts`. Storage, migration, PDF, ZIP and backend modules retain their own
tests. Type-only `contracts.ts` and `demo/contracts.ts` are checked by TypeScript
and their consumers.
See the [test guide](../test/README.md) for naming and the automated structure check.
