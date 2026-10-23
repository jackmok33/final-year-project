import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Backup, Dataset, User } from '../../domain/types'
import {
  commandDemo,
  discardBackup,
  queryDemo,
  stageBackup,
  takeBackup,
  validateBackup,
} from '../demo'
import { inspectPdf } from '../pdf'
import { readDataset, readFile, writeDataset } from '../storage'
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
  it('migrates old storage and backups without discarding the original review history or PDFs', async () => {
    const exported = await commandDemo({ op: 'backup' }, 'admin-a')
    const modern = takeBackup(exported.backupId!)!
    const { programmes, activeRubricIds, batches: _batches, ...records } = modern.dataset
    expect(_batches).toHaveLength(4)
    const legacy = {
      ...records,
      version: 1,
      programme: programmes[0],
      activeRubricId: activeRubricIds['programme-1'],
      users: records.users.map((u) => ({
        ...u,
        programmeIds: u.programmeIds.filter((id) => id === 'programme-1'),
      })),
      applications: records.applications
        .filter((a) => a.programmeId === 'programme-1')
        .map((a) => {
          const legacyApplication = { ...a }
          delete legacyApplication.batchId
          return legacyApplication
        }),
      rubrics: records.rubrics.filter((r) => r.programmeId === 'programme-1'),
      documents: records.documents.filter((d) => d.applicationId !== 'APP-2026-0147'),
    }
    const legacyBackup = {
      ...modern,
      version: 1,
      dataset: legacy,
      files: modern.files.filter((f) => legacy.documents.some((d) => d.id === f.id)),
    }
    expect((await validateBackup(legacyBackup)).dataset.programmes).toHaveLength(1)
    await writeDataset(legacy as unknown as Dataset)
    const oldHash = legacy.documents[0].hash
    await queryDemo({ op: 'accounts' }, null)
    const migrated = (await readDataset())!
    expect(migrated.version).toBe(2)
    expect(migrated.programmes).toHaveLength(2)
    expect(migrated.applications[0].runs).toEqual(legacy.applications[0].runs)
    expect(migrated.documents[0].hash).toBe(oldHash)
    expect(await readFile(legacy.documents[0].id)).toBeDefined()
    expect(((await queryDemo({ op: 'me' }, 'tutor-a')) as User).programmeIds).toHaveLength(2)
    const invalid = structuredClone(modern)
    invalid.dataset.applications[0].runs[0].rubricId = activeRubricIds['programme-2']
    await expect(validateBackup(invalid)).rejects.toThrow('intact')
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
})
describe('backup reference integrity', () => {
  let data: Dataset
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
    data = (await readDataset())!
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async () => ({ pages: 4 }))
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
describe('persistent module intakes', () => {
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  beforeEach(() => {
    vi.mocked(inspectPdf).mockImplementation(async () => ({ pages: 1 }))
  })
  it('assigns old applications to their existing module year once, without replacing PDFs or history', async () => {
    const data = (await readDataset())!
    const original = structuredClone(data.applications[0])
    delete data.applications[0].intakeYear
    await writeDataset(data)
    await queryDemo({ op: 'applications', programmeId: 'programme-1' }, 'tutor-a')
    const saved = (await readDataset())!
    expect(saved.applications[0]).toEqual({ ...original, intakeYear: '2026 / 27' })
    saved.programmes[0].year = '2027 / 28'
    await writeDataset(saved)
    expect(
      await queryDemo(
        { op: 'applications', programmeId: 'programme-1', intakeYear: '2026 / 27' },
        'tutor-a',
      ),
    ).toHaveLength(8)
    expect(
      await queryDemo(
        { op: 'applications', programmeId: 'programme-1', intakeYear: '2027 / 28' },
        'tutor-a',
      ),
    ).toEqual([])
  })
})
