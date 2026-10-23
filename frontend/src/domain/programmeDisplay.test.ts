import { describe, expect, it } from 'vitest'
import { programme } from '../test/fixtures'
import { programmeIntakeLabel } from './programmeDisplay'
describe('new programme and applicant presentation', () => {
  it('uses compact intake labels while preserving arbitrary programme names', () => {
    expect(programmeIntakeLabel(programme, '2026 / 27')).toBe('CSML 26/27')
    expect(programmeIntakeLabel({ ...programme, name: 'Data Science & AI MSc' }, '25/26')).toBe(
      'Data Science & AI MSc 25/26',
    )
    expect(programmeIntakeLabel(programme, 'Spring intake')).toBe('CSML Spring intake')
  })
})
