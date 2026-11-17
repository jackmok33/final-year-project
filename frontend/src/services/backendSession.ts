/** Only per-tab authentication lives here. Applicant data is always server-owned. */
interface BackendSession {
  userId: string
  token: string
}
const KEY = 'ucl-backend-auth'
let current: BackendSession | undefined

export function backendApiBase() {
  const base =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ||
    '/api/v1'
  if (base.startsWith('/') && !base.startsWith('//')) return base
  const url = new URL(base)
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
    throw new Error('The backend connection must use HTTPS or local loopback.')
  if (url.username || url.password || url.search || url.hash)
    throw new Error('Invalid backend connection URL.')
  return base
}

export function backendSession(): BackendSession | undefined {
  if (current) return current
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    if (
      value &&
      typeof value === 'object' &&
      'userId' in value &&
      typeof value.userId === 'string' &&
      'token' in value &&
      typeof value.token === 'string' &&
      /^[A-Za-z0-9_-]{32,256}$/.test(value.token)
    )
      current = { userId: value.userId, token: value.token }
  } catch {
    /* A blocked tab store still permits an in-memory sign-in. */
  }
  return current
}

export function saveBackendSession(userId: string, token: string) {
  current = { userId, token }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* Memory is sufficient. */
  }
}

export function clearBackendSession() {
  current = undefined
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* Ignore unavailable tab storage. */
  }
}

export async function backendRequest(
  path: string,
  init: RequestInit = {},
  token = backendSession()?.token,
) {
  if (!token) throw new Error('Sign in with your account access token.')
  const base = backendApiBase()
  let response: Response
  try {
    response = await fetch(base + path, {
      ...init,
      cache: 'no-store',
      credentials: 'omit',
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(360_000),
    })
  } catch {
    throw new Error('Cannot reach the application backend. Check the connection and retry.')
  }
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => undefined)
    const detail =
      error && typeof error === 'object' && 'detail' in error ? error.detail : undefined
    const message =
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof detail.message === 'string'
        ? detail.message
        : `The backend rejected the request (HTTP ${response.status}).`
    throw new Error(message)
  }
  return response
}
