import type {
  Application,
  AssessmentRun,
  Citation,
  DocumentRecord,
  Justification,
  ReviewFlag,
  Rubric,
  SectionScore,
} from '../domain/types'

export function backendUrl() {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '')
}

async function requestAssessment(body: unknown): Promise<unknown> {
  const base = backendUrl()
  if (!base) throw new Error('The mock backend URL is not configured.')
  let response: Response
  try {
    response = await fetch(`${base}/mock/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
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

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isScore(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100)
  )
}

function hasValidCitations(value: unknown, documents: DocumentRecord[]): value is Citation[] {
  return (
    Array.isArray(value) &&
    value.every((citation) => {
      if (
        !isObject(citation) ||
        typeof citation.claim !== 'string' ||
        typeof citation.page !== 'number' ||
        !Number.isInteger(citation.page) ||
        citation.page < 1
      )
        return false
      const page = citation.page
      return documents.some(
        (document) => document.id === citation.documentId && page <= document.pages,
      )
    })
  )
}

function hasValidSections(value: unknown, documents: DocumentRecord[]): value is SectionScore[] {
  if (!Array.isArray(value) || value.length !== 3) return false
  const sectionsAreComplete = ['academic', 'cv', 'statement'].every(
    (key) => value.filter((section) => isObject(section) && section.key === key).length === 1,
  )
  return (
    sectionsAreComplete &&
    value.every(
      (section) =>
        isObject(section) &&
        isScore(section.score) &&
        typeof section.explanation === 'string' &&
        typeof section.uncertainty === 'string' &&
        hasValidCitations(section.citations, documents),
    )
  )
}

function hasValidFlags(value: unknown): value is ReviewFlag[] {
  return (
    Array.isArray(value) &&
    value.every(
      (flag) =>
        isObject(flag) &&
        typeof flag.code === 'string' &&
        typeof flag.message === 'string' &&
        typeof flag.critical === 'boolean',
    )
  )
}

function hasValidJustification(
  value: unknown,
  documents: DocumentRecord[],
): value is Justification {
  return (
    isObject(value) &&
    typeof value.summary === 'string' &&
    Array.isArray(value.rules) &&
    value.rules.every((rule) => typeof rule === 'string') &&
    hasValidCitations(value.citations, documents)
  )
}

function matchesAssessmentContext(run: JsonObject, app: Application, rubric: Rubric): boolean {
  return (
    typeof run.id === 'string' &&
    run.id.length > 0 &&
    !app.runs.some((previous) => previous.id === run.id) &&
    run.applicationId === app.id &&
    run.rubricId === rubric.id &&
    run.parentRunId === app.runs.at(-1)?.id &&
    run.simulated === true &&
    run.evaluationSource === 'fastapi-mock'
  )
}

function hasValidTiming(run: JsonObject): boolean {
  if (typeof run.startedAt !== 'string' || typeof run.finishAt !== 'string') return false
  const startedAt = Date.parse(run.startedAt)
  const finishedAt = Date.parse(run.finishAt)
  return Number.isFinite(startedAt) && Number.isFinite(finishedAt) && finishedAt >= startedAt
}

function isValidRun(
  value: JsonObject,
  app: Application,
  documents: DocumentRecord[],
  rubric: Rubric,
): value is JsonObject & AssessmentRun {
  if (
    !matchesAssessmentContext(value, app, rubric) ||
    !hasValidTiming(value) ||
    typeof value.status !== 'string' ||
    !['awaiting review', 'failed'].includes(value.status) ||
    typeof value.recommendation !== 'string' ||
    !['Offer', 'Reject', 'Further review'].includes(value.recommendation) ||
    !isScore(value.overall) ||
    !isScore(value.extractedGrade) ||
    (value.error !== undefined && typeof value.error !== 'string') ||
    !hasValidSections(value.sections, documents) ||
    !hasValidFlags(value.flags) ||
    !hasValidJustification(value.justification, documents)
  )
    return false

  const missingScore = value.sections.some((section) => section.score === null)
  const requiresReview =
    value.flags.some((flag) => flag.critical) || missingScore || value.status === 'failed'
  return (
    (!requiresReview || value.recommendation === 'Further review') &&
    (!missingScore || value.overall === null)
  )
}

/** Validate and normalise transport data before it enters persistent review history. */
function validateRun(
  value: unknown,
  app: Application,
  documents: DocumentRecord[],
  rubric: Rubric,
) {
  if (!isObject(value)) throw new Error('Invalid mock assessment response.')
  const run = { ...value }
  // Python sends null optional fields; browser records omit them. Keep the input unchanged.
  if (run.error == null) delete run.error
  if (run.parentRunId == null) delete run.parentRunId
  if (!isValidRun(run, app, documents, rubric))
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
  const response = await requestAssessment({
    applicationId: app.id,
    criteria: { id, version, weights, rejectBelow, offerFrom, margin, mandatoryRule },
    documents: docs.map(({ id, type, pages }) => ({ id, type, pages })),
    grade,
    modelAvailable,
    parentRunId: app.runs.at(-1)?.id ?? null,
  })
  return validateRun(response, app, docs, rubric)
}
