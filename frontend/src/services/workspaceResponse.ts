import type { Dataset } from '../domain/types'
import { documentTypes, englishBandKeys, sectionKeys, tutorOutcomes } from '../domain/types'

type RecordValue = Record<string, unknown>
function object(value: unknown): value is RecordValue {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function text(value: unknown): value is string {
  return typeof value === 'string'
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text)
}
function array(value: unknown, check: (item: RecordValue) => boolean): boolean {
  return Array.isArray(value) && value.every((item) => object(item) && check(item))
}
const timestamp = (value: unknown) => text(value) && Number.isFinite(Date.parse(value))
const numericScore = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
const score = (value: unknown) => value === null || numericScore(value)
const citation = (value: RecordValue) =>
  text(value.documentId) &&
  Number.isInteger(value.page) &&
  Number(value.page) >= 1 &&
  text(value.claim)

const oneOf = (value: unknown, options: string[]) => text(value) && options.includes(value)
function englishTestCheck(value: unknown): boolean {
  if (
    !object(value) ||
    !text(value.id) ||
    !text(value.documentId) ||
    value.page !== 1 ||
    !text(value.ruleVersion)
  )
    return false
  const result = value.result
  if (value.status === 'failed')
    return (
      result === null &&
      oneOf(value.error, [
        'interrupted',
        'unavailable',
        'timeout',
        'source_unavailable',
        'processing_error',
      ])
    )
  if (value.error !== null) return false
  if (value.status === 'queued' || value.status === 'running') return result === null
  if (value.status !== 'completed' || !object(result)) return false
  if (
    !englishBandKeys.every((key) => {
      const band = result[key]
      return (
        band === null ||
        (numericScore(band) && Number(band) <= 9 && Number.isInteger(Number(band) * 2))
      )
    }) ||
    (result.testType !== null && result.testType !== 'IELTS Academic') ||
    (result.testDate !== null &&
      (!text(result.testDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(result.testDate) ||
        !timestamp(result.testDate)))
  )
    return false
  if (result.outcome === 'needs_review')
    return oneOf(result.reason, [
      'unsupported_report',
      'unreadable_report',
      'invalid_output',
      'missing_bands',
      'inconsistent_bands',
    ])
  return (
    oneOf(result.outcome, ['meets_requirement', 'below_requirement']) &&
    result.reason === null &&
    result.testType === 'IELTS Academic' &&
    englishBandKeys.every((key) => result[key] !== null)
  )
}

function run(value: RecordValue): boolean {
  return (
    text(value.id) &&
    text(value.applicationId) &&
    text(value.rubricId) &&
    timestamp(value.startedAt) &&
    timestamp(value.finishAt) &&
    ['queued', 'running', 'awaiting review', 'completed', 'failed'].includes(
      String(value.status),
    ) &&
    (value.simulated === true ||
      (value.simulated === false && value.evaluationSource === 'qwen-langgraph')) &&
    score(value.overall) &&
    score(value.extractedGrade) &&
    [...tutorOutcomes, 'Offer', 'Further review'].includes(value.recommendation as never) &&
    array(
      value.sections,
      (section) =>
        sectionKeys.includes(section.key as never) &&
        score(section.score) &&
        text(section.explanation) &&
        text(section.uncertainty) &&
        array(section.citations, citation),
    ) &&
    array(
      value.flags,
      (flag) => text(flag.code) && text(flag.message) && typeof flag.critical === 'boolean',
    ) &&
    object(value.justification) &&
    text(value.justification.summary) &&
    strings(value.justification.rules) &&
    array(value.justification.citations, citation)
  )
}

/** Validate the server envelope before any values reach Redux or screen code. */
export function workspaceResponse(value: unknown): Dataset & { subject: string } {
  if (
    !object(value) ||
    value.version !== 2 ||
    !text(value.subject) ||
    typeof value.modelAvailable !== 'boolean' ||
    !object(value.activeRubricIds) ||
    !Object.values(value.activeRubricIds).every(text) ||
    !array(
      value.users,
      (u) =>
        text(u.id) &&
        text(u.name) &&
        text(u.email) &&
        typeof u.active === 'boolean' &&
        typeof u.canPublishCriteria === 'boolean' &&
        strings(u.programmeIds) &&
        strings(u.roles) &&
        u.roles.every((r) => ['admin', 'tutor'].includes(r)),
    ) ||
    !array(value.programmes, (p) =>
      ['id', 'name', 'code', 'year', 'department', 'description', 'createdBy'].every((key) =>
        text(p[key]),
      ),
    ) ||
    !array(
      value.rubrics,
      (r) =>
        text(r.id) &&
        text(r.programmeId) &&
        text(r.version) &&
        timestamp(r.createdAt) &&
        object(r.weights) &&
        ['academic', 'cv', 'statement'].every(
          (key) =>
            typeof (r.weights as RecordValue)[key] === 'number' &&
            score((r.weights as RecordValue)[key]),
        ) &&
        Object.values(r.weights).every(numericScore) &&
        numericScore(r.rejectBelow) &&
        numericScore(r.offerFrom) &&
        numericScore(r.margin) &&
        text(r.mandatoryRule),
    ) ||
    !array(
      value.documents,
      (d) =>
        text(d.id) &&
        text(d.applicationId) &&
        documentTypes.includes(d.type as never) &&
        text(d.name) &&
        typeof d.size === 'number' &&
        d.size > 0 &&
        d.size <= 20 * 1024 * 1024 &&
        Number.isInteger(d.pages) &&
        Number(d.pages) >= 1 &&
        Number(d.pages) <= 100 &&
        text(d.hash) &&
        /^[a-f0-9]{64}$/.test(d.hash),
    ) ||
    !array(
      value.applications,
      (a) =>
        text(a.id) &&
        text(a.candidate) &&
        text(a.programmeId) &&
        text(a.intakeYear) &&
        (a.batchId === undefined || text(a.batchId)) &&
        timestamp(a.submittedAt) &&
        strings(a.documentIds) &&
        (a.englishTestCheck == null || englishTestCheck(a.englishTestCheck)) &&
        array(a.runs, run) &&
        array(
          a.corrections,
          (c) =>
            text(c.id) &&
            text(c.runId) &&
            score(c.original) &&
            numericScore(c.value) &&
            text(c.reason) &&
            text(c.actor) &&
            timestamp(c.at) &&
            object(c.citation) &&
            citation(c.citation),
        ) &&
        array(
          a.decisions,
          (d) =>
            text(d.id) &&
            text(d.runId) &&
            text(d.outcome) &&
            text(d.recommendation) &&
            text(d.reason) &&
            text(d.actor) &&
            timestamp(d.at),
        ),
    ) ||
    !array(
      value.batches,
      (b) =>
        text(b.id) &&
        text(b.programmeId) &&
        text(b.intakeYear) &&
        text(b.filename) &&
        ['zip', 'existing'].includes(String(b.source)) &&
        timestamp(b.uploadedAt),
    ) ||
    !Array.isArray(value.audit)
  )
    throw new Error('The backend returned an invalid workspace response.')
  const data = value as unknown as Dataset & { subject: string }
  const user = data.users.find((u) => u.id === data.subject && u.active)
  if (!user) throw new Error('The backend account is unavailable.')
  const programmes = new Set(data.programmes.map((p) => p.id))
  const apps = new Map(data.applications.map((a) => [a.id, a]))
  const docs = new Map(data.documents.map((d) => [d.id, d]))
  const rubrics = new Map(data.rubrics.map((r) => [r.id, r]))
  const batches = new Map(data.batches?.map((b) => [b.id, b]))
  const validCitation = (appId: string, ref: { documentId: string; page: number }) => {
    const doc = docs.get(ref.documentId)
    return doc?.applicationId === appId && ref.page <= doc.pages
  }
  if (
    new Set(data.users.map((u) => u.id)).size !== data.users.length ||
    rubrics.size !== data.rubrics.length ||
    batches.size !== data.batches?.length ||
    Object.entries(data.activeRubricIds).some(
      ([id, rubric]) => rubrics.get(rubric)?.programmeId !== id,
    ) ||
    programmes.size !== data.programmes.length ||
    apps.size !== data.applications.length ||
    docs.size !== data.documents.length ||
    data.programmes.some((p) => p.createdBy !== user.id || !user.roles.includes('tutor')) ||
    data.applications.some(
      (a) =>
        !programmes.has(a.programmeId) ||
        new Set(a.documentIds).size !== a.documentIds.length ||
        (a.englishTestCheck != null &&
          (!validCitation(a.id, a.englishTestCheck) ||
            docs.get(a.englishTestCheck.documentId)?.type !== 'english_test')) ||
        (a.batchId !== undefined &&
          (batches.get(a.batchId)?.programmeId !== a.programmeId ||
            batches.get(a.batchId)?.intakeYear !== a.intakeYear)) ||
        a.runs.some(
          (r) =>
            r.applicationId !== a.id ||
            rubrics.get(r.rubricId)?.programmeId !== a.programmeId ||
            r.sections.some((s) => s.citations.some((c) => !validCitation(a.id, c))) ||
            r.justification.citations.some((c) => !validCitation(a.id, c)),
        ) ||
        a.corrections.some(
          (c) => !a.runs.some((r) => r.id === c.runId) || !validCitation(a.id, c.citation),
        ) ||
        a.decisions.some((d) => !a.runs.some((r) => r.id === d.runId)) ||
        a.documentIds.some((id) => docs.get(id)?.applicationId !== a.id),
    ) ||
    data.documents.some((d) => !apps.get(d.applicationId)?.documentIds.includes(d.id)) ||
    data.rubrics.some((r) => !programmes.has(r.programmeId)) ||
    data.batches?.some((b) => !programmes.has(b.programmeId))
  )
    throw new Error('The backend returned inconsistent workspace relationships.')
  for (const application of data.applications)
    for (const assessment of application.runs) {
      if (assessment.parentRunId === null) delete assessment.parentRunId
      if (assessment.error === null) delete assessment.error
    }
  return data
}
