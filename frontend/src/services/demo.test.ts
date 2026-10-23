import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Dataset } from '../domain/types'
import type { Command } from './demo'
import {
  authorizedFile,
  commandDemo,
  queryDemo,
  stageBackup,
  stageUploads,
  takeBackup,
  validateBackup,
} from './demo'
import { inspectPdf } from './pdf'
import { simulateRun } from './seed'
import { readDataset, writeDataset } from './storage'
vi.mock('./pdf', () => ({ inspectPdf: vi.fn() }))
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
  it('lets one tutor own several courses with independent criteria and private queues', async () => {
    const result = await commandDemo({ op: 'workspace', name: 'Robotics MSc' }, 'tutor-b')
    await commandDemo({ op: 'workspace', name: 'Data Science MSc' }, 'tutor-b')
    const data = (await readDataset())!
    expect(data.programmes).toHaveLength(5)
    expect(data.rubrics.find((r) => r.id === data.activeRubricIds[result.id!])?.programmeId).toBe(
      result.id,
    )
    expect(await queryDemo({ op: 'programmes' }, 'tutor-b')).toHaveLength(2)
    expect(await queryDemo({ op: 'applications', programmeId: result.id! }, 'tutor-b')).toEqual([])
    const refs = stageUploads([
      {
        type: 'transcript',
        file: new File(['pdf'], 'transcript.pdf', { type: 'application/pdf' }),
      },
    ])
    const created = await commandDemo(
      { op: 'create', candidate: 'SYN-C', programmeId: result.id!, uploads: refs },
      'tutor-b',
    )
    await commandDemo({ op: 'evaluate', id: created.id! }, 'tutor-b')
    const app = (await readDataset())!.applications.find((a) => a.id === created.id)!
    expect(app.programmeId).toBe(result.id)
    expect(app.runs[0].rubricId).toBe(data.activeRubricIds[result.id!])
    const exported = await commandDemo({ op: 'backup' }, 'admin-a')
    expect((await validateBackup(takeBackup(exported.backupId!)!)).dataset.programmes).toHaveLength(
      5,
    )
  })
})
describe('service mutation validation and failure atomicity', () => {
  let data: Dataset
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
    data = (await readDataset())!
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async () => ({ pages: 4 }))
  })
  it.each([
    [
      'blank candidate',
      () => ({ op: 'create', candidate: ' ', programmeId: 'programme-1', uploads: [] }),
      'tutor-a',
    ],
    ['missing application', () => ({ op: 'evaluate', id: 'missing' }), 'tutor-a'],
    [
      'stale decision run',
      () => ({
        op: 'decide',
        id: data.applications[1].id,
        runId: 'old-run',
        outcome: 'Unconditional',
        reason: '',
      }),
      'tutor-a',
    ],
    [
      'stale correction run',
      () => ({
        op: 'correct',
        id: data.applications[0].id,
        runId: 'old-run',
        value: 74,
        reason: 'Fix',
        documentId: data.applications[0].documentIds[0],
        page: 2,
      }),
      'tutor-a',
    ],
    ['blank user', () => ({ op: 'user', user: { ...data.users[0], name: ' ' } }), 'admin-a'],
    [
      'invalid email',
      () => ({ op: 'user', user: { ...data.users[0], email: 'not-email' } }),
      'admin-a',
    ],
    [
      'unconfigured course access',
      () => ({ op: 'user', user: { ...data.users[0], programmeIds: ['missing'] } }),
      'admin-a',
    ],
    [
      'duplicate email',
      () => ({ op: 'user', user: { ...data.users[0], email: data.users[1].email.toUpperCase() } }),
      'admin-a',
    ],
    [
      'blank programme name',
      () => ({ op: 'programme', programme: { ...data.programmes[0], name: '' } }),
      'admin-a',
    ],
    [
      'invalid module code',
      () => ({ op: 'programme', programme: { ...data.programmes[0], code: 'COMP 0003' } }),
      'admin-a',
    ],
    [
      'duplicate programme code',
      () => ({
        op: 'programme',
        programme: { ...data.programmes[0], code: data.programmes[1].code.toLowerCase() },
      }),
      'admin-a',
    ],
    [
      'missing programme',
      () => ({ op: 'programme', programme: { ...data.programmes[0], id: 'missing' } }),
      'admin-a',
    ],
    ['missing deletion target', () => ({ op: 'delete', id: 'missing' }), 'admin-a'],
    [
      'invalid criteria weights',
      () => ({
        op: 'rubric',
        rubric: { ...data.rubrics[0], weights: { academic: 0, cv: 0, statement: 0 } },
      }),
      'tutor-a',
    ],
  ] as const)('rejects %s without modifying records', async (_name, makeCommand, actor) => {
    await expect(commandDemo(makeCommand() as Command, actor)).rejects.toThrow()
    expect(await readDataset()).toEqual(data)
  })
  it('rejects missing originals for downloads and backups', async () => {
    await expect(authorizedFile('missing', 'tutor-a')).rejects.toThrow('Document not found')
    await writeDataset(data, {}, [data.documents[0].id])
    await expect(authorizedFile(data.documents[0].id, 'tutor-a')).rejects.toThrow(
      'missing from browser storage',
    )
    await expect(commandDemo({ op: 'backup' }, 'admin-a')).rejects.toThrow('missing or changed')
  })
})
describe('HTTP evaluation transactions', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8000/api/v1')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('does not persist a failed HTTP evaluation or half of a correction', async () => {
    const before = (await readDataset())!
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Backend offline')))
    const app = before.applications[0]
    for (const operation of [
      { op: 'evaluate' as const, id: app.id },
      {
        op: 'correct' as const,
        id: app.id,
        runId: app.runs[0].id,
        value: 74,
        reason: 'Transcript verified',
        documentId: app.documentIds[0],
        page: 2,
      },
    ]) {
      await expect(commandDemo(operation, 'tutor-a')).rejects.toThrow('Cannot reach')
      expect(await readDataset()).toEqual(before)
    }
  })
  it('retains backend runs, original history and PDF references across reload and backup/restore', async () => {
    const data = (await readDataset())!
    const app = data.applications[0]
    const run = {
      ...simulateRun(
        app,
        data.documents.filter((d) => d.applicationId === app.id),
        data.rubrics[0],
        71,
        false,
      ),
      status: 'awaiting review' as const,
      evaluationSource: 'fastapi-mock' as const,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(run)))
    await commandDemo({ op: 'evaluate', id: app.id }, 'tutor-a')
    const reloaded = (await queryDemo({ op: 'application', id: app.id }, 'tutor-a')) as {
      application: typeof app
    }
    expect(reloaded.application.runs).toHaveLength(2)
    expect(reloaded.application.runs[0]).toEqual(app.runs[0])
    expect(reloaded.application.runs[1]).toEqual(run)
    const { backupId } = await commandDemo({ op: 'backup' }, 'admin-a')
    const backup = takeBackup(backupId!)!
    expect(backup.files).toHaveLength(data.documents.length)
    await commandDemo({ op: 'reset' }, 'admin-a')
    await commandDemo({ op: 'restore', backupId: stageBackup(backup) }, 'admin-a')
    expect((await readDataset())!.applications[0].runs[1]).toEqual(run)
  })
  it('checks tutor permissions before sending any request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(commandDemo({ op: 'evaluate', id: 'APP-2026-0142' }, 'admin-a')).rejects.toThrow(
      'tutor access',
    )
    await expect(commandDemo({ op: 'evaluate', id: 'APP-2026-0147' }, 'tutor-b')).rejects.toThrow(
      'tutor access',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
