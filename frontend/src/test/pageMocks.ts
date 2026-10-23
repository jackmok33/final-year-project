import { vi } from 'vitest'
import {
  application,
  detail,
  otherProgramme,
  programme,
  rubric,
  tutor,
  administrator,
} from './fixtures'
import type { RootState } from '../app/store'

export const queryResult = (data?: unknown) => ({
  data,
  currentData: data,
  isLoading: false,
  error: undefined as unknown,
})
export const unwrap = vi.fn<() => Promise<{ id?: string; backupId?: string }>>()
export const command = vi.fn(() => ({ unwrap }))
export const mutation = { isLoading: false, error: undefined as unknown }
export const apiMocks = {
  errorMessage: (error: unknown) =>
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : ((error as { data?: string })?.data ?? 'The operation could not be completed.'),
  admissionsApi: { util: { resetApiState: () => ({ type: 'api/reset' }) } },
  useAccountsQuery: vi.fn(),
  useMeQuery: vi.fn(),
  useApplicationsQuery: vi.fn(),
  useBatchesQuery: vi.fn(),
  useBatchQuery: vi.fn(),
  useApplicationQuery: vi.fn(),
  useProgrammesQuery: vi.fn(),
  useProgrammeIntakesQuery: vi.fn(),
  useRubricsQuery: vi.fn(),
  useUsersQuery: vi.fn(),
  useHealthQuery: vi.fn(),
  useAuditQuery: vi.fn(),
  useCommandMutation: vi.fn(() => [command, mutation]),
}
export const workspaceMock = vi.fn()
export const dispatch = vi.fn()
export const state = {
  session: { userId: 'tutor-a' as string | null },
  ui: {
    navigationOpen: false,
    programmeByUser: {} as Record<string, string>,
    intakeByUser: {} as Record<string, Record<string, string>>,
  },
}
export const reduxMocks = {
  useAppDispatch: () => dispatch,
  useAppSelector: (select: (s: RootState) => unknown) => select(state as RootState),
}
export const storeMocks = {
  signIn: (id: string) => ({ type: 'session/signIn', payload: id }),
  signOut: () => ({ type: 'session/signOut' }),
  selectProgramme: (payload: unknown) => ({ type: 'ui/selectProgramme', payload }),
  setNavigationOpen: (payload: boolean) => ({ type: 'ui/setNavigationOpen', payload }),
}
export function resetPageMocks() {
  vi.clearAllMocks()
  unwrap.mockReset().mockResolvedValue({ id: 'APP-CREATED' })
  mutation.isLoading = false
  mutation.error = undefined
  apiMocks.useAccountsQuery.mockReturnValue(queryResult([tutor, administrator]))
  apiMocks.useMeQuery.mockReturnValue(queryResult(tutor))
  apiMocks.useApplicationsQuery.mockReturnValue(queryResult([application]))
  apiMocks.useBatchesQuery.mockReturnValue(queryResult([]))
  apiMocks.useBatchQuery.mockReturnValue(queryResult())
  apiMocks.useApplicationQuery.mockReturnValue(queryResult(structuredClone(detail)))
  apiMocks.useProgrammeIntakesQuery.mockReturnValue(queryResult([]))
  apiMocks.useProgrammesQuery.mockReturnValue(queryResult([programme, otherProgramme]))
  apiMocks.useRubricsQuery.mockReturnValue(queryResult({ rubrics: [rubric], activeId: rubric.id }))
  apiMocks.useUsersQuery.mockReturnValue(queryResult([tutor, administrator]))
  apiMocks.useHealthQuery.mockReturnValue(
    queryResult({
      modelAvailable: false,
      failed: 1,
      queued: 0,
      logs: [{ jobId: 'JOB-1', category: 'MODEL_UNAVAILABLE' }],
    }),
  )
  apiMocks.useAuditQuery.mockReturnValue(queryResult([]))
  workspaceMock.mockReturnValue({
    user: tutor,
    programme,
    intakeYear: programme.year,
    programmes: [programme, otherProgramme],
    isLoading: false,
    error: undefined,
  })
  state.session.userId = tutor.id
  state.ui.navigationOpen = false
  state.ui.programmeByUser = {}
  state.ui.intakeByUser = {}
}
