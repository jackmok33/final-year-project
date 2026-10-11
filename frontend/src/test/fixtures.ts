import type {
  Application,
  AssessmentRun,
  Dataset,
  DocumentRecord,
  Programme,
  Rubric,
  User,
} from '../domain/types'

export const programme: Programme = {
  id: 'programme-1',
  name: 'Computer Science Example',
  code: 'DEMO-CS',
  year: '2026 / 27',
  department: 'Computer Science',
  description: 'Illustrative course.',
}
export const otherProgramme: Programme = {
  ...programme,
  id: 'programme-2',
  name: 'Data Science Example',
  code: 'DEMO-DS',
}
export const tutor: User = {
  id: 'tutor-a',
  name: 'Demo tutor',
  email: 'tutor@example.test',
  roles: ['tutor'],
  programmeIds: [programme.id, otherProgramme.id],
  canPublishCriteria: true,
  active: true,
}
export const administrator: User = {
  ...tutor,
  id: 'admin-a',
  name: 'Demo administrator',
  email: 'admin@example.test',
  roles: ['admin'],
  programmeIds: [],
  canPublishCriteria: false,
}
export const rubric: Rubric = {
  id: 'rubric-1',
  programmeId: programme.id,
  version: '1.0',
  createdAt: '2026-10-10T09:00:00Z',
  weights: { academic: 50, cv: 25, statement: 25 },
  rejectBelow: 60,
  offerFrom: 80,
  margin: 3,
  mandatoryRule: 'Relevant degree required',
}
export const documents: DocumentRecord[] = (['transcript', 'cv', 'statement'] as const).map(
  (type) => ({
    id: `APP-TEST-${type}`,
    applicationId: 'APP-TEST',
    type,
    name: `${type}.pdf`,
    pages: 4,
    size: 100,
    hash: 'a'.repeat(64),
  }),
)
export const run: AssessmentRun = {
  id: 'run-1',
  applicationId: 'APP-TEST',
  rubricId: rubric.id,
  startedAt: '2026-10-10T09:00:00Z',
  finishAt: '2026-10-10T09:00:02Z',
  status: 'awaiting review',
  overall: 88,
  recommendation: 'Offer',
  flags: [],
  extractedGrade: 74,
  simulated: true,
  sections: (['academic', 'cv', 'statement'] as const).map((key, i) => ({
    key,
    score: 88,
    explanation: `${key} evidence supported`,
    uncertainty: 'Moderate uncertainty',
    citations: [
      { documentId: documents[i].id, page: i === 0 ? 2 : 1, claim: 'Synthetic source claim' },
    ],
  })),
  justification: {
    summary: 'Strong synthetic evidence supports an offer.',
    rules: ['Above offer threshold.'],
    citations: [{ documentId: documents[0].id, page: 2, claim: 'Final average 74%.' }],
  },
}
export const application: Application = {
  id: 'APP-TEST',
  candidate: 'SYN-TEST',
  programmeId: programme.id,
  submittedAt: '2026-10-10T09:00:00Z',
  documentIds: documents.map((d) => d.id),
  fixture: 'offer',
  runs: [run],
  corrections: [],
  decisions: [],
}
export const detail = { application, documents, rubrics: [rubric] }
export const dataset: Dataset = {
  version: 2,
  users: [tutor, administrator],
  programmes: [programme, otherProgramme],
  rubrics: [rubric],
  activeRubricIds: { [programme.id]: rubric.id },
  applications: [application],
  documents,
  audit: [],
  modelAvailable: true,
}
