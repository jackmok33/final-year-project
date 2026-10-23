# Services and demo adapter

Start with `demo.ts`: it is the public adapter used by RTK Query, uploads and PDF
access. It serialises operations, loads and recovers the dataset, checks the active
account and commits prepared mutations. UI code imports this entry point rather
than the internal modules below. The public function signatures are unchanged.

| Module                 | Responsibility                                                                   |
| ---------------------- | -------------------------------------------------------------------------------- |
| `demo/contracts.ts`    | Typed queries, commands, results and mutation context                            |
| `demo/runtime.ts`      | Cross-tab lock, dataset migration/recovery, audit and temporary file references  |
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

Course deletion has no current interface and its unused demo command is removed.
Applicant deletion and administrator data maintenance remain. Historical deletion
audit entries and older backups remain readable. Every runtime module has a matching
test beside it, including `demo/access.test.ts`, `demo/applications.test.ts` and
`demo/backups.test.ts`. They may use the public service boundary to verify durable
behaviour and atomic writes. Cross-module transaction and HTTP-failure checks stay
in `demo.test.ts`. Storage, migration, PDF, ZIP and backend modules retain their own
tests. Type-only `demo/contracts.ts` is checked by TypeScript and its consumers.
See the [test guide](../test/README.md) for naming and the automated structure check.
