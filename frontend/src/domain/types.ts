export type Outcome = 'Offer' | 'Reject' | 'Further review'
export type Workflow = 'queued' | 'running' | 'awaiting review' | 'completed' | 'failed'
export type DocumentType = 'transcript' | 'cv' | 'statement'
export type SectionKey = 'academic' | 'cv' | 'statement'
export interface User {
  id: string
  name: string
  email: string
  roles: ('tutor' | 'admin')[]
  /** Compatibility projection of courses owned by this tutor. */
  programmeIds: string[]
  canPublishCriteria: boolean
  active: boolean
}
export interface Programme {
  id: string
  name: string
  code: string
  year: string
  department: string
  description: string
  /** Sole owner; optional only for legacy records that had no assigned tutor. */
  createdBy?: string
}
export interface WorkspaceDeletionImpact {
  programme: Programme
  applications: number
  documents: number
  criteriaVersions: number
}
export interface Rubric {
  id: string
  programmeId: string
  version: string
  createdAt: string
  weights: Record<SectionKey, number>
  rejectBelow: number
  offerFrom: number
  margin: number
  mandatoryRule: string
}
export interface DocumentRecord {
  id: string
  applicationId: string
  type: DocumentType
  name: string
  size: number
  pages: number
  hash: string
}
export interface Citation {
  documentId: string
  page: number
  claim: string
}
export interface SectionScore {
  key: SectionKey
  score: number | null
  explanation: string
  uncertainty: string
  citations: Citation[]
}
export interface ReviewFlag {
  code: string
  message: string
  critical: boolean
}
export interface Justification {
  summary: string
  citations: Citation[]
  rules: string[]
}
export interface AssessmentRun {
  id: string
  applicationId: string
  rubricId: string
  startedAt: string
  finishAt: string
  status: Workflow
  sections: SectionScore[]
  overall: number | null
  recommendation: Outcome
  justification: Justification
  flags: ReviewFlag[]
  extractedGrade: number | null
  parentRunId?: string
  error?: string
  simulated: true
  evaluationSource?: 'fastapi-mock'
}
export interface Correction {
  id: string
  runId: string
  original: number | null
  value: number
  reason: string
  citation: Citation
  actor: string
  at: string
}

export function hasUnavailableAssessment(run: AssessmentRun): boolean {
  return run.flags.some((flag) => flag.code === 'BACKEND_UNAVAILABLE')
}
export interface Decision {
  id: string
  runId: string
  recommendation: Outcome
  outcome: Outcome
  reason: string
  actor: string
  at: string
}
export interface Application {
  id: string
  candidate: string
  programmeId: string
  intakeYear?: string
  batchId?: string
  submittedAt: string
  documentIds: string[]
  fixture?: 'review' | 'offer' | 'reject' | 'missing' | 'failed'
  runs: AssessmentRun[]
  corrections: Correction[]
  decisions: Decision[]
}
export interface AuditEvent {
  id: string
  at: string
  actor: string
  action: string
  target: string
}
export interface Dataset {
  version: 2
  users: User[]
  programmes: Programme[]
  rubrics: Rubric[]
  activeRubricIds: Record<string, string>
  applications: Application[]
  batches?: UploadBatch[]
  documents: DocumentRecord[]
  audit: AuditEvent[]
  modelAvailable: boolean
}
export interface UploadBatch {
  id: string
  programmeId: string
  intakeYear: string
  filename: string
  uploadedAt: string
  uploadedBy?: string
  source: 'zip' | 'existing'
}
export interface BatchSummary extends UploadBatch {
  sequence: number
  applicantCount: number
  pendingReviewCount: number
}
export interface DemoHealth {
  modelAvailable: boolean
  failed: number
  queued: number
  logs: { jobId: string; category: string }[]
}
export interface Backup {
  format: 'ucl-admissions-demo'
  version: 2
  createdAt: string
  dataset: Dataset
  files: { id: string; base64: string; hash: string }[]
}
export function latestRun(app: Application) {
  return app.runs.at(-1)
}
export function latestDecision(app: Application) {
  return app.decisions.at(-1)
}
export function currentDecision(app: Application) {
  const run = latestRun(app)
  const decision = latestDecision(app)
  return run && decision?.runId === run.id ? decision : undefined
}
export function applicationState(app: Application): Workflow | 'not evaluated' {
  const run = latestRun(app)
  const decision = latestDecision(app)
  return decision && decision.runId === run?.id && decision.outcome !== 'Further review'
    ? 'completed'
    : (run?.status ?? 'not evaluated')
}
