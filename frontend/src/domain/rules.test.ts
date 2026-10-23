import { describe, expect, it } from 'vitest'
import { baseRubric } from '../services/seed'
import { aggregate, csvCell, validateRubric } from './rules'
import type { SectionScore } from './types'
const sections = (values: (number | null)[]): SectionScore[] =>
  (['academic', 'cv', 'statement'] as const).map((key, i) => ({
    key,
    score: values[i],
    explanation: '',
    uncertainty: '',
    citations: [],
  }))
describe('illustrative scoring rules', () => {
  it('matches the approved example without confusing score and outcome', () => {
    expect(aggregate(sections([84, 76, 69.6]), baseRubric, true)).toMatchObject({
      overall: 78.4,
      recommendation: 'Further review',
    })
  })
  it('withholds an incomplete aggregate rather than renormalising', () => {
    expect(aggregate(sections([84, 76, null]), baseRubric, false)).toMatchObject({
      overall: null,
      recommendation: 'Further review',
    })
  })
  it('gives unresolved evidence precedence over a verified mandatory failure', () => {
    expect(aggregate(sections([90, 90, 90]), baseRubric, true, true).recommendation).toBe(
      'Further review',
    )
    expect(aggregate(sections([90, 90, 90]), baseRubric, false, true).recommendation).toBe('Reject')
  })
  it.each([57, 60, 63, 77, 80, 83])('routes inclusive review boundary %s to review', (n) => {
    expect(aggregate(sections([n, n, n]), baseRubric, false).recommendation).toBe('Further review')
  })
  it('routes scores outside the margins', () => {
    expect(aggregate(sections([84, 84, 84]), baseRubric, false).recommendation).toBe('Offer')
    expect(aggregate(sections([56, 56, 56]), baseRubric, false).recommendation).toBe('Reject')
  })
  it('rejects invalid weights, non-finite values, thresholds and empty rules', () => {
    expect(
      validateRubric({ ...baseRubric, weights: { academic: 40, cv: 25, statement: 25 } }),
    ).toContain('100%')
    expect(validateRubric({ ...baseRubric, offerFrom: 50 })).toContain('thresholds')
    expect(validateRubric({ ...baseRubric, margin: NaN })).toContain('thresholds')
    expect(validateRubric({ ...baseRubric, mandatoryRule: '' })).toContain('required')
  })
  it('escapes CSV quoting and neutralises spreadsheet formula prefixes', () => {
    expect(csvCell('=1+2')).toBe('"\'=1+2"')
    expect(csvCell('  @SUM(A1)')).toBe('"\'  @SUM(A1)"')
    expect(csvCell('"hello"')).toBe('"""hello"""')
  })
})
