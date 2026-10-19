import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Application, Backup } from '../domain/types'
import {
  commandDemo,
  queryDemo,
  releaseUploads,
  stageBackup,
  stageUploads,
  takeBackup,
  validateBackup,
} from './demo'
import { readDataset, readFile, writeDataset } from './storage'

vi.mock('./pdf', () => ({ inspectPdf: vi.fn(async () => ({ pages: 1 })) }))
beforeEach(async () => {
  await queryDemo({ op: 'accounts' }, null)
  await commandDemo({ op: 'reset' }, 'admin-a')
})
describe('persistent module intakes', () => {
  it('updates saved default module labels on load without resetting applications, permissions or PDFs', async () => {
    const original = (await readDataset())!
    const fileId = original.documents[0].id
    const bytes = await (await readFile(fileId))!.arrayBuffer()
    const legacy = structuredClone(original)
    Object.assign(legacy.programmes[0], {
      name: 'Programme · TBC',
      code: 'PG-TBC',
      createdBy: undefined,
    })
    Object.assign(legacy.programmes[1], {
      name: 'Data Science · Example',
      code: 'PG-DS-DEMO',
      createdBy: undefined,
    })
    await writeDataset(legacy)
    await queryDemo({ op: 'programmes' }, 'tutor-a')
    expect(await readDataset()).toEqual(original)
    expect(await (await readFile(fileId))!.arrayBuffer()).toEqual(bytes)
    await queryDemo({ op: 'programmes' }, 'tutor-a')
    expect(await readDataset()).toEqual(original)
  })
  it('preserves descriptive legacy intake labels through module metadata edits and backup', async () => {
    const data = (await readDataset())!
    data.programmes[0].year = 'Legacy intake'
    delete data.applications[0].batchId
    delete data.applications[0].intakeYear
    await writeDataset(data)
    await queryDemo({ op: 'application', id: data.applications[0].id }, 'tutor-a')
    const saved = (await readDataset())!
    saved.programmes[0].year = '2027 / 28'
    await writeDataset(saved)
    const { backupId } = await commandDemo({ op: 'backup' }, 'admin-a')
    await validateBackup(takeBackup(backupId!)!)
    expect(
      await queryDemo(
        { op: 'applications', programmeId: 'programme-1', intakeYear: 'Legacy intake' },
        'tutor-a',
      ),
    ).toHaveLength(1)
  })
  it('stores the selected intake, separates its queue, and preserves it through backup/restore', async () => {
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
      const { backupId } = await commandDemo({ op: 'backup' }, 'admin-a')
      const backup = takeBackup(backupId!)!
      await validateBackup(backup)
      await commandDemo({ op: 'reset' }, 'admin-a')
      await commandDemo({ op: 'restore', backupId: stageBackup(backup) }, 'admin-a')
      expect((await readDataset())!.applications.find((a) => a.id === id)!.intakeYear).toBe(
        '2025 / 26',
      )
      expect(await (await readFile(fileId))!.arrayBuffer()).toEqual(bytes)
    } finally {
      releaseUploads(refs)
    }
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
  it('accepts legacy backups without an intake field and rejects corrupt intake metadata', async () => {
    const { backupId } = await commandDemo({ op: 'backup' }, 'admin-a')
    const backup = takeBackup(backupId!) as Backup
    delete backup.dataset.applications[0].intakeYear
    await validateBackup(backup)
    backup.dataset.applications[0].intakeYear = ' '
    await expect(validateBackup(backup)).rejects.toThrow('valid, intact')
  })
})
