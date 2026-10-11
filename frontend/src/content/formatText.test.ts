import { describe, expect, it } from 'vitest'
import { textValue } from './formatText'

describe('content text interpolation', () => {
  it.each([
    [undefined, ''],
    [null, ''],
    [false, ''],
    [true, ''],
    [0, '0'],
    [74, '74'],
    ['Offer', 'Offer'],
  ] as const)('matches React text rendering for %s', (value, expected) => {
    expect(textValue(value)).toBe(expected)
  })
})
