import { describe, expect, it } from 'vitest'
import { applicationState, latestDecision, latestRun } from './types'
import { application, run } from '../test/fixtures'
const decision = {
  id: 'decision',
  runId: run.id,
  recommendation: run.recommendation,
  outcome: 'Offer' as const,
  reason: '',
  actor: 'tutor-a',
  at: run.startedAt,
}
describe('application workflow helpers', () => {
  it('handles applications without evaluations or decisions', () => {
    const empty = { ...application, runs: [], decisions: [] }
    expect(latestRun(empty)).toBeUndefined()
    expect(latestDecision(empty)).toBeUndefined()
    expect(applicationState(empty)).toBe('not evaluated')
  })
  it('returns the last run and decision without mutating history', () => {
    const latest = { ...run, id: 'run-2', status: 'running' as const }
    const app = { ...application, runs: [run, latest], decisions: [decision] }
    expect(latestRun(app)).toBe(latest)
    expect(latestDecision(app)).toBe(decision)
    expect(applicationState(app)).toBe('running')
    expect(app.runs).toHaveLength(2)
  })
  it.each(['Offer', 'Reject'] as const)(
    'marks the latest final %s decision completed',
    (outcome) => {
      expect(applicationState({ ...application, decisions: [{ ...decision, outcome }] })).toBe(
        'completed',
      )
    },
  )
  it('keeps Further review unresolved', () => {
    expect(
      applicationState({ ...application, decisions: [{ ...decision, outcome: 'Further review' }] }),
    ).toBe('awaiting review')
  })
})
