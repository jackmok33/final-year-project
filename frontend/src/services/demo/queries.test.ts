import { strToU8, zipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Application, BatchSummary, Programme } from '../../domain/types'
import { authorizedFile, commandDemo, queryDemo, releaseArchive, stageArchive } from '../demo'
import { inspectPdf } from '../pdf'
import * as storage from '../storage'
import { readDataset } from '../storage'
vi.mock('../pdf', () => ({ inspectPdf: vi.fn() }))
describe('persistent browser demo contract', () => {
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async (file: File) => ({
      pages: file.name.includes('large') ? 60 : 4,
    }))
  })
  it('scopes queues and criteria by course and denies unassigned courses', async () => {
    const programmes = (await queryDemo({ op: 'programmes' }, 'tutor-a')) as Programme[]
    expect(programmes).toHaveLength(3)
    expect(await queryDemo({ op: 'programmes' }, 'tutor-b')).toHaveLength(0)
    const first = (await queryDemo(
      { op: 'applications', programmeId: 'programme-1' },
      'tutor-a',
    )) as Application[]
    const second = (await queryDemo(
      { op: 'applications', programmeId: 'programme-2' },
      'tutor-a',
    )) as Application[]
    expect(first).toHaveLength(8)
    expect(second).toHaveLength(1)
    await expect(
      queryDemo({ op: 'applications', programmeId: 'programme-2' }, 'tutor-b'),
    ).rejects.toThrow('tutor access')
    await expect(
      queryDemo({ op: 'rubrics', programmeId: 'programme-2' }, 'tutor-b'),
    ).rejects.toThrow('tutor access')
    await expect(queryDemo({ op: 'application', id: second[0].id }, 'tutor-b')).rejects.toThrow(
      'tutor access',
    )
    await expect(authorizedFile(second[0].documentIds[0], 'tutor-b')).rejects.toThrow(
      'tutor access',
    )
    const original = (await readDataset())!
    const secondRubric = original.rubrics.find((r) => r.programmeId === 'programme-2')!
    const { id: criteriaId } = await commandDemo(
      { op: 'rubric', rubric: { ...secondRubric, offerFrom: 90 } },
      'tutor-a',
    )
    const saved = (await readDataset())!
    expect(saved.activeRubricIds['programme-1']).toBe(original.activeRubricIds['programme-1'])
    expect(saved.rubrics.slice(0, -1)).toEqual(original.rubrics)
    expect(saved.activeRubricIds['programme-2']).toBe(criteriaId)
    expect(saved.applications).toEqual(original.applications)
    await commandDemo({ op: 'evaluate', id: second[0].id }, 'tutor-a')
    expect(
      (await readDataset())!.applications.find((a) => a.id === second[0].id)?.runs.at(-1)?.rubricId,
    ).toBe(saved.activeRubricIds['programme-2'])
  })
})
describe('persistent ZIP upload batches', () => {
  function makeZip(
    files: Record<string, string> = {
      'A-001/cv.pdf': 'original cv',
      'A-002/transcript.pdf': 'original transcript',
    },
  ) {
    return new File(
      [
        new Uint8Array(
          zipSync(
            Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)])),
          ),
        ),
      ],
      'November applications.zip',
    )
  }
  async function importZip(
    file = makeZip(),
    programmeId = 'programme-1',
    year = '2026 / 27',
    actor = 'tutor-a',
  ) {
    const archiveId = stageArchive(file)
    try {
      return await commandDemo(
        { op: 'importBatch', programmeId, intakeYear: year, archiveId },
        actor,
      )
    } finally {
      releaseArchive(archiveId)
    }
  }
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async (file: File) => {
      const text = await file.text()
      if (text === 'bad') throw new Error('Unreadable PDF')
      return { pages: text === 'large' ? 60 : 1 }
    })
  })
  it('updates pending counts after tutor decisions and re-evaluation without mixing batches or courses', async () => {
    const { id } = await importZip()
    const data = (await storage.readDataset())!
    const offer = data.applications.find((a) => a.id === 'APP-2026-0143')!
    const review = data.applications.find((a) => a.id === 'APP-2026-0142')!
    const otherCourse = data.applications.find((a) => a.id === 'APP-2026-0147')!
    // This test isolates batch counts; critical evidence guards are tested separately.
    review.runs.at(-1)!.flags = []
    otherCourse.runs.at(-1)!.flags = []
    await storage.writeDataset(data)
    const summaries = () =>
      queryDemo(
        { op: 'batches', programmeId: 'programme-1', intakeYear: '26/27' },
        'tutor-a',
      ) as Promise<BatchSummary[]>
    for (const outcome of ['Unconditional', 'Reject'] as const) {
      await commandDemo(
        {
          op: 'decide',
          id: offer.id,
          runId: offer.runs.at(-1)!.id,
          outcome,
          reason: 'Verified source evidence.',
        },
        'tutor-a',
      )
      expect((await summaries()).find((b) => b.source === 'existing')?.pendingReviewCount).toBe(4)
    }
    await commandDemo(
      {
        op: 'decide',
        id: review.id,
        runId: review.runs.at(-1)!.id,
        outcome: 'Conditional',
        reason: 'Evidence inspected; clarification requested.',
      },
      'tutor-a',
    )
    expect((await summaries()).find((b) => b.source === 'existing')?.pendingReviewCount).toBe(3)
    expect((await summaries()).find((b) => b.id === id)?.pendingReviewCount).toBe(2)
    await commandDemo(
      {
        op: 'decide',
        id: otherCourse.id,
        runId: otherCourse.runs.at(-1)!.id,
        outcome: 'Conditional',
        reason: 'Inspected missing evidence.',
      },
      'tutor-a',
    )
    const otherBatch = (await queryDemo(
      {
        op: 'batches',
        programmeId: 'programme-2',
        intakeYear: '26/27',
      },
      'tutor-a',
    )) as BatchSummary[]
    expect(otherBatch[0].pendingReviewCount).toBe(0)
    expect((await summaries()).find((b) => b.source === 'existing')?.pendingReviewCount).toBe(3)
    await commandDemo({ op: 'evaluate', id: offer.id }, 'tutor-a')
    const existing = (await summaries()).find((b) => b.source === 'existing')!
    expect(existing.pendingReviewCount).toBe(4)
    expect(await queryDemo({ op: 'batch', id: existing.id }, 'tutor-a')).toMatchObject({
      pendingReviewCount: 4,
    })
  })
  it('keeps chronological batch numbers when new uploads arrive, including identical timestamps', async () => {
    const first = await importZip()
    const second = await importZip()
    const data = (await storage.readDataset())!
    const firstBatch = data.batches!.find((b) => b.id === first.id)!
    data.batches!.find((b) => b.id === second.id)!.uploadedAt = firstBatch.uploadedAt
    await storage.writeDataset(data)
    const batches = (await queryDemo(
      { op: 'batches', programmeId: 'programme-1', intakeYear: '26/27' },
      'tutor-a',
    )) as BatchSummary[]
    expect(batches.find((b) => b.id === first.id)?.sequence).toBe(4)
    expect(batches.find((b) => b.id === second.id)?.sequence).toBe(5)
    expect(await queryDemo({ op: 'batch', id: first.id! }, 'tutor-a')).toMatchObject({
      sequence: 4,
    })
    expect(await queryDemo({ op: 'batch', id: second.id! }, 'tutor-a')).toMatchObject({
      sequence: 5,
    })
    expect((await storage.readDataset())!.batches).toEqual(data.batches)
  })
})
describe('new programme and applicant presentation', () => {
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async () => ({ pages: 1 }))
  })
  it('returns programme intake choices only for tutor-owned workspaces', async () => {
    expect(await queryDemo({ op: 'programmeIntakes' }, 'tutor-b')).toEqual([])
    const choices = (await queryDemo({ op: 'programmeIntakes' }, 'tutor-a')) as {
      programmeId: string
      years: string[]
    }[]
    expect(choices).toHaveLength(3)
    expect(choices[0].years).toContain('2025 / 26')
    await expect(queryDemo({ op: 'programmeIntakes' }, 'admin-a')).rejects.toThrow('Tutor access')
  })
})
