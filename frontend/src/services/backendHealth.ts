import { backendUrl } from './backend'

export interface BackendHealth {
  status: 'ok'
  mode: 'mock'
  service: 'ucl-application-review-api'
  database: 'not configured'
  inference: 'not configured'
}

export type BackendHealthReport = { checkedAt: string } & (
  | { state: 'available'; health: BackendHealth }
  | { state: 'unavailable'; error: string }
  | { state: 'not-configured' }
)

function isBackendHealth(value: unknown): value is BackendHealth {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const health = value as Record<string, unknown>
  return (
    health.status === 'ok' &&
    health.mode === 'mock' &&
    health.service === 'ucl-application-review-api' &&
    health.database === 'not configured' &&
    health.inference === 'not configured'
  )
}

/** Probe the public backend endpoint without accessing or locking browser records. */
export async function probeBackendHealth(signal?: AbortSignal): Promise<BackendHealthReport> {
  const base = backendUrl()
  const checkedAt = () => new Date().toISOString()
  if (!base) return { state: 'not-configured', checkedAt: checkedAt() }

  const timeout = AbortSignal.timeout(10_000)
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  try {
    const response = await fetch(`${base}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: requestSignal,
    })
    if (!response.ok) {
      return {
        state: 'unavailable',
        checkedAt: checkedAt(),
        error: `The backend health check returned HTTP ${response.status}.`,
      }
    }
    const health: unknown = await response.json()
    if (!isBackendHealth(health)) {
      return {
        state: 'unavailable',
        checkedAt: checkedAt(),
        error: 'The backend returned an invalid health response.',
      }
    }
    return { state: 'available', checkedAt: checkedAt(), health }
  } catch {
    return {
      state: 'unavailable',
      checkedAt: checkedAt(),
      error: signal?.aborted
        ? 'The health check was cancelled.'
        : timeout.aborted
          ? 'The backend health check timed out.'
          : 'Cannot reach the backend or read its health response.',
    }
  }
}
