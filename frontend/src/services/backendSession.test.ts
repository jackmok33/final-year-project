// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  backendApiBase,
  backendRequest,
  backendSession,
  saveBackendSession,
  clearBackendSession,
} from './backendSession'
beforeEach(() => {
  clearBackendSession()
  sessionStorage.clear()
  vi.stubEnv('VITE_API_BASE_URL', '')
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe('server transport and tab credentials', () => {
  it('keeps only credentials in tab storage and clears them on logout', () => {
    expect(backendSession()).toBeUndefined()
    sessionStorage.setItem(
      'ucl-backend-auth',
      JSON.stringify({ userId: 'u', token: 'a'.repeat(40) }),
    )
    expect(backendSession()?.userId).toBe('u')
    saveBackendSession('v', 'b'.repeat(40))
    expect(backendSession()?.userId).toBe('v')
    clearBackendSession()
    expect(backendSession()).toBeUndefined()
  })
  it.each(['bad', 'null', '[]', '{}', '{"userId":1,"token":"x"}'])(
    'rejects invalid stored credentials %s',
    (raw) => {
      sessionStorage.setItem('ucl-backend-auth', raw)
      expect(backendSession()).toBeUndefined()
    },
  )
  it('continues in memory if tab storage is blocked', () => {
    for (const key of ['getItem', 'setItem', 'removeItem'] as const)
      vi.spyOn(Storage.prototype, key).mockImplementation(() => {
        throw new Error('blocked')
      })
    expect(backendSession()).toBeUndefined()
    saveBackendSession('u', 'a'.repeat(40))
    expect(backendSession()?.userId).toBe('u')
    clearBackendSession()
    expect(backendSession()).toBeUndefined()
  })
  it.each([
    '/api/v1',
    'http://127.0.0.1:8000/api/v1',
    'http://localhost:8000/v1',
    'https://api.example/v1',
  ])('accepts safe endpoint %s', (url) => {
    vi.stubEnv('VITE_API_BASE_URL', url + '/')
    expect(backendApiBase()).toBe(url)
  })
  it.each([
    'http://remote.example/v1',
    'https://u:p@example/v1',
    'https://example/v1?token=x',
    'https://example/v1#x',
    'bad-url',
  ])('rejects unsafe endpoint %s', (url) => {
    vi.stubEnv('VITE_API_BASE_URL', url)
    expect(() => backendApiBase()).toThrow()
  })
  it('sends bearer authentication without cookies, cache or browser records', async () => {
    saveBackendSession('u', 'a'.repeat(40))
    vi.mocked(fetch).mockResolvedValue(Response.json({}))
    await backendRequest('/workspace', { method: 'GET' })
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/workspace',
      expect.objectContaining({
        credentials: 'omit',
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + 'a'.repeat(40) },
        signal: expect.any(AbortSignal),
      }),
    )
  })
  it('requires credentials and reports network/HTTP failures', async () => {
    await expect(backendRequest('/workspace')).rejects.toThrow('Sign in')
    vi.mocked(fetch).mockRejectedValue(new Error('secret'))
    await expect(backendRequest('/workspace', {}, 'token')).rejects.toThrow('Cannot reach')
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ detail: { message: 'Account inactive' } }, { status: 403 }),
    )
    await expect(backendRequest('/workspace', {}, 'token')).rejects.toThrow('Account inactive')
    vi.mocked(fetch).mockResolvedValue(new Response('not json', { status: 503 }))
    await expect(backendRequest('/workspace', {}, 'token')).rejects.toThrow('HTTP 503')
  })
})
