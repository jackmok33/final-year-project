// @vitest-environment jsdom
import '../test/domSetup'
import { renderHook } from '@testing-library/react'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { content, type ContentKey } from '../content'
import { useContent } from './useContent'

describe('shared content hook', () => {
  it('returns the matching file and retains its specific TypeScript shape', () => {
    const { result, rerender } = renderHook(() => useContent('decisionForm'))
    expect(result.current).toBe(content.decisionForm)
    expectTypeOf(result.current).toEqualTypeOf<typeof content.decisionForm>()
    expectTypeOf<Parameters<typeof useContent>[0]>().toEqualTypeOf<ContentKey>()
    rerender()
    expect(result.current).toBe(content.decisionForm)
  })

  it('reads the new content file when the selector changes', () => {
    const { result, rerender } = renderHook(
      ({ section }: { section: 'demoSignIn' | 'decisionForm' }) => useContent(section),
      { initialProps: { section: 'demoSignIn' } },
    )
    expect(result.current).toBe(content.demoSignIn)
    rerender({ section: 'decisionForm' })
    expect(result.current).toBe(content.decisionForm)
  })

  it('formats decisions with the original outcome, case and criteria context', () => {
    const { result } = renderHook(() => useContent('decisionForm'))
    expect(result.current.confirmationTitle('Reject')).toBe('Record final Reject decision?')
    expect(result.current.confirmationBody('Offer', 'APP-TEST', '1.2')).toBe(
      'You are recording Offer for APP-TEST, based on the latest run and criteria v1.2. This action will be added to the review history.',
    )
    expect(result.current.recordAction('Further review')).toBe('Record further review')
    expect(result.current.overallScore(0)).toBe('Overall score: 0 / 100')
    expect(result.current.overallScore(null)).toBe('Overall score: Not available / 100')
  })

  it('preserves missing values and line breaks in operational messages', () => {
    const { result } = renderHook(() => useContent('serviceHealthPage'))
    expect(result.current.redactedLog('JOB-1', 'MODEL_UNAVAILABLE')).toBe(
      'Job: JOB-1\nCategory: MODEL_UNAVAILABLE\nSource: simulated local-model fixture\nApplicant content: excluded',
    )
    expect(result.current.redactedLog()).toContain('Job: \nCategory: \n')
  })

  it('formats criteria and course counts without exposing placeholder values', () => {
    const { result } = renderHook(() => useContent('criteriaFields'))
    expect(result.current.totalLabel(100, false)).toBe('100% · Valid')
    expect(result.current.totalLabel(NaN, true)).toBe('—% · Invalid')
    expect(content.common.criteriaContext()).toContain('Criteria vunknown')
    expect(content.intakeCards.applications(1)).toBe('1 application')
    expect(content.intakeCards.applications(2)).toBe('2 applications')
    expect(content.intakeCards.applications(undefined)).toBe('Application count unavailable')
    expect(content.sectionAssessments.scoreSummary(null)).toBe('— / 100 · Weight %')
  })
})
