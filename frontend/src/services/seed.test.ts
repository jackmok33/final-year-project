import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BatchSummary, Dataset } from '../domain/types'
import { application, documents, rubric, run } from '../test/fixtures'
import { commandDemo, queryDemo } from './demo'
import { inspectPdf } from './pdf'
import { simulateRun } from './seed'
import * as storage from './storage'
vi.mock('./pdf', () => ({ inspectPdf: vi.fn() }))
describe('persistent ZIP upload batches', () => {
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
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async (file: File) => {
      const text = await file.text()
      if (text === 'bad') throw new Error('Unreadable PDF')
      return { pages: text === 'large' ? 60 : 1 }
    })
  })
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
      [5, 5],
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
})
describe('Existing module behaviour', () => {
  describe('honest synthetic assessment fixtures', () => {
    it.each(['offer', 'reject', 'review'] as const)(
      'makes the %s fixture traceable to its rubric and source pages',
      (fixture) => {
        const result = simulateRun({ ...application, fixture }, documents, rubric, 74, true)
        expect(result.rubricId).toBe(rubric.id)
        expect(result.parentRunId).toBe(run.id)
        expect(result.status).toBe('queued')
        expect(result.justification.citations).toHaveLength(3)
        expect(result.justification.citations[0].page).toBe(2)
        expect(result.overall).not.toBeNull()
        expect(result.recommendation).toBe(
          fixture === 'offer' ? 'Offer' : fixture === 'reject' ? 'Reject' : 'Further review',
        )
      },
    )
    it('never fabricates scores/citations for user uploads or unsupported correction values', () => {
      for (const app of [{ ...application, fixture: undefined }, application]) {
        const result = simulateRun(app, documents, rubric, 79, true)
        expect(result.overall).toBeNull()
        expect(result.sections.every((s) => s.score === null && !s.citations.length)).toBe(true)
        expect(result.flags).toContainEqual(
          expect.objectContaining({ code: 'BACKEND_UNAVAILABLE', critical: true }),
        )
        expect(result.recommendation).toBe('Further review')
      }
    })
    it('preserves a grade mismatch as an unresolved concern even for a high score', () => {
      const result = simulateRun(
        { ...application, fixture: 'review' },
        documents,
        { ...rubric, offerFrom: 95 },
        71,
        true,
      )
      expect(result.flags).toContainEqual(expect.objectContaining({ code: 'GRADE_MISMATCH' }))
      expect(result.justification.summary).toContain('cannot resolve this critical contradiction')
      expect(result.recommendation).toBe('Further review')
    })
    it('withholds the overall score if required evidence is missing', () => {
      const result = simulateRun(
        { ...application, fixture: 'missing' },
        documents.slice(0, 2),
        rubric,
        74,
        true,
      )
      expect(result.overall).toBeNull()
      expect(result.sections[2].score).toBeNull()
      expect(result.justification.summary).toContain('required document is missing')
      expect(result.flags).toContainEqual(expect.objectContaining({ code: 'MISSING_DOCUMENT' }))
    })
    it('supports simulated service recovery without treating the failed run as successful', () => {
      const failed = simulateRun(
        { ...application, fixture: 'failed' },
        documents,
        rubric,
        74,
        false,
      )
      expect(failed.error).toBe('MODEL_UNAVAILABLE')
      expect(failed.overall).toBeNull()
      const recovered = simulateRun(
        { ...application, fixture: 'failed' },
        documents,
        rubric,
        74,
        true,
      )
      expect(recovered.error).toBeUndefined()
      expect(recovered.overall).not.toBeNull()
    })
  })
})
