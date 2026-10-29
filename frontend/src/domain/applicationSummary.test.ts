import { describe, expect, it } from 'vitest'
import { application, run } from '../test/fixtures'
import { summarizeApplications } from './applicationSummary'
import type { Application, Decision } from './types'

function decided(outcome: Decision['outcome'], runId = run.id): Application {
  return {
    ...application,
    decisions: [
      {
        id: outcome,
        runId,
        outcome,
        recommendation: 'Offer',
        actor: 'tutor-a',
        at: run.finishAt,
        reason: '',
      },
    ],
  }
}

describe('summarizeApplications', () => {
  it('provides zero counts for an empty scope', () => {
    expect(summarizeApplications([])).toEqual({
      total: 0,
      offers: 0,
      unconditional: 0,
      conditional: 0,
      reject: 0,
      pending: 0,
    })
  })

  it('counts the three final choices and leaves unreviewed applications pending', () => {
    expect(
      summarizeApplications([
        decided('Unconditional'),
        decided('Conditional'),
        decided('Reject'),
        application,
      ]),
    ).toEqual({ total: 4, offers: 2, unconditional: 1, conditional: 1, reject: 1, pending: 1 })
  })

  it('keeps legacy choices, older-run decisions and applications without an assessment pending', () => {
    const applications = [
      decided('Offer'),
      decided('Further review'),
      decided('Reject', 'older-run'),
      { ...decided('Unconditional'), runs: [] },
    ]
    const original = structuredClone(applications)
    expect(summarizeApplications(applications)).toEqual({
      total: 4,
      offers: 0,
      unconditional: 0,
      conditional: 0,
      reject: 0,
      pending: 4,
    })
    expect(applications).toEqual(original)
  })

  it('uses the latest tutor record rather than counting previous decisions again', () => {
    const latest = {
      ...decided('Reject'),
      decisions: [...decided('Unconditional').decisions, ...decided('Reject').decisions],
    }
    expect(summarizeApplications([latest])).toMatchObject({
      total: 1,
      offers: 0,
      reject: 1,
      pending: 0,
    })
  })
})
