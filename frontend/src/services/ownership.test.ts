import { beforeEach, describe, expect, it } from 'vitest'
import { assignCourseOwners } from './migration'
import {
  authorizedFile,
  commandDemo,
  queryDemo,
  stageBackup,
  takeBackup,
  validateBackup,
} from './demo'
import { readDataset, readFile, writeDataset } from './storage'
import { dataset, programme, tutor } from '../test/fixtures'
import type { Programme, User } from '../domain/types'

describe('legacy single-owner migration', () => {
  it('uses the creator audit before old assignments and leaves unassigned records intact', () => {
    const data = structuredClone(dataset)
    data.programmes[0].createdBy = undefined
    data.programmes[1].createdBy = undefined
    data.users.push({ ...tutor, id: 'other-tutor', programmeIds: [programme.id] })
    data.audit.push({
      id: 'creation',
      actor: 'other-tutor',
      action: 'Create programme workspace',
      target: programme.id,
      at: '2026-10-19T09:00:00Z',
    })
    data.users[0].programmeIds = []
    const original = structuredClone(data)
    assignCourseOwners(data)
    expect(data.programmes[0].createdBy).toBe('other-tutor')
    expect(data.programmes[1].createdBy).toBeUndefined()
    expect(data.users[0].programmeIds).toEqual([])
    expect(data.users[2].programmeIds).toEqual([programme.id])
    expect(data.applications).toEqual(original.applications)
    expect(data.documents).toEqual(original.documents)
    expect(data.audit).toEqual(original.audit)
    const migrated = structuredClone(data)
    assignCourseOwners(data)
    expect(data).toEqual(migrated)
  })
  it.each([true, false])(
    'recovers one existing tutor when the assignment is active=%s',
    (active) => {
      const data = structuredClone(dataset)
      data.programmes[0].createdBy = undefined
      data.users[0].active = false
      data.users.push({ ...tutor, id: 'other-tutor', active, programmeIds: [programme.id] })
      assignCourseOwners(data)
      expect(data.programmes[0].createdBy).toBe(active ? 'other-tutor' : tutor.id)
      expect(data.users.filter((u) => u.programmeIds.includes(programme.id))).toHaveLength(1)
    },
  )
})

describe('private tutor courses', () => {
  beforeEach(async () => {
    await queryDemo({ op: 'accounts' }, null)
    await commandDemo({ op: 'reset' }, 'admin-a')
  })
  it('allows deleting every owned example, with no shared-tutor warnings or remaining files', async () => {
    const courses = (await queryDemo({ op: 'programmes' }, 'tutor-a')) as Programme[]
    expect(courses).toHaveLength(3)
    expect(courses.every((p) => p.createdBy === 'tutor-a')).toBe(true)
    for (const course of courses) {
      expect(
        await queryDemo({ op: 'workspaceDeletion', id: course.id }, 'tutor-a'),
      ).not.toHaveProperty('otherTutors')
      await commandDemo({ op: 'deleteWorkspace', id: course.id, confirmed: true }, 'tutor-a')
    }
    expect(await queryDemo({ op: 'programmes' }, 'tutor-a')).toEqual([])
    expect((await readDataset())!.documents).toEqual([])
  })
  it('does not grant applicant access from forged legacy assignments', async () => {
    const data = (await readDataset())!
    const application = data.applications[0]
    data.users.find((u) => u.id === 'tutor-b')!.programmeIds = ['programme-1']
    await writeDataset(data)
    expect(await queryDemo({ op: 'programmes' }, 'tutor-b')).toEqual([])
    await expect(queryDemo({ op: 'application', id: application.id }, 'tutor-b')).rejects.toThrow(
      'tutor access',
    )
    await expect(authorizedFile(application.documentIds[0], 'tutor-b')).rejects.toThrow(
      'tutor access',
    )
    const user = data.users.find((u) => u.id === 'tutor-b')!
    await expect(commandDemo({ op: 'user', user }, 'admin-a')).rejects.toThrow('cannot be assigned')
    await expect(
      commandDemo({ op: 'programme', programme: { ...data.programmes[0], id: '' } }, 'admin-a'),
    ).rejects.toThrow('Tutors add their own courses')
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
