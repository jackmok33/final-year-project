import { afterEach, describe, expect, it } from 'vitest'
import type { Backup } from '../domain/types'
import { dataset } from '../test/fixtures'
import {
  archives,
  backups,
  discardBackup,
  releaseArchive,
  releaseUploads,
  stageArchive,
  stageBackup,
  stageUploads,
  takeBackup,
  uploads,
} from './fileStaging'

afterEach(() => {
  archives.clear()
  backups.clear()
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

  it('consumes backups once and can discard an abandoned restore', () => {
    const backup: Backup = {
      format: 'ucl-admissions-demo',
      version: 2,
      createdAt: '2026-10-29T10:00:00Z',
      dataset,
      files: [],
    }
    const exported = stageBackup(backup)
    expect(takeBackup(exported)).toBe(backup)
    expect(takeBackup(exported)).toBeUndefined()
    const abandoned = stageBackup(backup)
    discardBackup(abandoned)
    expect(takeBackup(abandoned)).toBeUndefined()
  })
})
