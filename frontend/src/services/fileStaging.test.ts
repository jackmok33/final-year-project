import { afterEach, describe, expect, it } from 'vitest'
import {
  archives,
  releaseArchive,
  releaseUploads,
  stageArchive,
  stageUploads,
  uploads,
} from './fileStaging'

afterEach(() => {
  archives.clear()
  uploads.clear()
})

describe('temporary file references', () => {
  it('keeps concurrent uploads separate even when their filenames match', () => {
    const first = new File(['first PDF'], 'transcript.pdf')
    const second = new File(['second PDF'], 'transcript.pdf')
    const one = stageUploads([{ type: 'transcript', file: first }])
    const two = stageUploads([{ type: 'transcript', file: second }])
    expect(one[0].id).not.toBe(two[0].id)
    expect(uploads.get(one[0].id)).toBe(first)
    expect(uploads.get(two[0].id)).toBe(second)
    expect(one[0].type).toBe('transcript')

    releaseUploads(one)
    expect(uploads.has(one[0].id)).toBe(false)
    expect(uploads.get(two[0].id)).toBe(second)
    releaseUploads(one)
    releaseUploads(two)
    expect(uploads.size).toBe(0)
  })

  it('releases an archive without affecting another staged batch', () => {
    const file = new File(['ZIP bytes'], 'applications.zip')
    const first = stageArchive(file)
    const second = stageArchive(file)
    expect(first).not.toBe(second)
    releaseArchive(first)
    releaseArchive(first)
    expect(archives.has(first)).toBe(false)
    expect(archives.get(second)).toBe(file)
  })
})
