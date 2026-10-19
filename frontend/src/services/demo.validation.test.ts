import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  authorizedFile,
  commandDemo,
  queryDemo,
  releaseUploads,
  stageUploads,
  stageBackup,
  takeBackup,
  discardBackup,
  validateBackup,
} from './demo'
import type { Command } from './demo'
import type { Backup, Dataset } from '../domain/types'
import { readDataset, writeDataset } from './storage'
vi.mock('./pdf', () => ({ inspectPdf: vi.fn(async () => ({ pages: 4 })) }))
let data: Dataset
beforeEach(async () => {
  await queryDemo({ op: 'accounts' }, null)
  await commandDemo({ op: 'reset' }, 'admin-a')
  data = (await readDataset())!
})
describe('service mutation validation and failure atomicity', () => {
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
        outcome: 'Offer',
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
  it('prevents simultaneous evaluation of the same case but serialises unrelated writes', async () => {
    const id = data.applications[1].id
    const results = await Promise.allSettled([
      commandDemo({ op: 'evaluate', id }, 'tutor-a'),
      commandDemo({ op: 'evaluate', id }, 'tutor-a'),
    ])
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected'])
    expect((await readDataset())!.applications[1].runs).toHaveLength(2)
    await commandDemo({ op: 'model', available: false }, 'admin-a')
    expect((await readDataset())!.modelAvailable).toBe(false)
  })
  it('removes tutor permissions when an account becomes admin-only', async () => {
    await commandDemo(
      { op: 'user', user: { ...data.users[0], roles: ['admin'], canPublishCriteria: true } },
      'admin-a',
    )
    const saved = (await readDataset())!.users[0]
    expect(saved.programmeIds).toEqual([])
    expect(saved.canPublishCriteria).toBe(false)
  })
  it('retries failed seeded cases after service recovery and records operational audit events', async () => {
    const failed = data.applications.find((a) => a.fixture === 'failed')!
    await commandDemo({ op: 'model', available: true }, 'admin-a')
    await commandDemo({ op: 'evaluate', id: failed.id }, 'tutor-a')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 5000)
    try {
      const health = await queryDemo({ op: 'health' }, 'admin-a')
      expect(health).toMatchObject({ modelAvailable: true, queued: 0, failed: 0 })
      expect(await queryDemo({ op: 'audit' }, 'admin-a')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: 'Change simulated service availability' }),
        ]),
      )
    } finally {
      vi.useRealTimers()
    }
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
describe('backup reference integrity', () => {
  const mutations: [string, (backup: Backup) => void][] = [
    [
      'wrong format',
      (b) => {
        b.format = 'other' as Backup['format']
      },
    ],
    [
      'version mismatch',
      (b) => {
        b.version = 99 as 2
      },
    ],
    [
      'missing arrays',
      (b) => {
        b.dataset.audit = null as unknown as Dataset['audit']
      },
    ],
    [
      'empty programmes',
      (b) => {
        b.dataset.programmes = []
      },
    ],
    [
      'invalid role',
      (b) => {
        b.dataset.users[0].roles = ['unknown'] as never
      },
    ],
    [
      'unknown user programme',
      (b) => {
        b.dataset.users[0].programmeIds = ['missing']
      },
    ],
    [
      'missing active rubric',
      (b) => {
        b.dataset.activeRubricIds['programme-1'] = 'missing'
      },
    ],
    [
      'duplicate account IDs',
      (b) => {
        b.dataset.users[1].id = b.dataset.users[0].id
      },
    ],
    [
      'orphan application',
      (b) => {
        b.dataset.applications[0].programmeId = 'missing'
      },
    ],
    [
      'invalid document page count',
      (b) => {
        b.dataset.documents[0].pages = 0
      },
    ],
    [
      'orphan document IDs',
      (b) => {
        b.dataset.applications[0].documentIds.push('missing')
      },
    ],
    [
      'invalid fixture',
      (b) => {
        b.dataset.applications[0].fixture = 'unknown' as never
      },
    ],
    [
      'invalid run reference',
      (b) => {
        b.dataset.applications[0].runs[0].applicationId = 'missing'
      },
    ],
    [
      'orphan correction',
      (b) => {
        b.dataset.applications[0].corrections.push({
          id: 'c',
          runId: 'missing',
          value: 74,
          original: 71,
          reason: 'Fix',
          citation: b.dataset.applications[0].runs[0].justification.citations[0],
          actor: 'tutor-a',
          at: b.createdAt,
        })
      },
    ],
    [
      'orphan decision',
      (b) => {
        b.dataset.applications[0].decisions.push({
          id: 'd',
          runId: 'missing',
          recommendation: 'Offer',
          outcome: 'Offer',
          reason: '',
          actor: 'tutor-a',
          at: b.createdAt,
        })
      },
    ],
    [
      'invalid audit event',
      (b) => {
        b.dataset.audit[0].actor = 7 as unknown as string
      },
    ],
    [
      'missing PDF',
      (b) => {
        b.files.pop()
      },
    ],
    [
      'wrong PDF hash',
      (b) => {
        b.files[0].hash = 'wrong'
      },
    ],
  ]
  it.each(mutations)(
    'rejects %s and leaves the current browser dataset intact',
    async (_name, mutate) => {
      const result = await commandDemo({ op: 'backup' }, 'admin-a')
      const backup = takeBackup(result.backupId!)!
      const original = (await readDataset())!
      mutate(backup)
      await expect(validateBackup(backup)).rejects.toThrow('valid, intact')
      expect(await readDataset()).toEqual(original)
    },
  )
  it('requires restore to retain the current active administrator', async () => {
    const result = await commandDemo({ op: 'backup' }, 'admin-a')
    const backup = takeBackup(result.backupId!)!
    const original = (await readDataset())!
    backup.dataset.users.find((u) => u.id === 'admin-a')!.active = false
    await expect(
      commandDemo({ op: 'restore', backupId: stageBackup(backup) }, 'admin-a'),
    ).rejects.toThrow('retain your active administrator')
    expect(await readDataset()).toEqual(original)
  })
  it('consumes or discards temporary backup references without persisting them', () => {
    const backup = {
      format: 'ucl-admissions-demo',
      version: 2,
      createdAt: '',
      dataset: data,
      files: [],
    } as Backup
    const first = stageBackup(backup)
    expect(takeBackup(first)).toBe(backup)
    expect(takeBackup(first)).toBeUndefined()
    const second = stageBackup(backup)
    discardBackup(second)
    expect(takeBackup(second)).toBeUndefined()
  })
})
