// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { content, type ContentKey } from '../content'
import '../test/domSetup'
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

  it('formats the current assessment summary without losing zero or missing scores', () => {
    const { result } = renderHook(() => useContent('recommendationSummary'))
    expect(result.current.scoreValue(0)).toBe('0.0')
    expect(result.current.scoreValue(78.4)).toBe('78.4')
    expect(result.current.scoreValue(null)).toBe('—')
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
    expect(content.moduleCards.openProgramme('CSML 26/27')).toBe('Open CSML 26/27')
    expect(content.applicationTable.notAvailable).toBe('—')
    expect(content.sectionAssessments.sectionScore(null)).toBe('Score unavailable')
  })
})
