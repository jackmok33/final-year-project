import { describe, expect, it } from 'vitest'
import {
  isValidDocumentPageCount,
  isValidPdfSize,
  isWithinApplicationPageLimit,
} from './documentLimits'

describe('original document limits', () => {
  it('accepts nonempty PDF byte sizes through 20 MiB and rejects invalid metadata', () => {
    for (const bytes of [1, 20 * 1024 * 1024 - 1, 20 * 1024 * 1024]) {
      expect(isValidPdfSize(bytes)).toBe(true)
    }
    for (const bytes of [0, -1, 1.5, 20 * 1024 * 1024 + 1, NaN, Infinity]) {
      expect(isValidPdfSize(bytes)).toBe(false)
    }
  })

  it('accepts whole-page counts from one through 100 and rejects invalid metadata', () => {
    for (const pages of [1, 99, 100]) {
      expect(isValidDocumentPageCount(pages)).toBe(true)
    }
    for (const pages of [0, -1, 1.5, 101, NaN, Infinity]) {
      expect(isValidDocumentPageCount(pages)).toBe(false)
    }
  })

  it('allows empty drafts and exactly 100 combined pages, without accepting oversized totals', () => {
    expect(isWithinApplicationPageLimit(0)).toBe(true)
    expect(isWithinApplicationPageLimit(40 + 60)).toBe(true)
    expect(isValidDocumentPageCount(60)).toBe(true)
    expect(isValidDocumentPageCount(41)).toBe(true)
    expect(isWithinApplicationPageLimit(60 + 41)).toBe(false)
    for (const pages of [-1, 0.5, NaN, Infinity]) {
      expect(isWithinApplicationPageLimit(pages)).toBe(false)
    }
  })
})
