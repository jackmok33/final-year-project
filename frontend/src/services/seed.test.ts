import { describe, expect, it } from 'vitest'
import { simulateRun } from './seed'
import { application, documents, rubric, run } from '../test/fixtures'
describe('honest synthetic assessment fixtures', () => {
  it.each(['offer', 'reject', 'review'] as const)(
    'makes the %s fixture traceable to its rubric and source pages',
    (fixture) => {
      const result = simulateRun({ ...application, fixture }, documents, rubric, 74, true)
      expect(result.rubricId).toBe(rubric.id)
      expect(result.parentRunId).toBe(run.id)
      expect(result.status).toBe('queued')
      expect(result.justification.citations).toHaveLength(3)
      expect(result.justification.citations[0].page).toBe(2)
      expect(result.overall).not.toBeNull()
      expect(result.recommendation).toBe(
        fixture === 'offer' ? 'Offer' : fixture === 'reject' ? 'Reject' : 'Further review',
      )
    },
  )
  it('never fabricates scores/citations for user uploads or unsupported correction values', () => {
    for (const app of [{ ...application, fixture: undefined }, application]) {
      const result = simulateRun(app, documents, rubric, 79, true)
      expect(result.overall).toBeNull()
      expect(result.sections.every((s) => s.score === null && !s.citations.length)).toBe(true)
      expect(result.flags).toContainEqual(
        expect.objectContaining({ code: 'BACKEND_UNAVAILABLE', critical: true }),
      )
      expect(result.recommendation).toBe('Further review')
    }
  })
  it('preserves a grade mismatch as an unresolved concern even for a high score', () => {
    const result = simulateRun(
      { ...application, fixture: 'review' },
      documents,
      { ...rubric, offerFrom: 95 },
      71,
      true,
    )
    expect(result.flags).toContainEqual(expect.objectContaining({ code: 'GRADE_MISMATCH' }))
    expect(result.justification.summary).toContain('cannot resolve this critical contradiction')
    expect(result.recommendation).toBe('Further review')
  })
  it('withholds the overall score if required evidence is missing', () => {
    const result = simulateRun(
      { ...application, fixture: 'missing' },
      documents.slice(0, 2),
      rubric,
      74,
      true,
    )
    expect(result.overall).toBeNull()
    expect(result.sections[2].score).toBeNull()
    expect(result.justification.summary).toContain('required document is missing')
    expect(result.flags).toContainEqual(expect.objectContaining({ code: 'MISSING_DOCUMENT' }))
  })
  it('supports simulated service recovery without treating the failed run as successful', () => {
    const failed = simulateRun({ ...application, fixture: 'failed' }, documents, rubric, 74, false)
    expect(failed.error).toBe('MODEL_UNAVAILABLE')
    expect(failed.overall).toBeNull()
    const recovered = simulateRun(
      { ...application, fixture: 'failed' },
      documents,
      rubric,
      74,
      true,
    )
    expect(recovered.error).toBeUndefined()
    expect(recovered.overall).not.toBeNull()
  })
})
