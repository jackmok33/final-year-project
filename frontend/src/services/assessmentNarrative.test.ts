import { describe, expect, it } from 'vitest'
import type { Application, AssessmentRun, Rubric, SectionKey } from '../domain/types'
import { application, documents, rubric } from '../test/fixtures'
import { presentAssessment } from './assessmentNarrative'
import { simulateRun } from './seed'

function fixture(kind: Application['fixture'] = 'review') {
  const id =
    kind === 'offer'
      ? 'APP-2026-0143'
      : kind === 'reject'
        ? 'APP-2026-0144'
        : kind === 'missing'
          ? 'APP-2026-0145'
          : kind === 'failed'
            ? 'APP-2026-0146'
            : 'APP-2026-0142'
  const app = { ...structuredClone(application), id, fixture: kind, runs: [] }
  const sources = documents
    .map((doc) => ({ ...doc, applicationId: id, id: `${id}-${doc.type}` }))
    .filter((doc) => kind !== 'missing' || doc.type !== 'statement')
  const result = {
    ...simulateRun(app, sources, rubric, kind === 'review' ? 71 : 74, false),
    status: kind === 'failed' ? 'failed' : 'awaiting review',
  } as AssessmentRun
  const target: Application = { ...app, documentIds: sources.map((doc) => doc.id), runs: [result] }
  return { app: target, result, sources }
}

