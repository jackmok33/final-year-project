import { strToU8, zipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Backup, Dataset } from '../../domain/types'
import {
  commandDemo,
  queryDemo,
  releaseArchive,
  stageArchive,
  stageBackup,
  takeBackup,
  validateBackup,
} from '../demo'
import { inspectPdf } from '../pdf'
import * as storage from '../storage'
import { readDataset, readFile, writeDataset } from '../storage'
vi.mock('../pdf', () => ({ inspectPdf: vi.fn() }))
describe('persistent browser demo contract', () => {
  const id = 'APP-2026-0142'
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async (file: File) => ({
      pages: file.name.includes('large') ? 60 : 4,
    }))
  })
  it('backs up/restores PDFs and history, rejects tampering, deletes blobs and resets fixtures', async () => {
    const exported = await commandDemo({ op: 'backup' }, 'admin-a')
    const backup = takeBackup(exported.backupId!)!
    const checked = await validateBackup(backup)
    expect(Object.keys(checked.files)).toHaveLength(25)
    const corrupt = structuredClone(backup)
    corrupt.files[0].base64 = btoa('corrupt')
    await expect(validateBackup(corrupt)).rejects.toThrow('intact')
    const invalidCitation = structuredClone(backup)
    invalidCitation.dataset.applications[0].runs[0].justification.citations[0].page = 99
    await expect(validateBackup(invalidCitation)).rejects.toThrow('intact')
    await commandDemo({ op: 'delete', id }, 'admin-a')
    expect(await readFile(`${id}-transcript`)).toBeUndefined()
    expect((await readDataset())!.applications).toHaveLength(8)
    await commandDemo({ op: 'restore', backupId: stageBackup(backup) }, 'admin-a')
    expect(await readFile(`${id}-transcript`)).toBeDefined()
    expect((await readDataset())!.applications).toHaveLength(9)
    expect((await readDataset())!.audit.at(-1)?.action).toContain('Restore')
    await commandDemo({ op: 'reset' }, 'admin-a')
    expect((await readDataset())!.applications[0].runs[0].extractedGrade).toBe(71)
  })
})
describe('backup reference integrity', () => {
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async () => ({ pages: 4 }))
  })
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
})
describe('persistent module intakes', () => {
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async () => ({ pages: 1 }))
  })
  it('accepts legacy backups without an intake field and rejects corrupt intake metadata', async () => {
    const { backupId } = await commandDemo({ op: 'backup' }, 'admin-a')
    const backup = takeBackup(backupId!) as Backup
    delete backup.dataset.applications[0].intakeYear
    await validateBackup(backup)
    backup.dataset.applications[0].intakeYear = ' '
    await expect(validateBackup(backup)).rejects.toThrow('valid, intact')
  })
})
describe('private tutor courses', () => {
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  it('migrates old shared backups without changing PDFs, IDs or review history', async () => {
    const exported = await commandDemo({ op: 'backup' }, 'admin-a')
    const backup = takeBackup(exported.backupId!)!
    backup.dataset.programmes.forEach((p) => {
      delete p.createdBy
    })
    backup.dataset.users.find((u) => u.id === 'tutor-b')!.programmeIds = ['programme-1']
    const before = structuredClone(backup)
    const migrated = await validateBackup(backup)
    expect(backup).toEqual(before)
    expect(migrated.dataset.users.find((u) => u.id === 'tutor-b')!.programmeIds).toEqual([])
    expect(migrated.dataset.programmes.every((p) => p.createdBy === 'tutor-a')).toBe(true)
    await commandDemo({ op: 'restore', backupId: stageBackup(backup) }, 'admin-a')
    const saved = (await readDataset())!
    expect(saved.applications).toEqual(before.dataset.applications)
    expect(saved.documents).toEqual(before.dataset.documents)
    const file = saved.documents[0]
    expect(await (await readFile(file.id))!.arrayBuffer()).toEqual(
      await migrated.files[file.id].arrayBuffer(),
    )
  })
})
describe('workspace backup integrity', () => {
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  it('preserves ownership across metadata edits and rejects invalid owners in backups', async () => {
    const { id: createdId } = await commandDemo(
      { op: 'workspace', name: 'Data Science MSc' },
      'tutor-a',
    )
    const id = createdId!
    const data = (await readDataset())!
    const programme = data.programmes.find((p) => p.id === id)!
    await commandDemo(
      { op: 'programme', programme: { ...programme, name: 'Renamed', createdBy: 'tutor-b' } },
      'admin-a',
    )
    expect((await readDataset())!.programmes.find((p) => p.id === id)?.createdBy).toBe('tutor-a')
    const exported = await commandDemo({ op: 'backup' }, 'admin-a')
    const backup = takeBackup(exported.backupId!)!
    backup.dataset.programmes.find((p) => p.id === id)!.createdBy = 'missing-user'
    await expect(validateBackup(backup)).rejects.toThrow('valid, intact')
  })
  it('backs up and restores an empty course dataset without recreating example courses', async () => {
    const empty = (await readDataset())!
    empty.programmes = []
    empty.rubrics = []
    empty.activeRubricIds = {}
    empty.applications = []
    empty.batches = []
    empty.documents = []
    empty.users.forEach((user) => {
      user.programmeIds = []
    })
    await writeDataset(empty, {}, [], true)
    const { backupId } = await commandDemo({ op: 'backup' }, 'admin-a')
    const backup = takeBackup(backupId!)!
    await validateBackup(backup)
    await commandDemo({ op: 'reset' }, 'admin-a')
    await commandDemo({ op: 'restore', backupId: stageBackup(backup) }, 'admin-a')
    expect(await queryDemo({ op: 'programmes' }, 'tutor-a')).toEqual([])
    expect((await readDataset())!.rubrics).toEqual([])
    expect((await readDataset())!.documents).toEqual([])
    await expect(
      commandDemo({ op: 'workspace', name: 'New Course' }, 'tutor-a'),
    ).resolves.toHaveProperty('id')
  })
})
