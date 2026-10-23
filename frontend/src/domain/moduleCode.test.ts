import { describe, expect, it } from 'vitest'
import { normalizeModuleCode } from './moduleCode'

describe('normalizeModuleCode', () => {
  it.each([
    [' comp0001 ', 'COMP0001'],
    ['data-science_1', 'DATA-SCIENCE_1'],
    ['a'.repeat(100), 'A'.repeat(100)],
  ])('normalises %s', (input, expected) => expect(normalizeModuleCode(input)).toBe(expected))
  it.each(['', ' ', 'a'.repeat(101), 'Course name', '-COMP', 'A/B', '计算'])(
    'rejects %j',
    (input) => {
      expect(normalizeModuleCode(input)).toBeUndefined()
    },
  )
})
