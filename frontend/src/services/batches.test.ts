import { beforeEach, describe, expect, it, vi } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import type { Application, Backup, BatchSummary, Dataset, UploadBatch } from '../domain/types'
import {
  commandDemo,
  queryDemo,
  stageArchive,
  releaseArchive,
  stageBackup,
  takeBackup,
  validateBackup,
} from './demo'
import * as storage from './storage'
vi.mock('./pdf', () => ({
  inspectPdf: vi.fn(async (file: File) => {
    const text = await file.text()
    if (text === 'bad') throw new Error('Unreadable PDF')
    return { pages: text === 'large' ? 60 : 1 }
  }),
}))
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
    return await commandDemo({ op: 'importBatch', programmeId, intakeYear: year, archiveId }, actor)
  } finally {
    releaseArchive(archiveId)
  }
}
beforeEach(async () => {
  await queryDemo({ op: 'accounts' }, null)
  await commandDemo({ op: 'reset' }, 'admin-a')
})
const sampleIds = ['SAMPLE-CSML-01', 'SAMPLE-CSML-02', 'SAMPLE-CSML-03']
function markLegacySampleUpgrade(data: Dataset) {
  data.audit = data.audit.filter(
    (event) => !['sample-csml-batches-v1', 'sample-csml-batches-v2'].includes(event.id),
  )
  data.audit.push({
    id: 'sample-csml-batches-v1',
    at: '2026-10-16T15:00:00Z',
    actor: 'tutor-a',
    action: 'Add sample course batches',
    target: 'sample-batches',
  })
}
function removeSampleRecords(data: Dataset) {
  const documents = data.documents.filter((d) => sampleIds.includes(d.applicationId))
  data.applications = data.applications.filter((a) => !sampleIds.includes(a.id))
  data.documents = data.documents.filter((d) => !sampleIds.includes(d.applicationId))
  data.batches = data.batches?.filter((b) => !b.id.startsWith('sample-csml-'))
  data.audit = data.audit.filter(
    (event) => !['sample-csml-batches-v1', 'sample-csml-batches-v2'].includes(event.id),
  )
  return documents.map((d) => d.id)
}
describe('persistent ZIP upload batches', () => {
  it('repairs an older upgrade marked complete before any sample batches were installed', async () => {
    const data = (await storage.readDataset())!
    const removed = removeSampleRecords(data)
    markLegacySampleUpgrade(data)
    const before = structuredClone(data.applications[0])
    await storage.writeDataset(data, {}, removed)
    const summaries = (await queryDemo(
      { op: 'batches', programmeId: 'programme-1', intakeYear: '26/27' },
      'tutor-a',
    )) as BatchSummary[]
    expect(summaries.map((batch) => batch.applicantCount)).toEqual([5, 2, 1])
    expect((await storage.readDataset())!.applications[0]).toEqual({
      ...before,
      batchId: summaries[0].id,
    })
    expect(await storage.readFile('SAMPLE-CSML-01-transcript')).toBeDefined()
    await queryDemo({ op: 'accounts' }, null)
    expect((await storage.readDataset())!.applications).toHaveLength(9)
    expect(
      (await storage.readDataset())!.audit.filter((event) => event.id === 'sample-csml-batches-v2'),
    ).toHaveLength(1)
  })
  it.each(['none', 'first'] as const)(
    'repairs %s saved sample batch metadata without changing original runs, decisions or PDFs',
    async (retained) => {
      await queryDemo({ op: 'batches', programmeId: 'programme-1', intakeYear: '26/27' }, 'tutor-a')
      const data = (await storage.readDataset())!
      const originalBatch = data.batches!.find(
        (batch) => batch.programmeId === 'programme-1' && batch.source === 'existing',
      )!
      data.batches = data.batches?.filter(
        (batch) =>
          !batch.id.startsWith('sample-csml-') ||
          (retained === 'first' && batch.id === 'sample-csml-october-12'),
      )
      for (const application of data.applications.filter((a) => sampleIds.includes(a.id))) {
        if (retained === 'none' || application.id === sampleIds[2])
          application.batchId = originalBatch.id
      }
      markLegacySampleUpgrade(data)
      const originals = structuredClone(data.applications.filter((a) => sampleIds.includes(a.id)))
      const pdf = await (await storage.readFile('SAMPLE-CSML-01-transcript'))!.arrayBuffer()
      await storage.writeDataset(data)
      const summaries = (await queryDemo(
        { op: 'batches', programmeId: 'programme-1', intakeYear: '26/27' },
        'tutor-a',
      )) as BatchSummary[]
      expect(summaries.map((batch) => [batch.applicantCount, batch.pendingReviewCount])).toEqual([
        [5, 5],
        [2, 1],
        [1, 0],
      ])
      const saved = (await storage.readDataset())!
      for (const original of originals)
        expect(saved.applications.find((a) => a.id === original.id)).toEqual({
          ...original,
          batchId:
            original.id === sampleIds[2] ? 'sample-csml-october-16' : 'sample-csml-october-12',
        })
      expect(await (await storage.readFile('SAMPLE-CSML-01-transcript'))!.arrayBuffer()).toEqual(
        pdf,
      )
    },
  )
  it('adopts a completed legacy install without recreating deleted sample applicants', async () => {
    await commandDemo({ op: 'delete', id: sampleIds[0] }, 'admin-a')
    const data = (await storage.readDataset())!
    markLegacySampleUpgrade(data)
    const before = structuredClone(data.applications)
    await storage.writeDataset(data)
    await queryDemo({ op: 'accounts' }, null)
    expect((await storage.readDataset())!.applications).toEqual(before)
    expect(await storage.readFile('SAMPLE-CSML-01-transcript')).toBeUndefined()
  })
  it('keeps recorded sample deletions while repairing missing legacy batch metadata', async () => {
    await commandDemo({ op: 'delete', id: sampleIds[0] }, 'admin-a')
    const data = (await storage.readDataset())!
    const originalBatch = data.batches!.find(
      (batch) => batch.programmeId === 'programme-1' && batch.source === 'existing',
    )!
    data.batches = data.batches?.filter((batch) => !batch.id.startsWith('sample-csml-'))
    data.applications
      .filter((a) => sampleIds.includes(a.id))
      .forEach((a) => {
        a.batchId = originalBatch.id
      })
    markLegacySampleUpgrade(data)
    await storage.writeDataset(data)
    const summaries = (await queryDemo(
      { op: 'batches', programmeId: 'programme-1', intakeYear: '26/27' },
      'tutor-a',
    )) as BatchSummary[]
    expect(summaries.map((batch) => batch.applicantCount)).toEqual([5, 1, 1])
    expect((await storage.readDataset())!.applications.some((a) => a.id === sampleIds[0])).toBe(
      false,
    )
    expect(await storage.readFile('SAMPLE-CSML-01-transcript')).toBeUndefined()
  })
  it('adds sample batches once to existing data while preserving PDFs, tutor history and later deletions', async () => {
    const data = (await storage.readDataset())!
    const removed = removeSampleRecords(data)
    const original = data.applications[0]
    original.decisions.push({
      id: 'preserved-decision',
      runId: original.runs[0].id,
      recommendation: 'Further review',
      outcome: 'Further review',
      reason: 'Existing tutor note.',
      actor: 'tutor-a',
      at: '2026-10-17T10:00:00Z',
    })
    const before = structuredClone(original)
    const pdf = await (await storage.readFile(original.documentIds[0]))!.arrayBuffer()
    await storage.writeDataset(data, {}, removed)
    const summaries = (await queryDemo(
      { op: 'batches', programmeId: 'programme-1', intakeYear: '26/27' },
      'tutor-a',
    )) as BatchSummary[]
    expect(summaries.map((b) => [b.applicantCount, b.pendingReviewCount])).toEqual([
      [5, 4],
      [2, 1],
      [1, 0],
    ])
    const upgraded = (await storage.readDataset())!
    expect(upgraded.applications.find((a) => a.id === original.id)).toEqual(before)
    expect(await (await storage.readFile(original.documentIds[0]))!.arrayBuffer()).toEqual(pdf)
    expect(await storage.readFile('SAMPLE-CSML-01-transcript')).toBeDefined()
    await queryDemo({ op: 'accounts' }, null)
    expect((await storage.readDataset())!.applications).toHaveLength(9)
    expect(
      (await storage.readDataset())!.audit.filter((event) => event.id === 'sample-csml-batches-v2'),
    ).toHaveLength(1)
    await commandDemo({ op: 'delete', id: 'SAMPLE-CSML-01' }, 'admin-a')
    await queryDemo({ op: 'accounts' }, null)
    expect((await storage.readDataset())!.applications.some((a) => a.id === 'SAMPLE-CSML-01')).toBe(
      false,
    )
    expect(await storage.readFile('SAMPLE-CSML-01-transcript')).toBeUndefined()
  })
  it('preserves conflicting user records instead of replacing them with sample applicants', async () => {
    const data = (await storage.readDataset())!
    const removed = removeSampleRecords(data)
    data.applications.push({
      ...structuredClone(data.applications[0]),
      id: sampleIds[0],
      candidate: 'User-created reference',
      documentIds: [],
      fixture: undefined,
      runs: [],
      decisions: [],
      corrections: [],
    })
    await storage.writeDataset(data, {}, removed)
    await queryDemo({ op: 'accounts' }, null)
    const saved = (await storage.readDataset())!
    expect(saved.applications.find((a) => a.id === sampleIds[0])?.candidate).toBe(
      'User-created reference',
    )
    expect(saved.applications).toHaveLength(7)
    expect(saved.batches?.some((b) => b.id.startsWith('sample-csml-'))).toBe(false)
    expect(saved.audit.some((event) => event.id === 'sample-csml-batches-v2')).toBe(false)
    saved.applications.find((a) => a.id === sampleIds[0])!.id = 'USER-REFERENCE'
    await storage.writeDataset(saved)
    await queryDemo({ op: 'accounts' }, null)
    expect(
      (await storage.readDataset())!.applications.some(
        (a) => a.id === 'USER-REFERENCE' && a.candidate === 'User-created reference',
      ),
    ).toBe(true)
    expect((await storage.readDataset())!.applications).toHaveLength(10)
  })
  it('keeps a previously uploaded APP-2026-0148 while adding samples with independent references', async () => {
    const data = (await storage.readDataset())!
    const removed = removeSampleRecords(data)
    data.applications.push({
      ...structuredClone(data.applications[0]),
      id: 'APP-2026-0148',
      candidate: 'Existing upload',
      documentIds: [],
      fixture: undefined,
      runs: [],
      decisions: [],
      corrections: [],
    })
    await storage.writeDataset(data, {}, removed)
    await queryDemo({ op: 'accounts' }, null)
    const saved = (await storage.readDataset())!
    expect(saved.applications.find((a) => a.id === 'APP-2026-0148')?.candidate).toBe(
      'Existing upload',
    )
    expect(saved.applications).toHaveLength(10)
    expect(sampleIds.every((id) => saved.applications.some((a) => a.id === id))).toBe(true)
  })
  it.each(['name', 'owner'] as const)(
    'does not add examples to a course with an edited %s',
    async (field) => {
      const data = (await storage.readDataset())!
      const removed = removeSampleRecords(data)
      if (field === 'name') data.programmes[0].name = 'My private course'
      else data.programmes[0].createdBy = 'tutor-b'
      await storage.writeDataset(data, {}, removed)
      await queryDemo({ op: 'accounts' }, null)
      expect((await storage.readDataset())!.applications).toHaveLength(6)
    },
  )
  it('creates one batch with separate applicants and original PDFs, without fabricated assessment', async () => {
    const { id } = await importZip()
    const batch = (await queryDemo({ op: 'batch', id: id! }, 'tutor-a')) as UploadBatch
    expect(batch).toMatchObject({
      filename: 'November applications.zip',
      source: 'zip',
      programmeId: 'programme-1',
      intakeYear: '2026 / 27',
      uploadedBy: 'tutor-a',
    })
    const data = (await storage.readDataset())!
    const apps = data.applications.filter((a) => a.batchId === id)
    expect(apps.map((a) => a.candidate)).toEqual(['A-001', 'A-002'])
    expect(apps.every((a) => a.runs.length === 0 && !a.fixture)).toBe(true)
    expect(await (await storage.readFile(apps[0].documentIds[0]))!.text()).toBe('original cv')
    const batches = (await queryDemo(
      { op: 'batches', programmeId: 'programme-1', intakeYear: '26/27' },
      'tutor-a',
    )) as BatchSummary[]
    expect(batches.find((b) => b.id === id)?.applicantCount).toBe(2)
    expect(batches.find((b) => b.id === id)?.pendingReviewCount).toBe(2)
    expect(batches.find((b) => b.id === id)?.sequence).toBe(4)
    expect(batches.find((b) => b.source === 'existing')?.applicantCount).toBe(5)
    expect(batches.find((b) => b.source === 'existing')?.pendingReviewCount).toBe(5)
    expect(batches.find((b) => b.source === 'existing')?.sequence).toBe(1)
  })
  it('updates pending counts after tutor decisions and re-evaluation without mixing batches or courses', async () => {
    const { id } = await importZip()
    const data = (await storage.readDataset())!
    const offer = data.applications.find((a) => a.id === 'APP-2026-0143')!
    const review = data.applications.find((a) => a.id === 'APP-2026-0142')!
    const otherCourse = data.applications.find((a) => a.id === 'APP-2026-0147')!
    const summaries = () =>
      queryDemo(
        { op: 'batches', programmeId: 'programme-1', intakeYear: '26/27' },
        'tutor-a',
      ) as Promise<BatchSummary[]>
    for (const outcome of ['Offer', 'Reject'] as const) {
      await commandDemo(
        {
          op: 'decide',
          id: offer.id,
          runId: offer.runs.at(-1)!.id,
          outcome,
          reason: 'Verified source evidence.',
          confirmed: true,
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
        outcome: 'Further review',
        reason: 'Evidence inspected; clarification requested.',
        confirmed: false,
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
        outcome: 'Further review',
        reason: 'Inspected missing evidence.',
        confirmed: false,
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
  it('keeps repeated filenames and candidate references in distinct batches and intake years', async () => {
    const first = await importZip()
    const second = await importZip(makeZip(), 'programme-1', '25/26')
    expect(first.id).not.toBe(second.id)
    const previous = (await queryDemo(
      { op: 'batches', programmeId: 'programme-1', intakeYear: '2025 / 26' },
      'tutor-a',
    )) as BatchSummary[]
    expect(previous.map((b) => b.id)).toEqual([second.id])
    expect(previous[0].sequence).toBe(1)
    const apps = (await queryDemo(
      { op: 'applications', programmeId: 'programme-1' },
      'tutor-a',
    )) as Application[]
    expect(apps.filter((a) => a.batchId === first.id)).toHaveLength(2)
    expect(apps.filter((a) => a.batchId === second.id)).toHaveLength(2)
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
  it('rejects a whole batch on a bad PDF or combined page limit without partial records', async () => {
    const before = (await storage.readDataset())!
    for (const files of [
      { 'A/cv.pdf': 'ok', 'B/transcript.pdf': 'bad' },
      { 'A/cv.pdf': 'large', 'A/transcript.pdf': 'large' },
    ] as Record<string, string>[]) {
      await expect(importZip(makeZip(files))).rejects.toThrow()
      expect(await storage.readDataset()).toEqual(before)
    }
  })
  it('enforces tutor membership for import, batch listing and direct batch access', async () => {
    const { id } = await importZip(makeZip(), 'programme-2')
    await expect(queryDemo({ op: 'batch', id: id! }, 'tutor-b')).rejects.toThrow('tutor access')
    await expect(queryDemo({ op: 'batch', id: id! }, 'admin-a')).rejects.toThrow('tutor access')
    await expect(
      queryDemo({ op: 'batches', programmeId: 'programme-2', intakeYear: '26/27' }, 'tutor-b'),
    ).rejects.toThrow('tutor access')
    await expect(importZip(makeZip(), 'programme-2', '26/27', 'tutor-b')).rejects.toThrow(
      'tutor access',
    )
    await expect(importZip(makeZip(), 'programme-1', '26/27', 'admin-a')).rejects.toThrow(
      'tutor access',
    )
    await expect(importZip(makeZip(), 'programme-1', '2026 / 30')).rejects.toThrow('valid intake')
    await expect(queryDemo({ op: 'batch', id: 'missing' }, 'tutor-a')).rejects.toThrow('not found')
    await expect(
      commandDemo(
        { op: 'importBatch', programmeId: 'programme-1', intakeYear: '26/27', archiveId: 'gone' },
        'tutor-a',
      ),
    ).rejects.toThrow('Select the ZIP')
  })
  it('retains batches and PDF bytes through backup/restore, and reset removes imported batches', async () => {
    const imported = await importZip()
    const data = (await storage.readDataset())!
    const { backupId } = await commandDemo({ op: 'backup' }, 'admin-a')
    const backup = takeBackup(backupId!)!
    await validateBackup(backup)
    await commandDemo({ op: 'reset' }, 'admin-a')
    expect((await storage.readDataset())!.batches!.some((b) => b.id === imported.id)).toBe(false)
    await commandDemo({ op: 'restore', backupId: stageBackup(backup) }, 'admin-a')
    expect((await storage.readDataset())!.batches).toEqual(data.batches)
    const docId = data.applications.find((a) => a.batchId === imported.id)!.documentIds[0]
    expect(await (await storage.readFile(docId))!.text()).toBe('original cv')
  })
  it('rejects inconsistent batch references in a backup before replacing browser data', async () => {
    await importZip()
    const { backupId } = await commandDemo({ op: 'backup' }, 'admin-a')
    const backup = takeBackup(backupId!)!
    for (const change of [
      (b: Backup) => {
        b.dataset.batches!.push(b.dataset.batches![0])
      },
      (b: Backup) => {
        b.dataset.applications[0].batchId = 'missing'
      },
      (b: Backup) => {
        b.dataset.batches![0].programmeId = 'programme-2'
      },
      (b: Backup) => {
        b.dataset.batches![0].intakeYear = '2025 / 26'
      },
      (b: Backup) => {
        b.dataset.batches!.at(-1)!.uploadedBy = 'missing-user'
      },
    ]) {
      const corrupt = structuredClone(backup)
      change(corrupt)
      await expect(validateBackup(corrupt)).rejects.toThrow('valid, intact')
    }
  })
  it('removes batches, import audit and originals when their owned workspace is deleted', async () => {
    const workspace = await commandDemo({ op: 'workspace', name: 'COMP0003' }, 'tutor-a')
    const { id } = await importZip(makeZip(), workspace.id!)
    const data = (await storage.readDataset())!
    const docId = data.applications.find((a) => a.batchId === id)!.documentIds[0]
    await commandDemo({ op: 'deleteWorkspace', id: workspace.id!, confirmed: true }, 'tutor-a')
    const saved = (await storage.readDataset())!
    expect(saved.batches!.some((b) => b.id === id)).toBe(false)
    expect(saved.audit.some((e) => e.target === id)).toBe(false)
    expect(await storage.readFile(docId)).toBeUndefined()
  })
  it('surfaces a storage failure without persisting the prepared batch or PDFs', async () => {
    const before = (await storage.readDataset())!
    const write = storage.writeDataset
    const spy = vi
      .spyOn(storage, 'writeDataset')
      .mockImplementation(async (data, files, ...rest) => {
        if (files && Object.keys(files).length) throw new Error('Storage full')
        await write(data, files, ...rest)
      })
    try {
      await expect(importZip()).rejects.toThrow('Storage full')
      expect(await storage.readDataset()).toEqual(before)
    } finally {
      spy.mockRestore()
    }
  })
})
