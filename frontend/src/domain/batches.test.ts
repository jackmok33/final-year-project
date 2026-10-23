import { describe, expect, it } from 'vitest'
import { application, dataset, programme, run } from '../test/fixtures'
import {
  assignExistingBatches,
  batchApplications,
  batchSummaries,
  numberBatches,
  validBatches,
} from './batches'
import type { UploadBatch } from './types'

const batch: UploadBatch = {
  id: 'batch-one',
  programmeId: programme.id,
  intakeYear: programme.year,
  uploadedAt: '2026-10-23T10:00:00Z',
  filename: '',
  source: 'existing',
}
describe('batches', () => {
  it('numbers chronologically with stable timestamp ties and does not reorder the input', () => {
    const batches = [
      { ...batch, id: 'second' },
      { ...batch, id: 'first', uploadedAt: '2026-10-22T10:00:00Z' },
      { ...batch, id: 'third' },
    ]
    expect(numberBatches(batches).map((b) => [b.id, b.sequence])).toEqual([
      ['first', 1],
      ['second', 2],
      ['third', 3],
    ])
    expect(batches.map((b) => b.id)).toEqual(['second', 'first', 'third'])
  })
  it('groups legacy records once while retaining all review history', () => {
    const data = structuredClone(dataset)
    const original = structuredClone(data.applications[0])
    assignExistingBatches(data)
    const grouped = structuredClone(data)
    expect(data.batches).toHaveLength(1)
    expect(data.applications[0]).toEqual({ ...original, batchId: data.batches![0].id })
    assignExistingBatches(data)
    expect(data).toEqual(grouped)
    expect(validBatches(data)).toBe(true)
  })
  it('excludes other courses and counts only current classified decisions', () => {
    const decided = {
      ...application,
      batchId: batch.id,
      decisions: [
        {
          id: 'decision',
          outcome: 'Conditional' as const,
          runId: run.id,
          recommendation: run.recommendation,
          reason: '',
          actor: 'tutor-a',
          at: run.finishAt,
        },
      ],
    }
    const other = { ...decided, id: 'other', programmeId: 'other-course' }
    expect(batchApplications(batch, [decided, other])).toEqual([decided])
    const data = {
      ...dataset,
      batches: [batch],
      applications: [decided, { ...application, id: 'pending', batchId: batch.id }, other],
    }
    expect(batchSummaries(data, programme.id, programme.year)[0]).toMatchObject({
      applicantCount: 2,
      conditionalCount: 1,
      pendingReviewCount: 1,
    })
  })
  it('rejects duplicate metadata and dangling batch references', () => {
    expect(validBatches({ ...dataset, batches: [batch, batch] })).toBe(false)
    expect(
      validBatches({
        ...dataset,
        batches: [],
        applications: [{ ...application, batchId: batch.id }],
      }),
    ).toBe(false)
  })
})
