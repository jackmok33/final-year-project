import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { admissionsApi, errorMessage } from './api'
import { queryDemo, commandDemo } from '../services/demo'
import type { Query, Command } from '../services/demo'
import { application, detail, programme, rubric, tutor } from '../test/fixtures'
vi.mock('../services/demo', () => ({ queryDemo: vi.fn(), commandDemo: vi.fn() }))
const makeStore = () =>
  configureStore({
    reducer: {
      session: () => ({ userId: tutor.id }),
      [admissionsApi.reducerPath]: admissionsApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(admissionsApi.middleware),
  })
beforeEach(() => vi.resetAllMocks())
describe('RTK Query demo adapter', () => {
  it.each([
    ['accounts', undefined, { op: 'accounts' }, [tutor]],
    ['me', undefined, { op: 'me' }, tutor],
    [
      'batches',
      { programmeId: programme.id, intakeYear: programme.year },
      { op: 'batches', programmeId: programme.id, intakeYear: programme.year },
      [],
    ],
    ['batch', 'batch-1', { op: 'batch', id: 'batch-1' }, { id: 'batch-1' }],
    [
      'applications',
      programme.id,
      { op: 'applications', programmeId: programme.id },
      [application],
    ],
    ['application', application.id, { op: 'application', id: application.id }, detail],
    ['programmes', undefined, { op: 'programmes' }, [programme]],
    [
      'workspaceDeletion',
      programme.id,
      { op: 'workspaceDeletion', id: programme.id },
      { programme, applications: 0, documents: 0, criteriaVersions: 1 },
    ],
    [
      'rubrics',
      programme.id,
      { op: 'rubrics', programmeId: programme.id },
      { rubrics: [rubric], activeId: rubric.id },
    ],
    ['users', undefined, { op: 'users' }, [tutor]],
    [
      'health',
      undefined,
      { op: 'health' },
      { modelAvailable: false, failed: 1, queued: 0, logs: [] },
    ],
    ['audit', undefined, { op: 'audit' }, []],
  ] as const)('maps %s queries with the signed-in user', async (endpoint, arg, query, result) => {
    const store = makeStore()
    vi.mocked(queryDemo).mockResolvedValue(result)
    // Endpoint argument types differ; this table exercises each public endpoint.
    const request = store.dispatch(
      admissionsApi.endpoints[endpoint].initiate(arg as never) as ReturnType<
        typeof admissionsApi.endpoints.applications.initiate
      >,
    )
    expect(await request.unwrap()).toEqual(result)
    expect(queryDemo).toHaveBeenCalledWith(query as Query, tutor.id)
    expect(commandDemo).not.toHaveBeenCalled()
    request.unsubscribe()
    store.dispatch(admissionsApi.util.resetApiState())
  })
  it.each([
    'importBatch',
    'create',
    'evaluate',
    'correct',
    'decide',
    'rubric',
    'user',
    'programme',
    'workspace',
    'deleteWorkspace',
    'model',
    'delete',
    'backup',
    'restore',
    'reset',
  ])('routes %s to mutations', async (op) => {
    const store = makeStore()
    vi.mocked(commandDemo).mockResolvedValue({ id: 'created' })
    const args = { op, ...(op === 'programme' ? { programme } : {}) } as Command
    expect(await store.dispatch(admissionsApi.endpoints.command.initiate(args)).unwrap()).toEqual({
      id: 'created',
    })
    expect(commandDemo).toHaveBeenCalledWith(args, tutor.id)
    expect(queryDemo).not.toHaveBeenCalled()
    store.dispatch(admissionsApi.util.resetApiState())
  })
  it('converts service failures into typed errors', async () => {
    const store = makeStore()
    vi.mocked(queryDemo).mockRejectedValue(new Error('Storage unavailable'))
    await expect(store.dispatch(admissionsApi.endpoints.me.initiate()).unwrap()).rejects.toEqual({
      status: 'DEMO_ERROR',
      data: 'Storage unavailable',
    })
    vi.mocked(commandDemo).mockRejectedValue('unexpected')
    await expect(
      store.dispatch(admissionsApi.endpoints.command.initiate({ op: 'reset' })).unwrap(),
    ).rejects.toMatchObject({ data: 'The demo operation failed.' })
    store.dispatch(admissionsApi.util.resetApiState())
  })
  it('reuses cached queries and refetches active queries after a mutation', async () => {
    const store = makeStore()
    vi.mocked(queryDemo).mockResolvedValue([application])
    vi.mocked(commandDemo).mockResolvedValue({})
    const request = store.dispatch(admissionsApi.endpoints.applications.initiate(programme.id))
    await request.unwrap()
    await store
      .dispatch(admissionsApi.endpoints.applications.initiate(programme.id, { subscribe: false }))
      .unwrap()
    expect(queryDemo).toHaveBeenCalledTimes(1)
    await store
      .dispatch(admissionsApi.endpoints.command.initiate({ op: 'evaluate', id: application.id }))
      .unwrap()
    await vi.waitFor(() => expect(queryDemo).toHaveBeenCalledTimes(2))
    request.unsubscribe()
    store.dispatch(admissionsApi.util.resetApiState())
  })
})
describe('user-facing errors', () => {
  it.each([
    [new Error('PDF missing'), 'PDF missing'],
    [{ status: 'DEMO_ERROR', data: 'Access denied' }, 'Access denied'],
    ['The backup is damaged.', 'The backup is damaged.'],
    [null, 'The operation could not be completed.'],
    [{ data: 42 }, 'The operation could not be completed.'],
  ])('preserves a meaningful error message', (error, message) =>
    expect(errorMessage(error)).toBe(message),
  )
})
