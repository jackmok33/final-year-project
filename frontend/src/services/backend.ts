import type { Application, AssessmentRun, DocumentRecord, Rubric } from '../domain/types'

export interface BackendHealth {
  status: 'ok'
  mode: 'mock'
  service: 'ucl-application-review-api'
  database: 'not configured'
  inference: 'not configured'
}

export function backendUrl() {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '')
}

async function request(path: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
  const base = backendUrl()
  if (!base) throw new Error('The mock backend URL is not configured.')
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    })
  } catch {
    throw new Error('Cannot reach the FastAPI mock backend. Check that it is running and retry.')
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(
      typeof error?.detail === 'string'
        ? error.detail
        : `The mock backend rejected the request (HTTP ${response.status}).`,
    )
  }
  return response.json().catch(() => {
    throw new Error('The mock backend returned invalid JSON.')
  })
}

export async function getBackendHealth(signal?: AbortSignal): Promise<BackendHealth> {
  const result = (await request('/health', undefined, signal)) as Partial<BackendHealth> | null
  if (
    result?.status !== 'ok' ||
    result.mode !== 'mock' ||
    result.service !== 'ucl-application-review-api' ||
    result.database !== 'not configured' ||
    result.inference !== 'not configured'
  )
    throw new Error('The backend did not return the expected mock service status.')
  return result as BackendHealth
}

/** Reject malformed or mismatched results before they enter persistent review history. */
function validateRun(value: unknown, app: Application, docs: DocumentRecord[], rubric: Rubric) {
  if (!value || typeof value !== 'object') throw new Error('Invalid mock assessment response.')
  const run = value as AssessmentRun
  // Python's optional fields are nullable; the existing browser dataset omits them.
  if (run.error == null) delete run.error
  if (run.parentRunId == null) delete run.parentRunId
  const score = (value: unknown) =>
    value === null ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100)
  const citations = (value: unknown) =>
    Array.isArray(value) &&
    value.every(
      (c) =>
        c &&
        typeof c.claim === 'string' &&
        Number.isInteger(c.page) &&
        c.page >= 1 &&
        docs.some((d) => d.id === c.documentId && c.page <= d.pages),
    )
  if (
    typeof run.id !== 'string' ||
    !run.id ||
    app.runs.some((previous) => previous.id === run.id) ||
    run.applicationId !== app.id ||
    run.rubricId !== rubric.id ||
    run.parentRunId !== app.runs.at(-1)?.id ||
    !['awaiting review', 'failed'].includes(run.status) ||
    !Number.isFinite(Date.parse(run.startedAt)) ||
    !Number.isFinite(Date.parse(run.finishAt)) ||
    Date.parse(run.finishAt) < Date.parse(run.startedAt) ||
    run.simulated !== true ||
    run.evaluationSource !== 'fastapi-mock' ||
    !['Offer', 'Reject', 'Further review'].includes(run.recommendation) ||
    !score(run.overall) ||
    !score(run.extractedGrade) ||
    (run.error !== undefined && typeof run.error !== 'string') ||
    !Array.isArray(run.sections) ||
    run.sections.length !== 3 ||
    !['academic', 'cv', 'statement'].every(
      (key) => run.sections.filter((s) => s?.key === key).length === 1,
    ) ||
    !run.sections.every(
      (s) =>
        score(s.score) &&
        typeof s.explanation === 'string' &&
        typeof s.uncertainty === 'string' &&
        citations(s.citations),
    ) ||
    !Array.isArray(run.flags) ||
    !run.flags.every(
      (f) =>
        f &&
        typeof f.code === 'string' &&
        typeof f.message === 'string' &&
        typeof f.critical === 'boolean',
    ) ||
    !run.justification ||
    typeof run.justification.summary !== 'string' ||
    !Array.isArray(run.justification.rules) ||
    !run.justification.rules.every((rule) => typeof rule === 'string') ||
    !citations(run.justification.citations) ||
    ((run.flags.some((f) => f.critical) ||
      run.sections.some((s) => s.score === null) ||
      run.status === 'failed') &&
      run.recommendation !== 'Further review') ||
    (run.sections.some((s) => s.score === null) && run.overall !== null)
  )
    throw new Error('The mock backend returned an invalid or mismatched assessment.')
  return run
}

export async function evaluateBackend(
  app: Application,
  docs: DocumentRecord[],
  rubric: Rubric,
  grade: number | null,
  modelAvailable: boolean,
): Promise<AssessmentRun> {
  const { id, version, weights, rejectBelow, offerFrom, margin, mandatoryRule } = rubric
  const response = await request('/mock/assessments', {
    applicationId: app.id,
    criteria: { id, version, weights, rejectBelow, offerFrom, margin, mandatoryRule },
    documents: docs.map(({ id, type, pages }) => ({ id, type, pages })),
    grade,
    modelAvailable,
    parentRunId: app.runs.at(-1)?.id ?? null,
  })
  return validateRun(response, app, docs, rubric)
}
