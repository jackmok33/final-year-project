import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Dataset, Programme, Rubric, User } from '../../domain/types'
import { commandDemo, queryDemo, stageBackup, takeBackup, validateBackup } from '../demo'
import { inspectPdf } from '../pdf'
import { readDataset, writeDataset } from '../storage'
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
  it('lets tutors save new criteria versions only for courses they own', async () => {
    const { id } = await commandDemo({ op: 'workspace', name: 'COMP0003' }, 'tutor-b')
    const original = (await readDataset())!
    const own = original.rubrics.find((r) => r.id === original.activeRubricIds[id!])!
    for (const [user, rubric] of [
      ['tutor-b', own],
      ['tutor-a', original.rubrics[0]],
    ] as const) {
      const result = await commandDemo(
        { op: 'rubric', rubric: { ...rubric, weights: { academic: 60, cv: 20, statement: 20 } } },
        user,
      )
      const saved = (await readDataset())!
      expect(saved.activeRubricIds[rubric.programmeId]).toBe(result.id)
      expect(saved.rubrics.find((r) => r.id === result.id)).toMatchObject({
        version: '1.1',
        weights: { academic: 60, cv: 20, statement: 20 },
      })
      expect(saved.rubrics.find((r) => r.id === rubric.id)).toEqual(rubric)
    }
    const saved = (await readDataset())!
    await expect(commandDemo({ op: 'rubric', rubric: own }, 'tutor-a')).rejects.toThrow(
      'tutor access',
    )
    await expect(commandDemo({ op: 'rubric', rubric: own }, 'admin-a')).rejects.toThrow(
      'tutor access',
    )
    expect(await readDataset()).toEqual(saved)
  })
  it('creates an empty tutor workspace with private access and independent example criteria', async () => {
    const original = (await readDataset())!
    const { id: workspaceId } = await commandDemo(
      { op: 'workspace', name: '  Data Science & AI MSc  ' },
      'tutor-b',
    )
    const saved = (await readDataset())!
    const programme = saved.programmes.find((p) => p.id === workspaceId)!
    expect(programme.name).toBe('Data Science & AI MSc')
    expect(programme.code).toBe(`COURSE-${workspaceId!.toUpperCase()}`)
    expect(saved.users.find((u) => u.id === 'tutor-b')!.programmeIds).toContain(workspaceId)
    expect(saved.users.find((u) => u.id === 'tutor-b')!.canPublishCriteria).toBe(false)
    expect(saved.users.find((u) => u.id === 'tutor-a')!.programmeIds).not.toContain(workspaceId)
    expect(await queryDemo({ op: 'applications', programmeId: workspaceId! }, 'tutor-b')).toEqual(
      [],
    )
    expect(saved.rubrics.find((r) => r.id === saved.activeRubricIds[workspaceId!])).toMatchObject({
      programmeId: workspaceId,
      version: '1.0',
      weights: { academic: 50, cv: 25, statement: 25 },
    })
    expect(saved.activeRubricIds['programme-1']).toBe(original.activeRubricIds['programme-1'])
    expect(saved.audit.at(-1)).toMatchObject({
      actor: 'tutor-b',
      action: 'Create programme workspace',
      target: workspaceId,
    })
    await expect(
      queryDemo({ op: 'applications', programmeId: workspaceId! }, 'tutor-a'),
    ).rejects.toThrow('tutor access')
    await expect(
      queryDemo({ op: 'rubrics', programmeId: workspaceId! }, 'admin-a'),
    ).rejects.toThrow('tutor access')
    expect((await queryDemo({ op: 'programmes' }, 'tutor-b')) as Programme[]).toContainEqual(
      programme,
    )
    const exported = await commandDemo({ op: 'backup' }, 'admin-a')
    const backup = takeBackup(exported.backupId!)!
    await validateBackup(backup)
    await commandDemo({ op: 'reset' }, 'admin-a')
    expect(
      ((await queryDemo({ op: 'programmes' }, 'tutor-b')) as Programme[]).some(
        (p) => p.id === workspaceId,
      ),
    ).toBe(false)
    await commandDemo({ op: 'restore', backupId: stageBackup(backup) }, 'admin-a')
    expect((await queryDemo({ op: 'programmes' }, 'tutor-b')) as Programme[]).toContainEqual(
      programme,
    )
  })
  it('validates course names and access without changing the dataset', async () => {
    const before = (await readDataset())!
    for (const name of ['  ', 'x'.repeat(101)])
      await expect(commandDemo({ op: 'workspace', name }, 'tutor-a')).rejects.toThrow('course name')
    await expect(
      commandDemo({ op: 'workspace', name: ' machine learning msc ' }, 'tutor-a'),
    ).rejects.toThrow('already have access')
    await expect(commandDemo({ op: 'workspace', name: 'COMP0003' }, 'admin-a')).rejects.toThrow(
      'Tutor access',
    )
    await expect(commandDemo({ op: 'workspace', name: 'COMP0003' }, null)).rejects.toThrow(
      'session',
    )
    expect(await readDataset()).toEqual(before)
    await commandDemo({ op: 'workspace', name: 'Robotics & AI MSc' }, 'tutor-a')
    await expect(
      commandDemo({ op: 'workspace', name: ' robotics & ai msc ' }, 'tutor-a'),
    ).rejects.toThrow('already have access')
  })
  it('allows independent courses with the same name for different tutors', async () => {
    const first = await commandDemo({ op: 'workspace', name: 'Robotics & AI MSc' }, 'tutor-a')
    const second = await commandDemo({ op: 'workspace', name: 'Robotics & AI MSc' }, 'tutor-b')
    const data = (await readDataset())!
    const courses = data.programmes.filter((p) => [first.id, second.id].includes(p.id))
    expect(courses).toHaveLength(2)
    expect(new Set(courses.map((p) => p.code)).size).toBe(2)
    expect(courses.map((p) => p.name)).toEqual(['Robotics & AI MSc', 'Robotics & AI MSc'])
    expect(data.users.find((u) => u.id === 'tutor-a')!.programmeIds).not.toContain(second.id)
    expect(data.users.find((u) => u.id === 'tutor-b')!.programmeIds).not.toContain(first.id)
  })
  it('rejects stale criteria drafts and preserves historic runs and decisions when a new version is saved', async () => {
    const data = (await readDataset())!
    const savedVersion = {
      ...data.rubrics[0],
      id: 'saved-criteria-v11',
      version: '1.1',
      weights: { academic: 60, cv: 20, statement: 20 },
    }
    data.rubrics.push(savedVersion)
    data.activeRubricIds[savedVersion.programmeId] = savedVersion.id
    await writeDataset(data)
    const rubric = { ...data.rubrics[0], offerFrom: 85 }
    await expect(commandDemo({ op: 'rubric', rubric }, 'tutor-a')).rejects.toThrow(
      'active criteria have changed',
    )
    await expect(commandDemo({ op: 'rubric', rubric }, 'tutor-b')).rejects.toThrow('tutor access')
    expect(await readDataset()).toEqual(data)
    const result = await queryDemo(
      { op: 'rubrics', programmeId: savedVersion.programmeId },
      'tutor-a',
    )
    expect(result).toMatchObject({ activeId: savedVersion.id })
    expect(data.applications[0].runs[0].rubricId).toBe(data.rubrics[0].id)
    const { id: nextId } = await commandDemo(
      { op: 'rubric', rubric: { ...savedVersion, offerFrom: 85 } },
      'tutor-a',
    )
    const saved = (await readDataset())!
    expect(saved.rubrics.find((r) => r.id === nextId)).toMatchObject({
      version: '1.2',
      offerFrom: 85,
      weights: savedVersion.weights,
    })
    expect(saved.rubrics.slice(0, -1)).toEqual(data.rubrics)
    expect(saved.applications).toEqual(data.applications)
    expect(saved.audit.at(-1)).toMatchObject({
      actor: 'tutor-a',
      action: 'Save admission criteria',
      target: nextId,
    })
  })
  it.each([
    { weights: { academic: 50, cv: 25, statement: 20 } },
    { weights: { academic: NaN, cv: 25, statement: 25 } },
    { weights: { academic: -1, cv: 51, statement: 50 } },
    { weights: { academic: 50, cv: 50 } },
    { weights: { academic: 50, cv: 25, statement: 25, extra: 0 } },
    { offerFrom: 50 },
    { rejectBelow: -1 },
    { offerFrom: 101 },
    { margin: -1 },
    { margin: NaN },
    { mandatoryRule: 'A different entry rule' },
    {},
  ])('rejects invalid or unchanged criteria without saving a version (%j)', async (changes) => {
    const original = (await readDataset())!
    const active = original.rubrics.find((r) => r.id === original.activeRubricIds['programme-1'])!
    await expect(
      commandDemo({ op: 'rubric', rubric: { ...active, ...changes } as Rubric }, 'tutor-a'),
    ).rejects.toThrow()
    expect(await readDataset()).toEqual(original)
  })
  it('serialises concurrent criteria saves so a stale draft cannot replace the new version', async () => {
    const original = (await readDataset())!
    const active = original.rubrics.find((r) => r.id === original.activeRubricIds['programme-1'])!
    const results = await Promise.allSettled([
      commandDemo({ op: 'rubric', rubric: { ...active, offerFrom: 85 } }, 'tutor-a'),
      commandDemo({ op: 'rubric', rubric: { ...active, offerFrom: 90 } }, 'tutor-a'),
    ])
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected'])
    const saved = (await readDataset())!
    expect(saved.rubrics).toHaveLength(original.rubrics.length + 1)
    expect(saved.rubrics.at(-1)?.offerFrom).toBe(85)
  })
  it('deactivation revokes protected operations and retains an active administrator', async () => {
    const data = (await readDataset())!
    const user = { ...data.users[0], active: false }
    await commandDemo({ op: 'user', user }, 'admin-a')
    await expect(queryDemo({ op: 'application', id }, user.id)).rejects.toThrow('deactivated')
    await expect(
      commandDemo({ op: 'user', user: { ...data.users[2], active: false } }, 'admin-a'),
    ).rejects.toThrow('active administrator')
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
  it('removes tutor permissions when an account becomes admin-only', async () => {
    await commandDemo(
      { op: 'user', user: { ...data.users[0], roles: ['admin'], canPublishCriteria: true } },
      'admin-a',
    )
    const saved = (await readDataset())!.users[0]
    expect(saved.programmeIds).toEqual([])
    expect(saved.canPublishCriteria).toBe(false)
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
})
describe('private tutor courses', () => {
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  it('preserves ownership through deactivation and role changes without exposing courses to an admin', async () => {
    const owner = (await queryDemo({ op: 'me' }, 'tutor-a')) as User
    await commandDemo({ op: 'user', user: { ...owner, active: false } }, 'admin-a')
    await expect(queryDemo({ op: 'programmes' }, owner.id)).rejects.toThrow('deactivated')
    await commandDemo({ op: 'user', user: { ...owner, roles: ['admin'] } }, 'admin-a')
    await expect(queryDemo({ op: 'application', id: 'APP-2026-0142' }, owner.id)).rejects.toThrow(
      'tutor access',
    )
    const admin = (await queryDemo({ op: 'me' }, owner.id)) as User
    await commandDemo({ op: 'user', user: { ...admin, roles: ['tutor'] } }, 'admin-a')
    expect(await queryDemo({ op: 'programmes' }, owner.id)).toHaveLength(3)
    expect((await readDataset())!.programmes.every((p) => p.createdBy === owner.id)).toBe(true)
  })
})