describe('presentAssessment', () => {
  it('expands existing mock text without changing the stored assessment or surrounding data', () => {
    const { app, result } = fixture()
    const before = structuredClone(app)
    const display = presentAssessment(app, result, rubric)
    expect(display).not.toBe(result)
    expect(app).toEqual(before)
    expect(display.justification.summary.startsWith(`${result.justification.summary}\n\n`)).toBe(
      true,
    )
    expect(display.justification.summary).toContain('academic: 84 / 100 at 50%')
    expect(display.justification.summary).toContain('overall score is 78.4 / 100')
    for (const section of display.sections) {
      expect(
        section.explanation.startsWith(
          `${result.sections.find((s) => s.key === section.key)!.explanation}\n\n`,
        ),
      ).toBe(true)
      expect(section.explanation.split('\n\n')).toHaveLength(3)
      expect(section.explanation).toContain('criteria v1.0')
    }
    const withoutText = (run: AssessmentRun) => ({
      ...run,
      sections: run.sections.map((section) => ({ ...section, explanation: '' })),
      justification: { ...run.justification, summary: '' },
    })
    expect(withoutText(display)).toEqual(withoutText(result))
  })
  it.each(['offer', 'review', 'reject'] as const)(
    'retains the %s outcome, scores and evidence concerns',
    (kind) => {
      const { app, result } = fixture(kind)
      const display = presentAssessment(app, result, rubric)
      expect(display.recommendation).toBe(result.recommendation)
      expect(display.overall).toBe(result.overall)
      expect(display.flags).toEqual(result.flags)
      expect(display.sections.map((section) => section.score)).toEqual(
        result.sections.map((section) => section.score),
      )
      expect(display.justification.rules).toEqual(result.justification.rules)
      expect(display.justification.citations).toEqual(result.justification.citations)
      if (kind === 'reject')
        expect(display.sections[0].explanation).toContain(
          'not be read as evidence of lower transcript marks or a failed degree',
        )
    },
  )
  it('keeps zero separate from a section score instead of substituting the fixture grade', () => {
    const { app, result } = fixture()
    result.extractedGrade = 0
    const display = presentAssessment(app, result, rubric)
    expect(display.sections[0].explanation).toContain('extracted final average is 0%')
    expect(display.extractedGrade).toBe(0)
  })
  it('leaves a missing section unavailable and does not invent an overall result', () => {
    const { app, result } = fixture('missing')
    const display = presentAssessment(app, result, rubric)
    expect(display.overall).toBeNull()
    expect(display.justification.summary).toContain('Missing evidence is not assigned a zero')
    expect(display.sections[2]).toBe(result.sections[2])
    expect(display.sections[2].score).toBeNull()
    expect(display.sections[2].explanation).toBe('The required source document is missing.')
  })
  it.each([null, 82])(
    'expands complete core findings while leaving zero-weight references unchanged (%s)',
    (referenceScore) => {
      const { app, sources } = fixture('offer')
      const criteria = { ...rubric, weights: { ...rubric.weights, references: 0 } }
      const result: AssessmentRun = {
        ...simulateRun(app, sources, criteria, 74, true),
        status: 'awaiting review',
      }
      app.runs.push(result)
      const reference = result.sections.find((section) => section.key === 'references')!
      reference.score = referenceScore
      const before = structuredClone(app)
      const display = presentAssessment(app, result, criteria)
      expect(display).not.toBe(result)
      expect(display.justification.summary).toContain('overall score is 88.5 / 100')
      expect(display.justification.summary).toContain('offer threshold of 80')
      expect(display.justification.summary).not.toContain('complete weighted result is unavailable')
      expect(display.justification.summary).not.toContain('references:')
      for (const section of display.sections.slice(0, 3))
        expect(section.explanation.split('\n\n')).toHaveLength(3)
      expect(display.sections.at(-1)).toBe(reference)
      expect(app).toEqual(before)
    },
  )
  it.each(['duplicate-reference', 'unknown-section', 'invalid-reference', 'weighted-reference'])(
    'does not expand inconsistent additional sections: %s',
    (condition) => {
      const { app, result } = fixture('offer')
      const reference = {
        ...result.sections[0],
        key: 'references' as const,
        score: condition === 'invalid-reference' ? Infinity : null,
      }
      result.sections.push(reference)
      let criteria: Rubric = { ...rubric, weights: { ...rubric.weights, references: 0 } }
      if (condition === 'duplicate-reference') result.sections.push({ ...reference })
      if (condition === 'unknown-section')
        result.sections.push({ ...reference, key: 'unknown' as SectionKey })
      if (condition === 'weighted-reference')
        criteria = { ...rubric, weights: { academic: 40, cv: 25, statement: 25, references: 10 } }
      expect(presentAssessment(app, result, criteria)).toBe(result)
    },
  )
  it.each(['upload', 'unknown', 'historic', 'failed', 'unavailable', 'wrong-application'] as const)(
    'does not add fixture explanations for %s records',
    (condition) => {
      const { app, result } = fixture()
      if (condition === 'upload') app.fixture = undefined
      if (condition === 'unknown') app.id = result.applicationId = 'UPLOADED-1'
      if (condition === 'historic') app.runs.push({ ...result, id: 'newer' })
      if (condition === 'failed') result.status = 'failed'
      if (condition === 'unavailable')
        result.flags.push({ code: 'BACKEND_UNAVAILABLE', message: 'Unavailable', critical: true })
      if (condition === 'wrong-application') result.applicationId = 'another-application'
      expect(presentAssessment(app, result, rubric)).toBe(result)
    },
  )
  it.each(['missing', 'wrong-id', 'wrong-programme', 'invalid'] as const)(
    'does not infer weights from %s criteria',
    (condition) => {
      const { app, result } = fixture()
      let criteria: Rubric | undefined = structuredClone(rubric)
      if (condition === 'missing') criteria = undefined
      else if (condition === 'wrong-id') criteria!.id = 'active-new-version'
      else if (condition === 'wrong-programme') criteria!.programmeId = 'other-programme'
      else criteria!.weights.academic = 900
      expect(presentAssessment(app, result, criteria)).toBe(result)
    },
  )
  it('uses the matching stored criteria instead of a later active version', () => {
    const { app, result } = fixture('offer')
    const oldCriteria = {
      ...rubric,
      version: '0.9',
      weights: { academic: 60, cv: 20, statement: 20 },
      offerFrom: 85,
    }
    result.overall = 88.8
    const display = presentAssessment(app, result, oldCriteria)
    expect(display.justification.summary).toContain('Criteria v0.9')
    expect(display.justification.summary).toContain('academic: 90 / 100 at 60%')
    expect(display.sections[0].explanation).toContain('contributes 54 points')
  })
  it.each([
    'wrong-total',
    'missing-section',
    'duplicate-section',
    'invalid-score',
    'partial-total',
  ])('does not explain inconsistent weighting for %s results', (condition) => {
    const { app, result } = fixture()
    if (condition === 'wrong-total') result.overall = 99
    if (condition === 'missing-section') result.sections.pop()
    if (condition === 'duplicate-section') result.sections[2] = result.sections[0]
    if (condition === 'invalid-score') result.sections[0].score = Infinity
    if (condition === 'partial-total') result.sections[0].score = null
    expect(presentAssessment(app, result, rubric)).toBe(result)
  })
  it('preserves custom or already expanded evaluator text and does not append twice', () => {
    const { app, result } = fixture()
    const display = presentAssessment(app, result, rubric)
    expect(presentAssessment(app, display, rubric)).toBe(display)
    const custom = {
      ...result,
      sections: result.sections.map((section) => ({
        ...section,
        explanation: 'A different evaluator supplied this explanation.',
      })),
      justification: {
        ...result.justification,
        summary: 'A different evaluator supplied this recommendation.',
      },
    }
    expect(presentAssessment(app, custom, rubric)).toBe(custom)
  })
  it('preserves the original FastAPI message as the first paragraph', () => {
    const { app, result } = fixture('offer')
    result.evaluationSource = 'fastapi-mock'
    result.justification.summary =
      'FastAPI mock assessment: Offer. Weighted score: 88.5. Criteria v1.0.'
    const display = presentAssessment(app, result, rubric)
    expect(display.justification.summary.split('\n\n')[0]).toBe(result.justification.summary)
    expect(display.evaluationSource).toBe('fastapi-mock')
    expect(display.sections[1].explanation).not.toContain('Vertex')
    expect(display.sections[1].explanation).not.toContain('Hospital')
    expect(display.sections[2].explanation).not.toContain('IELTS')
  })
})
