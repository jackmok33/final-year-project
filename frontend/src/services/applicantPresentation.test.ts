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
    const sampleRun = { ...run, applicationId: sample.id }
    expect(applicantProfile(sample).name).toBe('Carson Darrin')
    expect(applicantEvidence(sample, { ...sampleRun, status: 'failed' })).toEqual([])
    expect(
      applicantEvidence(sample, { ...sampleRun, extractedGrade: 0 }).flatMap((group) =>
        group.entries.flat(),
      ),
    ).toContain('Grade: 0%')
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
  it('uses the selected assessment grade after correction without rewriting older evidence', () => {
    const sample = { ...application, id: 'APP-2026-0142', fixture: 'review' as const }
    const original = { ...run, applicationId: sample.id, extractedGrade: 68 }
    const corrected = { ...original, id: 'corrected-run', extractedGrade: 74 }
    const originalSnapshot = structuredClone(original)
    const text = (assessment: typeof original) =>
      applicantEvidence(sample, assessment).flatMap((group) => group.entries.flat())
    expect(text(original)).toContain('Grade: 68%')
    expect(text(corrected)).toContain('Grade: 74%')
    expect(text(corrected)).not.toContain('Grade: UK 2.1, 85')
    expect(text(original)).toContain('Grade: 68%')
    expect(original).toEqual(originalSnapshot)
  })

  it('does not invent reference scores when the section was not assessed', () => {
    const sample = { ...application, id: 'APP-2026-0142', fixture: 'review' as const }
    const assessment = { ...run, applicationId: sample.id }
    const references = applicantEvidence(sample, assessment).find(
      (group) => group.key === 'references',
    )!
    expect(references.entries.flat().join(' ')).not.toMatch(/score|90\/100|82\/100/i)
    const assessed = {
      ...assessment,
      sections: [
        ...assessment.sections,
        {
          key: 'references' as const,
          score: 0,
          explanation: 'No support.',
          uncertainty: '',
          citations: [],
        },
      ],
    }
    expect(
      applicantEvidence(sample, assessed)
        .find((group) => group.key === 'references')
        ?.entries.flat(),
    ).toContain('Overall reference score: 0/100')
  })

  it('does not combine another applicant’s assessment with a known profile', () => {
    const sample = { ...application, id: 'APP-2026-0142', fixture: 'review' as const }
    expect(applicantEvidence(sample, { ...run, applicationId: 'another-applicant' })).toEqual([])
  })
})
