import { describe, expect, it } from 'vitest'
import { normalizeCourseName } from './courseName'

describe('course names', () => {
  it.each([
    ['  Data Science & AI MSc  ', 'Data Science & AI MSc'],
    ['Éthique de l’IA (MSc)', 'Éthique de l’IA (MSc)'],
    ['x'.repeat(100), 'x'.repeat(100)],
  ])('preserves display text while trimming %s', (value, expected) => {
    expect(normalizeCourseName(value)).toBe(expected)
  })
  it.each(['', '   ', 'x'.repeat(101)])('rejects blank or overlong names', (value) => {
    expect(normalizeCourseName(value)).toBeUndefined()
  })
})
