# Service boundary

`admissions.ts` always selects `httpAdmissionsService`. RTK Query and PDF consumers
use this transport-neutral port. Screens retain query/command handlers; the HTTP
adapter maps commands to explicit FastAPI routes, resolves staged originals and
validates unknown server JSON with `workspaceResponse.ts`. There is no offline
business-data cache or fallback.

`backendSession.ts` owns the per-tab access token and API URL. It sends Bearer
credentials without cookies and never stores applicant records. The frontend
userId guards stale results only; server token identity, active role and course
ownership determine permission. Account changes invalidate late read/save results.

`httpAdmissions.ts` coalesces concurrent workspace reads and projects the named
read models in `contracts.ts`. The server snapshot contains metadata/history,
never PDF bytes. `originalDocument` downloads authenticated PDF Blobs on demand.
`fileStaging.ts` keeps temporary File/ZIP references outside Redux; callers release
them in finally, including after navigation. ZIP parsing uses `zip.ts`; the server
independently validates every original and commits a whole batch atomically.

PostgreSQL owns users, programmes, upload_batches, rubrics, applications, documents,
audit_events and legacy programme_memberships. Applications store runs, corrections
and decisions as review_state JSONB. Membership compatibility lists do not grant
ownership. Criteria versions and original PDFs are preserved.

`assessmentNarrative.ts` and `applicantPresentation.ts` format recognised synthetic
examples without rewriting stored runs or inventing identities/results for uploads.
`backendHealth.ts` checks the public diagnostic endpoint with cancellation and a
ten-second timeout. That legacy mock-health contract does not verify PostgreSQL
or inference; a successful authenticated workspace read exercises database access.

The old `demo.ts`, `demo/`, `storage.ts`, `migration.ts`, `seed.ts`, `evaluation.ts`
and `backend.ts` remain for regression fixtures and legacy migration verification.
They are not imported by the production adapter or included in the running app's
persistence flow. `createSeed` is used only by isolated browser-test fixture setup;
opening the app never creates or migrates browser sample records.

The explicit CLI `backend/app/import_browser.py` imports an exported version-2
browser backup plus original PDFs in one PostgreSQL transaction. It validates
original hashes/page counts and rejects conflicts; it is never called on startup
or exposed as an HTTP reset/import route. Actual exported user data stays outside
Git. Real document extraction, Qwen assessment and LangGraph remain unimplemented.
