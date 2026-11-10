import { describe, expect, it } from 'vitest'
import { application, run } from '../test/fixtures'
import {
  aiRecommendation,
  applicantReadiness,
  assessmentScore,
  decisionOutcome,
  finalDecision,
  latestDecision,
  latestRun,
  coreDocumentTypes,
  documentTypes,
  type Outcome,
} from './types'
describe('new programme and applicant presentation', () => {
  it('distinguishes final decisions from old review records and hides unfinished scores', () => {
    const decision = {
      id: 'd',
      runId: run.id,
      recommendation: run.recommendation,
      outcome: 'Conditional' as const,
      actor: 'tutor-a',
      at: run.finishAt,
      reason: '',
    }
    expect(finalDecision({ ...application, decisions: [decision] })?.outcome).toBe('Conditional')
    expect(
      finalDecision({ ...application, decisions: [{ ...decision, outcome: 'Further review' }] }),
    ).toBeUndefined()
    expect(
      finalDecision({ ...application, decisions: [{ ...decision, runId: 'old' }] }),
    ).toBeUndefined()
    expect(
      assessmentScore({ ...application, runs: [{ ...run, status: 'queued', overall: 99 }] }),
    ).toBeNull()
    expect(assessmentScore({ ...application, runs: [{ ...run, overall: 0 }] })).toBe(0)
  })
})
describe('Existing module behaviour', () => {
  const decision = {
    id: 'decision',
    runId: run.id,
    recommendation: run.recommendation,
    outcome: 'Unconditional' as const,
    reason: '',
    actor: 'tutor-a',
    at: run.startedAt,
  }

  describe('assessment and decision helpers', () => {
    it('handles applications without evaluations or decisions', () => {
      const empty = { ...application, runs: [], decisions: [] }
      expect(latestRun(empty)).toBeUndefined()
      expect(latestDecision(empty)).toBeUndefined()
    })
    it('returns the last run and decision without mutating history', () => {
      const latest = { ...run, id: 'run-2', status: 'running' as const }
      const app = { ...application, runs: [run, latest], decisions: [decision] }
      expect(latestRun(app)).toBe(latest)
      expect(latestDecision(app)).toBe(decision)
      expect(app.runs).toHaveLength(2)
    })
    it.each(['Offer', 'Further review'] as const)(
      'keeps a legacy %s decision intact while awaiting one of the three current outcomes',
      (outcome) => {
        const app = { ...application, decisions: [{ ...decision, outcome }] }
        const original = structuredClone(app)
        expect(decisionOutcome(outcome)).toBe('Pending')
        expect(finalDecision(app)).toBeUndefined()
        expect(app).toEqual(original)
      },
    )
    it('uses Pending only when a current typed decision is absent', () => {
      expect(decisionOutcome(undefined)).toBe('Pending')
      expect(decisionOutcome('Unconditional')).toBe('Unconditional')
      expect(decisionOutcome('Conditional')).toBe('Conditional')
      expect(decisionOutcome('Reject')).toBe('Reject')
    })
    it.each([
      ['Unconditional', 'Unconditional'],
      ['Conditional', 'Conditional'],
      ['Reject', 'Reject'],
      ['Offer', 'Unconditional'],
      ['Further review', 'Conditional'],
    ] as const)(
      'presents AI %s as %s without rewriting its source result',
      (recommendation, displayed) => {
        const source = { ...run, recommendation: recommendation as Outcome }
        const original = structuredClone(source)
        expect(aiRecommendation(source)).toBe(displayed)
        expect(source).toEqual(original)
      },
    )
    it.each(['queued', 'running', 'failed'] as const)(
      'withholds an AI outcome for a %s run',
      (status) => {
        expect(aiRecommendation({ ...run, status })).toBeUndefined()
      },
    )
    it('withholds AI outcomes for new uploads and unavailable assessments', () => {
      expect(aiRecommendation(undefined)).toBeUndefined()
      expect(
        aiRecommendation({
          ...run,
          flags: [{ code: 'BACKEND_UNAVAILABLE', message: 'Unavailable', critical: true }],
        }),
      ).toBeUndefined()
    })
  })
})

describe('applicant document readiness', () => {
  it('requires all six categories and at least one reference, without counting duplicates as other types', () => {
    expect(applicantReadiness(documentTypes)).toBe('ready')
    expect(applicantReadiness([...documentTypes, 'reference', 'reference'])).toBe('ready')
    expect(applicantReadiness([])).toBe('missing')
    expect(applicantReadiness(coreDocumentTypes)).toBe('missing')
    expect(applicantReadiness([...coreDocumentTypes, 'reference', 'reference'])).toBe('missing')
  })
  it.each(documentTypes)('keeps the state Missing when the %s category is absent', (missing) => {
    expect(applicantReadiness(documentTypes.filter((type) => type !== missing))).toBe('missing')
  })
})
