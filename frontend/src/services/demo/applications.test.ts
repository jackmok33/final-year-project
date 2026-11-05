import { resetDemo } from '../../test/resetDemo'
import { strToU8, zipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Application, BatchSummary, Dataset, UploadBatch } from '../../domain/types'
import { run } from '../../test/fixtures'
import { applicantEvidence } from '../applicantPresentation'
import type { Command } from '../demo'
import {
  commandDemo,
  queryDemo,
  releaseArchive,
  releaseUploads,
  stageArchive,
  stageUploads,
} from '../demo'
import { inspectPdf } from '../pdf'
import * as storage from '../storage'
import { readDataset, readFile, writeDataset } from '../storage'
vi.mock('../pdf', () => ({ inspectPdf: vi.fn() }))
describe('persistent browser demo contract', () => {
  const id = 'APP-2026-0142'
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await resetDemo()
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async (file: File) => ({
      pages: file.name.includes('large') ? 60 : 4,
    }))
  })
  it('preserves original facts/runs, refresh recovery and recorded decisions after a correction', async () => {
    const data = (await readDataset())!
    const app = data.applications.find((a) => a.id === id)!
    const run = app.runs[0]
    // A historical review record is retained, but can no longer be submitted as a new decision.
    app.decisions.push({
      id: 'legacy-review',
      runId: run.id,
      recommendation: run.recommendation,
      outcome: 'Further review',
      reason: 'Verify grade',
      actor: 'tutor-a',
      at: run.finishAt,
    })
    await writeDataset(data)
    await commandDemo(
      {
        op: 'correct',
        id,
        runId: run.id,
        value: 74,
        reason: 'Transcript states 74%.',
        documentId: `${id}-transcript`,
        page: 2,
      },
      'tutor-a',
    )
    const saved = (await readDataset())!.applications.find((a) => a.id === id)!
    expect(saved.runs).toHaveLength(2)
    expect(saved.runs[0].extractedGrade).toBe(71)
    expect(saved.corrections[0].original).toBe(71)
    expect(saved.decisions).toHaveLength(1)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.now() + 5000))
    try {
      const fresh = (await queryDemo({ op: 'application', id }, 'tutor-a')) as {
        application: Application
      }
      expect(fresh.application.runs[1].status).toBe('awaiting review')
      expect(fresh.application.runs[1].flags.some((f) => f.code === 'GRADE_MISMATCH')).toBe(false)
      expect(fresh.application.runs[1].overall).toBe(78.4)
    } finally {
      vi.useRealTimers()
    }
  })
  it('requires correction evidence and deduplicates a repeated decision', async () => {
    const data = (await readDataset())!
    const app = data.applications[0]
    const run = app.runs[0]
    await expect(
      commandDemo(
        {
          op: 'correct',
          id,
          runId: run.id,
          value: 74,
          reason: '',
          documentId: `${id}-transcript`,
          page: 2,
        },
        'tutor-a',
      ),
    ).rejects.toThrow('reason')
    await expect(
      commandDemo(
        {
          op: 'correct',
          id,
          runId: run.id,
          value: 74,
          reason: 'fix',
          documentId: `${id}-transcript`,
          page: 99,
        },
        'tutor-a',
      ),
    ).rejects.toThrow('page')
    const cmd = {
      op: 'decide',
      id,
      runId: run.id,
      outcome: 'Reject',
      reason: '',
    } as const
    await commandDemo(cmd, 'tutor-a')
    await commandDemo(cmd, 'tutor-a')
    expect((await readDataset())!.applications.find((a) => a.id === id)!.decisions).toHaveLength(1)
  })
  it.each([
    ['APP-2026-0143', 'Reject', ''],
    ['APP-2026-0144', 'Unconditional', '   '],
    ['APP-2026-0143', 'Conditional', ''],
    ['APP-2026-0143', 'Reject', '  Checked the original evidence.  '],
  ] as const)(
    'records %s as %s independently of the AI recommendation with an optional note',
    async (applicationId, outcome, reason) => {
      const before = (await readDataset())!.applications.find((a) => a.id === applicationId)!
      const run = before.runs.at(-1)!
      expect(run.recommendation).not.toBe(outcome)
      await commandDemo(
        {
          op: 'decide',
          id: applicationId,
          runId: run.id,
          outcome,
          reason,
        },
        'tutor-a',
      )
      const after = (await readDataset())!.applications.find((a) => a.id === applicationId)!
      expect(after.decisions.at(-1)).toMatchObject({
        outcome,
        recommendation: run.recommendation,
        reason: reason.trim(),
        runId: run.id,
        actor: 'tutor-a',
      })
      expect(after.runs).toEqual(before.runs)
    },
  )
  it('preserves unsupported corrections without creating fixture scores on subsequent runs', async () => {
    const data = (await readDataset())!
    await commandDemo(
      {
        op: 'correct',
        id,
        runId: data.applications[0].runs[0].id,
        value: 79,
        reason: 'Demo value without a matching assessment fixture.',
        documentId: `${id}-transcript`,
        page: 2,
      },
      'tutor-a',
    )
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.now() + 5000))
    try {
      await queryDemo({ op: 'application', id }, 'tutor-a')
      await commandDemo({ op: 'evaluate', id }, 'tutor-a')
      const app = (await readDataset())!.applications.find((a) => a.id === id)!
      expect(app.corrections[0].value).toBe(79)
      expect(app.runs.at(-1)?.overall).toBeNull()
      expect(app.runs.at(-1)?.sections.every((s) => s.score === null && !s.citations.length)).toBe(
        true,
      )
      expect(app.runs.at(-1)?.recommendation).toBe('Further review')
    } finally {
      vi.useRealTimers()
    }
  })
  it('validates total upload pages and never fabricates an assessment for new documents', async () => {
    const refs = stageUploads([
      {
        type: 'transcript',
        file: new File(['pdf'], 'large-transcript.pdf', { type: 'application/pdf' }),
      },
      { type: 'cv', file: new File(['pdf'], 'large-cv.pdf', { type: 'application/pdf' }) },
    ])
    await expect(
      commandDemo(
        { op: 'create', candidate: 'SYN-NEW', programmeId: 'programme-1', uploads: refs },
        'tutor-a',
      ),
    ).rejects.toThrow('100 pages')
    expect((await readDataset())!.applications).toHaveLength(9)
    const valid = stageUploads([
      {
        type: 'transcript',
        file: new File(['pdf'], 'transcript.pdf', { type: 'application/pdf' }),
      },
    ])
    const created = await commandDemo(
      { op: 'create', candidate: 'SYN-NEW', programmeId: 'programme-1', uploads: valid },
      'tutor-a',
    )
    await commandDemo({ op: 'evaluate', id: created.id! }, 'tutor-a')
    const newApp = (await readDataset())!.applications.find((a) => a.id === created.id)!
    expect(created.batchId).toBeTruthy()
    expect(created.batchId).toBe(newApp.batchId)
    expect((await readDataset())!.batches?.find((b) => b.id === created.batchId)).toMatchObject({
      programmeId: newApp.programmeId,
      intakeYear: newApp.intakeYear,
    })
    expect(newApp.runs[0].overall).toBeNull()
    expect(newApp.runs[0].flags.some((f) => f.code === 'BACKEND_UNAVAILABLE')).toBe(true)
  })
})
describe('service mutation validation and failure atomicity', () => {
  let data: Dataset
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await resetDemo()
    data = (await readDataset())!
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async () => ({ pages: 4 }))
  })
  it('persists six document types and two original references without changing older applications', async () => {
    const types = [
      'transcript',
      'cv',
      'statement',
      'application_form',
      'english_test',
      'reference',
      'reference',
    ] as const
    const refs = stageUploads(
      types.map((type, index) => ({
        type,
        file: new File([`original-${index}`], `${type}-${index}.pdf`, { type: 'application/pdf' }),
      })),
    )
    try {
      const result = await commandDemo(
        { op: 'create', candidate: 'SYN-PACKET', programmeId: 'programme-1', uploads: refs },
        'tutor-a',
      )
      const saved = (await readDataset())!
      const app = saved.applications.find((a) => a.id === result.id)!
      expect(app.documentIds).toHaveLength(7)
      expect(saved.documents.filter((d) => d.applicationId === app.id).map((d) => d.type)).toEqual(
        types,
      )
      for (const [index, id] of app.documentIds.entries())
        expect(await (await readFile(id))!.text()).toBe(`original-${index}`)
      expect(saved.applications.filter((a) => a.id !== app.id)).toEqual(data.applications)
      expect(app.runs).toEqual([])
    } finally {
      releaseUploads(refs)
    }
  })
  it('aborts an expanded packet when a later reference cannot be validated', async () => {
    const refs = stageUploads(
      ['good.pdf', 'bad.pdf'].map((name) => ({
        type: 'reference' as const,
        file: new File(['pdf'], name, { type: 'application/pdf' }),
      })),
    )
    vi.mocked(inspectPdf)
      .mockResolvedValueOnce({ pages: 1 })
      .mockRejectedValueOnce(new Error('Unreadable reference'))
    try {
      await expect(
        commandDemo(
          { op: 'create', candidate: 'SYN-BAD', programmeId: 'programme-1', uploads: refs },
          'tutor-a',
        ),
      ).rejects.toThrow('Unreadable reference')
      expect(await readDataset()).toEqual(data)
    } finally {
      releaseUploads(refs)
    }
  })
  it('releases upload references and rejects duplicate document types without partial records', async () => {
    const file = new File(['pdf'], 'transcript.pdf', { type: 'application/pdf' })
    const refs = stageUploads([
      { file, type: 'transcript' },
      { file, type: 'transcript' },
    ])
    await expect(
      commandDemo(
        { op: 'create', candidate: 'SYN-NEW', programmeId: 'programme-1', uploads: refs },
        'tutor-a',
      ),
    ).rejects.toThrow('one document per type')
    releaseUploads(refs)
    await expect(
      commandDemo(
        { op: 'create', candidate: 'SYN-NEW', programmeId: 'programme-1', uploads: [refs[0]] },
        'tutor-a',
      ),
    ).rejects.toThrow('no longer available')
    expect(await readDataset()).toEqual(data)
  })
  it('retries failed seeded cases after service recovery and records operational audit events', async () => {
    const failed = data.applications.find((a) => a.fixture === 'failed')!
    data.modelAvailable = true
    await writeDataset(data)
    await commandDemo({ op: 'evaluate', id: failed.id }, 'tutor-a')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 5000)
    try {
      await queryDemo({ op: 'application', id: failed.id }, 'tutor-a')
      const saved = (await readDataset())!
      const completed = saved.applications.find((a) => a.id === failed.id)!.runs.at(-1)!
      expect(completed.status).toBe('awaiting review')
      expect(completed.error).toBeUndefined()
      expect(saved.audit).toContainEqual(
        expect.objectContaining({ action: 'Start simulated evaluation', target: failed.id }),
      )
    } finally {
      vi.useRealTimers()
    }
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
    await resetDemo()
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async (file: File) => {
      const text = await file.text()
      if (text === 'bad') throw new Error('Unreadable PDF')
      return { pages: text === 'large' ? 60 : 1 }
    })
  })
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
describe('persistent module intakes', () => {
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await resetDemo()
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async () => ({ pages: 1 }))
  })
  it('stores the selected intake, separates its queue, and preserves original PDFs', async () => {
    const refs = stageUploads([
      {
        type: 'transcript',
        file: new File(['%PDF-1.7'], 'Original.pdf', { type: 'application/pdf' }),
      },
    ])
    try {
      const { id } = await commandDemo(
        {
          op: 'create',
          programmeId: 'programme-1',
          intakeYear: '25/26',
          candidate: 'OLDER-INTAKE',
          uploads: refs,
        },
        'tutor-a',
      )
      const older = (await queryDemo(
        { op: 'applications', programmeId: 'programme-1', intakeYear: '2025 / 26' },
        'tutor-a',
      )) as Application[]
      const current = (await queryDemo(
        { op: 'applications', programmeId: 'programme-1', intakeYear: '2026 / 27' },
        'tutor-a',
      )) as Application[]
      expect(older.map((a) => a.id)).toEqual([id])
      expect(older[0].intakeYear).toBe('2025 / 26')
      expect(older[0].runs).toEqual([])
      expect(current).toHaveLength(8)
      const fileId = older[0].documentIds[0]
      const bytes = await (await readFile(fileId))!.arrayBuffer()
      await queryDemo({ op: 'application', id: id! }, 'tutor-a')
      expect((await readDataset())!.applications.find((a) => a.id === id)!.intakeYear).toBe(
        '2025 / 26',
      )
      expect(await (await readFile(fileId))!.arrayBuffer()).toEqual(bytes)
    } finally {
      releaseUploads(refs)
    }
  })
  it('rejects invalid intake values and keeps year selection within existing module permissions', async () => {
    const refs = stageUploads([{ type: 'cv', file: new File(['%PDF'], 'CV.pdf') }])
    try {
      await expect(
        commandDemo(
          {
            op: 'create',
            programmeId: 'programme-1',
            intakeYear: '2026 / 29',
            candidate: 'INVALID',
            uploads: refs,
          },
          'tutor-a',
        ),
      ).rejects.toThrow('valid intake year')
      await expect(
        queryDemo(
          { op: 'applications', programmeId: 'programme-2', intakeYear: '2025 / 26' },
          'tutor-b',
        ),
      ).rejects.toThrow('tutor access')
      await expect(
        queryDemo(
          { op: 'applications', programmeId: 'programme-1', intakeYear: '2025 / 26' },
          'admin-a',
        ),
      ).rejects.toThrow('tutor access')
    } finally {
      releaseUploads(refs)
    }
  })
})
describe('new tutor decisions and batch actions', () => {
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await resetDemo()
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async () => ({ pages: 1 }))
  })
  it.each(['Conditional', 'Unconditional', 'Reject'] as const)(
    'persists %s despite critical flags without changing assessment evidence',
    async (outcome) => {
      const before = (await readDataset())!.applications.find((a) => a.id === 'APP-2026-0142')!
      expect(before.runs.at(-1)!.flags.some((flag) => flag.critical)).toBe(true)
      await commandDemo(
        { op: 'decide', id: before.id, runId: before.runs.at(-1)!.id, outcome, reason: '' },
        'tutor-a',
      )
      const persisted = (await readDataset())!.applications.find((a) => a.id === before.id)!
      expect(persisted.decisions.at(-1)).toMatchObject({ outcome, actor: 'tutor-a' })
      expect(persisted.runs).toEqual(before.runs)
      expect(persisted.corrections).toEqual(before.corrections)
      const reloaded = await queryDemo({ op: 'application', id: before.id }, 'tutor-a')
      const saved = reloaded.application
      expect(saved.decisions.at(-1)).toMatchObject({
        outcome,
        recommendation: before.runs.at(-1)!.recommendation,
      })
      expect(saved.runs).toEqual(before.runs)
      expect(saved.corrections).toEqual(before.corrections)
    },
  )
  it.each(['Offer', 'Further review'])(
    'rejects obsolete choice %s without writes even when review flags are present',
    async (outcome) => {
      const before = (await readDataset())!
      const ready = before.applications.find((a) => a.id === 'APP-2026-0142')!
      await expect(
        commandDemo(
          {
            op: 'decide',
            id: ready.id,
            runId: ready.runs[0].id,
            outcome,
            reason: '',
          } as unknown as Command,
          'tutor-a',
        ),
      ).rejects.toThrow('valid outcome')
      expect(await readDataset()).toEqual(before)
    },
  )
  it.each(['queued', 'running', 'failed', 'unavailable'] as const)(
    'rejects a %s assessment without writes while ordinary review flags remain advisory',
    async (status) => {
      const data = (await readDataset())!
      const target = data.applications.find((a) => a.id === 'APP-2026-0142')!
      const run = target.runs.at(-1)!
      if (status === 'unavailable') {
        run.flags.push({
          code: 'BACKEND_UNAVAILABLE',
          message: 'Assessment unavailable.',
          critical: true,
        })
      } else {
        run.status = status
        run.startedAt = new Date(Date.now() + (status === 'queued' ? 60_000 : -1_000)).toISOString()
        run.finishAt = new Date(Date.now() + 120_000).toISOString()
      }
      await writeDataset(data)
      for (const outcome of ['Conditional', 'Unconditional', 'Reject'] as const)
        await expect(
          commandDemo(
            { op: 'decide', id: target.id, runId: target.runs.at(-1)!.id, outcome, reason: '' },
            'tutor-a',
          ),
        ).rejects.toThrow('latest successful run')
      expect(await readDataset()).toEqual(data)
    },
  )
  it('requires owner access and confirmation before deleting one applicant and its PDFs', async () => {
    const before = (await readDataset())!
    const target = before.applications.find((a) => a.id === 'APP-2026-0143')!
    for (const user of ['tutor-b', 'admin-a'])
      await expect(
        commandDemo({ op: 'deleteApplicant', id: target.id, confirmed: true }, user),
      ).rejects.toThrow('tutor access')
    await expect(
      commandDemo({ op: 'deleteApplicant', id: target.id, confirmed: false }, 'tutor-a'),
    ).rejects.toThrow('Confirm')
    expect(await readDataset()).toEqual(before)
    await commandDemo({ op: 'deleteApplicant', id: target.id, confirmed: true }, 'tutor-a')
    const after = (await readDataset())!
    expect(after.applications).toEqual(before.applications.filter((a) => a.id !== target.id))
    for (const id of target.documentIds) expect(await readFile(id)).toBeUndefined()
    expect(after.batches).toEqual(before.batches)
  })
  it('adds an unassessed applicant to the chosen batch and rejects mismatched intake scopes', async () => {
    const batches = (await queryDemo(
      { op: 'batches', programmeId: 'programme-1', intakeYear: '26/27' },
      'tutor-a',
    )) as BatchSummary[]
    const batch = batches[0]
    const refs = stageUploads([
      { type: 'cv', file: new File(['original-pdf'], 'cv.pdf', { type: 'application/pdf' }) },
    ])
    try {
      const before = (await readDataset())!
      await expect(
        commandDemo(
          {
            op: 'create',
            candidate: 'New applicant',
            programmeId: batch.programmeId,
            intakeYear: '25/26',
            batchId: batch.id,
            uploads: refs,
          },
          'tutor-a',
        ),
      ).rejects.toThrow('same programme and intake')
      expect(await readDataset()).toEqual(before)
      const result = await commandDemo(
        {
          op: 'create',
          candidate: 'New applicant',
          programmeId: batch.programmeId,
          intakeYear: batch.intakeYear,
          batchId: batch.id,
          uploads: refs,
        },
        'tutor-a',
      )
      const saved = (await readDataset())!.applications.find((a) => a.id === result.id)!
      expect(saved).toMatchObject({
        batchId: batch.id,
        intakeYear: batch.intakeYear,
        runs: [],
        decisions: [],
      })
      expect(applicantEvidence(saved, run)).toEqual([])
      expect(await (await readFile(saved.documentIds[0]))!.text()).toBe('original-pdf')
    } finally {
      releaseUploads(refs)
    }
  })
})
