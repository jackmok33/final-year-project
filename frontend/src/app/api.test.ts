import { configureStore } from '@reduxjs/toolkit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Command, Query, QueryResult } from '../services/contracts'
import { admissionsService } from '../services/admissions'
import { probeBackendHealth, type BackendHealthReport } from '../services/backendHealth'
import { application, detail, programme, rubric, tutor } from '../test/fixtures'
import { admissionsApi } from './api'
vi.mock('../services/admissions', () => ({
  admissionsService: { query: vi.fn(), command: vi.fn(), originalDocument: vi.fn() },
}))
vi.mock('../services/backendHealth', () => ({ probeBackendHealth: vi.fn() }))
const makeStore = () =>
  configureStore({
    reducer: {
      session: () => ({ userId: tutor.id }),
      [admissionsApi.reducerPath]: admissionsApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(admissionsApi.middleware),
  })
beforeEach(() => vi.resetAllMocks())
type QueryCase = [
  endpoint: keyof Omit<typeof admissionsApi.endpoints, 'command' | 'backendHealth'>,
  arg: string | { programmeId: string; intakeYear: string } | undefined,
  query: Query,
  result: QueryResult,
]

describe('RTK Query service adapter', () => {
  it.each<BackendHealthReport>([
    { state: 'not-configured', checkedAt: '2026-11-01T12:00:00Z' },
    { state: 'unavailable', error: 'HTTP 503', checkedAt: '2026-11-01T12:00:00Z' },
    {
      state: 'available',
      checkedAt: '2026-11-01T12:00:00Z',
      health: {
        status: 'ok',
        mode: 'mock',
        service: 'ucl-application-review-api',
        database: 'not configured',
        inference: 'not configured',
      },
    },
  ])('probes backend status outside the browser dataset lock: $state', async (report) => {
    const store = makeStore()
    vi.mocked(probeBackendHealth).mockResolvedValue(report)
    const request = store.dispatch(admissionsApi.endpoints.backendHealth.initiate())
    expect(await request.unwrap()).toEqual(report)
    expect(probeBackendHealth).toHaveBeenCalledExactlyOnceWith(expect.any(AbortSignal))
    expect(admissionsService.query).not.toHaveBeenCalled()
    expect(admissionsService.command).not.toHaveBeenCalled()
    request.unsubscribe()
    store.dispatch(admissionsApi.util.resetApiState())
  })

  it('passes RTK Query cancellation to the backend health request', async () => {
    const store = makeStore()
    vi.mocked(probeBackendHealth).mockImplementation(
      (signal) =>
        new Promise((resolve) => {
          signal?.addEventListener('abort', () => {
            resolve({ state: 'unavailable', checkedAt: '', error: 'cancelled' })
          })
        }),
    )
    const request = store.dispatch(admissionsApi.endpoints.backendHealth.initiate())
    const signal = vi.mocked(probeBackendHealth).mock.calls[0][0]
    request.abort()
    expect(signal?.aborted).toBe(true)
    await expect(request.unwrap()).rejects.toMatchObject({ name: 'AbortError' })
    request.unsubscribe()
    store.dispatch(admissionsApi.util.resetApiState())
  })

  it.each<QueryCase>([
    ['accounts', undefined, { op: 'accounts' }, [tutor]],
    ['me', undefined, { op: 'me' }, tutor],
    [
      'batches',
      { programmeId: programme.id, intakeYear: programme.year },
      { op: 'batches', programmeId: programme.id, intakeYear: programme.year },
      [],
    ],
    [
      'batch',
      'batch-1',
      { op: 'batch', id: 'batch-1' },
      {
        id: 'batch-1',
        programmeId: programme.id,
        intakeYear: programme.year,
        filename: 'Applications.zip',
        uploadedAt: '2026-10-29T10:00:00Z',
        uploadedBy: tutor.id,
        source: 'zip',
        sequence: 1,
        applicantCount: 0,
        pendingReviewCount: 0,
      },
    ],
    [
      'applications',
      programme.id,
      { op: 'applications', programmeId: programme.id },
      [application],
    ],
    ['application', application.id, { op: 'application', id: application.id }, detail],
    ['programmes', undefined, { op: 'programmes' }, [programme]],
    [
      'programmeIntakes',
      undefined,
      { op: 'programmeIntakes' },
      [{ programmeId: programme.id, years: [programme.year] }],
    ],
    [
      'rubrics',
      programme.id,
      { op: 'rubrics', programmeId: programme.id },
      { rubrics: [rubric], activeId: rubric.id },
    ],
    ['users', undefined, { op: 'users' }, [tutor]],
  ])('maps %s queries with the signed-in user', async (endpoint, arg, query, result) => {
    const store = makeStore()
    vi.mocked(admissionsService.query).mockResolvedValue(result)
    // Endpoint argument types differ; this table exercises each public endpoint.
    const request = store.dispatch(
      admissionsApi.endpoints[endpoint].initiate(arg as never) as ReturnType<
        typeof admissionsApi.endpoints.applications.initiate
      >,
    )
    expect(await request.unwrap()).toEqual(result)
    expect(admissionsService.query).toHaveBeenCalledWith(query, tutor.id)
    expect(admissionsService.command).not.toHaveBeenCalled()
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
    'workspace',
    'deleteApplicant',
  ])('routes %s to mutations', async (op) => {
    const store = makeStore()
    vi.mocked(admissionsService.command).mockResolvedValue({ id: 'created' })
    const args = { op } as Command
    expect(await store.dispatch(admissionsApi.endpoints.command.initiate(args)).unwrap()).toEqual({
      id: 'created',
    })
    expect(admissionsService.command).toHaveBeenCalledWith(args, tutor.id)
    expect(admissionsService.query).not.toHaveBeenCalled()
    store.dispatch(admissionsApi.util.resetApiState())
  })
  it('converts service failures into typed errors', async () => {
    const store = makeStore()
    vi.mocked(admissionsService.query).mockRejectedValue(new Error('Storage unavailable'))
    await expect(store.dispatch(admissionsApi.endpoints.me.initiate()).unwrap()).rejects.toEqual({
      status: 'DEMO_ERROR',
      data: 'Storage unavailable',
    })
    vi.mocked(admissionsService.command).mockRejectedValue('unexpected')
    await expect(
      store
        .dispatch(admissionsApi.endpoints.command.initiate({ op: 'evaluate', id: application.id }))
        .unwrap(),
    ).rejects.toMatchObject({ data: 'unexpected' })
    store.dispatch(admissionsApi.util.resetApiState())
  })
  it('reuses cached queries and refetches active queries after a mutation', async () => {
    const store = makeStore()
    vi.mocked(admissionsService.query).mockResolvedValue([application])
    vi.mocked(admissionsService.command).mockResolvedValue({})
    const request = store.dispatch(admissionsApi.endpoints.applications.initiate(programme.id))
    await request.unwrap()
    await store
      .dispatch(admissionsApi.endpoints.applications.initiate(programme.id, { subscribe: false }))
      .unwrap()
    expect(admissionsService.query).toHaveBeenCalledTimes(1)
    await store
      .dispatch(admissionsApi.endpoints.command.initiate({ op: 'evaluate', id: application.id }))
      .unwrap()
    await vi.waitFor(() => expect(admissionsService.query).toHaveBeenCalledTimes(2))
    request.unsubscribe()
    store.dispatch(admissionsApi.util.resetApiState())
  })
})
