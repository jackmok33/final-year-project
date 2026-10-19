import { describe, expect, it } from 'vitest'
import { application, otherProgramme, programme } from '../test/fixtures'
import { applicationIntakeYear, intakeYears, normalizeIntakeYear } from './intakes'

describe('module intake years', () => {
  it.each([
    ['24/25', '2024 / 25'],
    ['2026 / 27', '2026 / 27'],
    ['2025/2026', '2025 / 26'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeIntakeYear(input)).toBe(expected)
  })
  it.each(['2026/28', '26/2027/28', '', 'next year', '2026/2127', '1899/00'])(
    'rejects invalid labels: %s',
    (input) => {
      expect(normalizeIntakeYear(input)).toBeUndefined()
    },
  )
  it('keeps legacy applications in the saved module year and includes additional populated years', () => {
    expect(applicationIntakeYear(application, programme)).toBe('2026 / 27')
    expect(
      intakeYears(programme, [
        application,
        { ...application, intakeYear: '2022 / 23' },
        { ...application, programmeId: otherProgramme.id, intakeYear: '2030 / 31' },
      ]),
    ).toEqual(['2026 / 27', '2025 / 26', '2024 / 25', '2022 / 23'])
  })
  it('preserves custom legacy year labels rather than losing their records', () => {
    const legacy = { ...programme, year: 'Intake TBC' }
    expect(intakeYears(legacy, [application])).toEqual(['Intake TBC'])
  })
})
