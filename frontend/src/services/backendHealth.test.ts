import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { probeBackendHealth } from './backendHealth'

const fetchMock = vi.fn<typeof fetch>()
const health = {
  status: 'ok',
  mode: 'mock',
  service: 'ucl-application-review-api',
  database: 'not configured',
  inference: 'not configured',
}
const checkedAt = '2026-11-01T12:00:00.000Z'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(checkedAt))
  vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8000/api/v1/')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('backend health probe', () => {
  it('checks the real health endpoint without sending applicant or browser data', async () => {
    fetchMock.mockResolvedValue(Response.json(health))
    expect(await probeBackendHealth()).toEqual({ state: 'available', health, checkedAt })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('http://127.0.0.1:8000/api/v1/health', {
      method: 'GET',
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })
  })

  it.each([undefined, '', '   '])(
    'does not make a request without a configured URL %j',
    async (url) => {
      vi.stubEnv('VITE_API_BASE_URL', url)
      expect(await probeBackendHealth()).toEqual({ state: 'not-configured', checkedAt })
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('reports HTTP failure without trusting its response body', async () => {
    fetchMock.mockResolvedValue(Response.json(health, { status: 503 }))
    expect(await probeBackendHealth()).toEqual({
      state: 'unavailable',
      checkedAt,
      error: 'The backend health check returned HTTP 503.',
    })
  })

  it.each([
    null,
    [],
    'ok',
    {},
    { ...health, status: 'error' },
    { ...health, mode: 'real' },
    { ...health, service: 'another-api' },
    { ...health, database: 'healthy' },
    { ...health, inference: 'healthy' },
  ])('rejects an incompatible health response %j', async (value) => {
    fetchMock.mockResolvedValue(Response.json(value))
    expect(await probeBackendHealth()).toEqual({
      state: 'unavailable',
      checkedAt,
      error: 'The backend returned an invalid health response.',
    })
  })

  it.each([new TypeError('Failed to fetch'), new SyntaxError('Invalid JSON')])(
    'reports a failed request or unreadable body without simulated fallback',
    async (error) => {
      fetchMock.mockRejectedValue(error)
      expect(await probeBackendHealth()).toEqual({
        state: 'unavailable',
        checkedAt,
        error: 'Cannot reach the backend or read its health response.',
      })
    },
  )

  it('reports invalid JSON from a successful response as unavailable', async () => {
    fetchMock.mockResolvedValue(new Response('not JSON'))
    expect(await probeBackendHealth()).toMatchObject({ state: 'unavailable' })
  })

  it('bounds the request and propagates cancellation from the query', async () => {
    const controller = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )
    const pending = probeBackendHealth(controller.signal)
    expect(timeout).toHaveBeenCalledWith(10_000)
    const signal = fetchMock.mock.calls[0][1]?.signal
    expect(signal?.aborted).toBe(false)
    controller.abort()
    expect(signal?.aborted).toBe(true)
    expect(await pending).toMatchObject({
      state: 'unavailable',
      error: 'The health check was cancelled.',
    })
  })

  it('reports timeout separately from an unreachable endpoint', async () => {
    const controller = new AbortController()
    controller.abort(new DOMException('timed out', 'TimeoutError'))
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
    fetchMock.mockRejectedValue(new Error('aborted'))
    expect(await probeBackendHealth()).toMatchObject({
      state: 'unavailable',
      error: 'The backend health check timed out.',
    })
  })
})
