# Shared hooks

Reusable React behaviour belongs here. Each hook module has a matching colocated
test; imports point to this folder directly, with no duplicate app-level exports.

| File               | Responsibility                                                         |
| ------------------ | ---------------------------------------------------------------------- |
| `useContent.ts`    | Typed selection of display copy from the content registry              |
| `useWorkspace.ts`  | Owned programmes, selected programme and per-account intake preference |
| `redux.ts`         | Typed `useAppDispatch` and `useAppSelector` bindings                   |
| `usePagination.ts` | Table page/page-size state, bounded row offsets and reset behaviour    |
| `useIsMounted.ts`  | Stable guard for state/navigation after an asynchronous operation      |

Pages own their feature queries, filters, sort rules, drafts, validation and
mutations. They pass the result count to `usePagination` and slice their own sorted
rows using its offsets. Changing page size returns to page one; filter/sort
handlers explicitly call `resetPage()`. The caller supplies a positive page size.

Use `useIsMounted()` after an `await` before updating a page or navigating. Keep
resource cleanup in `finally`, even after unmount. PDF render cancellation remains
local to each document/page effect because those inputs can change while the
component stays mounted. The mounted guard does not replace operation-specific
cancellation or service-side permission checks.

Keep one-screen controllers and feature-specific handlers in their Page file.
Extract a shared hook when the same stateful responsibility is reused across
screens. Generated RTK Query endpoint hooks stay with their definitions in
`app/api.ts`; store creation, reducers and actions stay in `app/store.ts`.
