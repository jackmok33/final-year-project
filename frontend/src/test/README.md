# Finding and writing tests

Keep a test beside the implementation it owns, using the same basename:

```text
pages/AssessmentPage.tsx
pages/AssessmentPage.test.tsx

components/assessment/DecisionForm.tsx
components/assessment/DecisionForm.test.tsx

services/demo/settings.ts
services/demo/settings.test.ts
```

Every application page, component, hook and runtime module has a companion.
Tests for TypeScript modules may use `.test.tsx` when they need JSX, such as
`useWorkspace.test.tsx`. Put related cases in `describe` blocks inside the companion
rather than creating names such as `ReviewPages`, `redesign` or `ownership`.

Page tests exercise screen state, queries, validation and navigation. Component
tests exercise controlled props, events, accessibility and disabled/empty states.
Service tests exercise the named module's behaviour; persistence and permission
checks may use the public demo adapter so that transaction guarantees are tested
without coupling the assertions to private implementation details. Cross-module
transaction and HTTP-failure guarantees belong in `services/demo.test.ts`.

Do not add placeholder tests merely to match filenames. Static content records,
content registration, type-only contracts/declarations, `main.tsx` bootstrapping,
and supplied Mantis configuration/style factories are tested through their
consumers, TypeScript and browser checks.
`services/contracts.ts` and `services/demo/contracts.ts` contain types only and
are explicit exceptions to the runtime companion check.
Content formatters have direct tests; the content registry is checked by
`useContent.test.tsx`. Adapted Mantis components,
navigation and utility functions have their own companion tests. Shared MUI theme
compatibility checks live in `app/theme.test.tsx`.

`src/test/` contains shared fixtures, mocks, rendering and environment setup,
not feature suites. `e2e/*.spec.ts` intentionally describes full user workflows
that span multiple source files.

`resetDemo.ts` seeds isolated test fixtures directly through the storage/runtime
helpers. Fixture reset is not an application command. Keep it under `src/test/`
and never import it from production code.

Run from `frontend/`:

```sh
npm test
npm test -- src/pages/AssessmentPage.test.tsx
npm run test:coverage
npm run test:structure
```

`test:structure` rejects missing runtime companions and tests without a matching
source file. Both `test` and `test:coverage` run this check first.

## Connected PostgreSQL browser tests

Both Playwright configurations launch the server with explicit test-only CLI setup.
Set distinct `DATABASE_URL`/`TEST_DATABASE_URL` values and `UCL_BACKEND_PYTHON`.
The test URL must name an approved `_test` database. CLI setup checks this before
migrating or truncating; the normal app exposes no reset route. Each test imports
generated synthetic fixtures and token hashes outside the repository. IndexedDB
is disabled in test browser contexts to verify all UI workflows use PostgreSQL.
Run browser and PostgreSQL suites sequentially against a shared test database.
Do not reuse the actual migrated applicant backup for automated tests.
