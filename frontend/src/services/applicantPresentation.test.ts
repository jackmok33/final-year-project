import { describe, expect, it } from 'vitest'
import { assessmentScore } from '../domain/types'
import { application, run } from '../test/fixtures'
import { applicantEvidence, applicantProfile } from './applicantPresentation'
describe('new programme and applicant presentation', () => {
  it('never fabricates applicant identity, education or evidence for uploads', () => {
    const uploaded = {
      ...application,
      id: 'APP-2026-0142',
      candidate: 'Uploaded folder',
      fixture: undefined,
    }
    expect(applicantProfile(uploaded)).toEqual({
      name: 'Uploaded folder',
      studentId: 'Uploaded folder',
      university: '',
    })
    expect(applicantEvidence(uploaded, run)).toEqual([])
    const sample = { ...uploaded, fixture: 'review' as const }
    expect(applicantProfile(sample).name).toBe('Carson Darrin')
    expect(applicantEvidence(sample, { ...run, status: 'failed' })).toEqual([])
    expect(
      applicantEvidence(sample, { ...run, extractedGrade: 0 }).flatMap((group) =>
        group.entries.flat(),
      ),
    ).toContain('Overall extracted mark: 0%')
  })
  it.each(['queued', 'running', 'failed'] as const)(
    'withholds scores and synthetic evidence for a %s assessment',
    (status) => {
      const unfinished = { ...run, status, overall: 99 }
      expect(assessmentScore({ ...application, runs: [unfinished] })).toBeNull()
      expect(applicantEvidence(application, unfinished)).toEqual([])
    },
  )
  it('withholds scores and evidence when assessment processing is unavailable', () => {
    const unavailable = {
      ...run,
      overall: 99,
      flags: [{ code: 'BACKEND_UNAVAILABLE', message: 'Unavailable', critical: true }],
    }
    expect(assessmentScore({ ...application, runs: [unavailable] })).toBeNull()
    expect(applicantEvidence(application, unavailable)).toEqual([])
    expect(assessmentScore({ ...application, runs: [] })).toBeNull()
  })
})
