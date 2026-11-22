import { describe, expect, it } from 'vitest'
import { application, documents, programme, rubric, tutor } from '../test/fixtures'
import { workspaceResponse } from './workspaceResponse'
export function responseFixture() {
  return structuredClone({
    version: 2,
    subject: tutor.id,
    users: [tutor],
    programmes: [programme],
    applications: [{ ...application, intakeYear: programme.year }],
    documents,
    rubrics: [rubric],
    activeRubricIds: { [programme.id]: rubric.id },
    batches: [],
    audit: [],
    modelAvailable: true,
  })
}
describe('workspace response validation', () => {
  it('requires English-test results to match their status and original report', () => {
    const value = responseFixture()
    const app = value.applications[0]
    const document = { ...value.documents[0], id: 'english', type: 'english_test' as const }
    app.documentIds.push(document.id)
    value.documents.push(document)
    const check = {
      id: 'job',
      documentId: document.id,
      page: 1,
      ruleVersion: 'ielts-academic-demo-v1',
      status: 'completed',
      error: null,
      result: {
        outcome: 'meets_requirement',
        reason: null,
        testType: 'IELTS Academic',
        testDate: null,
        overall: 7,
        listening: 7.5,
        reading: 7,
        writing: 6.5,
        speaking: 7,
      },
    }
    Object.assign(app, { englishTestCheck: check })
    expect(workspaceResponse(value).applications[0].englishTestCheck).toEqual(check)
    check.result.writing = 6.1
    expect(() => workspaceResponse(value)).toThrow('invalid workspace')
    check.result.writing = 6.5
    check.status = 'queued'
    expect(() => workspaceResponse(value)).toThrow('invalid workspace')
    check.status = 'completed'
    check.documentId = value.documents[0].id
    expect(() => workspaceResponse(value)).toThrow('inconsistent workspace')
  })
  it('accepts and preserves original histories and normalises nullable optional fields', () => {
    const value = responseFixture()
    Object.assign(value.applications[0].runs[0], { parentRunId: null, error: null })
    const result = workspaceResponse(value)
    expect(result.applications[0].runs[0].parentRunId).toBeUndefined()
    expect(result.documents).toEqual(documents)
  })
  it.each([null, [], {}, { version: 1 }])('rejects invalid envelope %j', (value) =>
    expect(() => workspaceResponse(value)).toThrow('invalid workspace'),
  )
  it.each(['users', 'programmes', 'applications', 'documents', 'rubrics', 'batches'] as const)(
    'rejects malformed %s',
    (key) => {
      const value = responseFixture()
      Object.assign(value, { [key]: [{}] })
      expect(() => workspaceResponse(value)).toThrow()
    },
  )
  it.each([
    (v: ReturnType<typeof responseFixture>) => {
      v.users[0].active = false
    },
    (v) => {
      v.subject = 'other'
    },
    (v) => {
      v.programmes[0].createdBy = 'other'
    },
    (v) => {
      v.programmes.push(v.programmes[0])
    },
    (v) => {
      v.rubrics.push(v.rubrics[0])
    },
    (v) => {
      v.activeRubricIds[programme.id] = 'missing'
    },
    (v) => {
      v.applications[0].documentIds.push('missing')
    },
    (v) => {
      v.documents[0].applicationId = 'missing'
    },
    (v) => {
      v.applications[0].runs[0].applicationId = 'other'
    },
    (v) => {
      v.applications[0].runs[0].sections[0].citations[0].page = 999
    },
    (v) => {
      v.applications[0].runs[0].rubricId = 'missing'
    },
    (v) => {
      v.applications[0].batchId = 'missing'
    },
    (v) => {
      v.documents[0].hash = 'bad'
    },
    (v) => {
      Object.assign(v.rubrics[0], { rejectBelow: null })
    },
    (v) => {
      Object.assign(v.rubrics[0].weights, { references: null })
    },
  ])('rejects malformed records and broken relationships %#', (edit) => {
    const value = responseFixture()
    edit(value)
    expect(() => workspaceResponse(value)).toThrow()
  })
})
