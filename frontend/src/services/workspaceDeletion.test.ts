import { beforeEach, describe, expect, it } from 'vitest'
import { commandDemo, queryDemo, stageBackup, takeBackup, validateBackup } from './demo'
import { readDataset, readFile, writeDataset } from './storage'
import type { Programme, WorkspaceDeletionImpact } from '../domain/types'

beforeEach(async () => {
  await queryDemo({ op: 'accounts' }, null)
  await commandDemo({ op: 'reset' }, 'admin-a')
})

async function createWorkspace() {
  return (await commandDemo({ op: 'workspace', name: 'My workspace' }, 'tutor-a')).id!
}

describe('workspace deletion and ownership', () => {
  it('requires creator access and confirmation, including for assigned tutors and admin accounts', async () => {
    const id = await createWorkspace()
    const data = (await readDataset())!
    data.users.find((u) => u.id === 'tutor-b')!.programmeIds.push(id)
    await writeDataset(data)
    for (const [user, target, message] of [
      ['tutor-b', id, 'Only the tutor who created'],
      ['admin-a', id, 'tutor access'],
      ['tutor-a', 'programme-1', 'Only the tutor who created'],
      ['tutor-a', 'missing', 'not found'],
    ]) {
      await expect(
        commandDemo({ op: 'deleteWorkspace', id: target, confirmed: true }, user),
      ).rejects.toThrow(message)
      await expect(queryDemo({ op: 'workspaceDeletion', id: target }, user)).rejects.toThrow(
        message,
      )
    }
    await expect(
      commandDemo({ op: 'deleteWorkspace', id, confirmed: false }, 'tutor-a'),
    ).rejects.toThrow('Confirm workspace deletion')
    expect(await readDataset()).toEqual(data)
  })

  it('removes the complete workspace atomically while preserving unrelated courses and original PDFs', async () => {
    const id = await createWorkspace()
    const data = (await readDataset())!
    const app = data.applications[0]
    app.programmeId = id
    app.runs.forEach((r) => {
      r.rubricId = data.activeRubricIds[id]
    })
    data.users.find((u) => u.id === 'tutor-b')!.programmeIds.push(id)
    data.audit.push({
      id: 'run-audit',
      actor: 'tutor-a',
      action: 'Review run',
      target: app.runs[0].id,
      at: new Date().toISOString(),
    })
    await writeDataset(data)
    const impact = (await queryDemo(
      { op: 'workspaceDeletion', id },
      'tutor-a',
    )) as WorkspaceDeletionImpact
    expect(impact).toMatchObject({
      programme: { id, createdBy: 'tutor-a' },
      applications: 1,
      documents: app.documentIds.length,
      criteriaVersions: 1,
      otherTutors: 1,
    })
    const exported = await commandDemo({ op: 'backup' }, 'admin-a')
    const backup = takeBackup(exported.backupId!)!
    await validateBackup(backup)
    const unrelated = data.applications[1]
    const original = await (await readFile(unrelated.documentIds[0]))!.text()
    await commandDemo({ op: 'deleteWorkspace', id, confirmed: true }, 'tutor-a')
    const deleted = (await readDataset())!
    expect(deleted.programmes.some((p) => p.id === id)).toBe(false)
    expect(deleted.applications).toEqual(data.applications.filter((a) => a.id !== app.id))
    expect(deleted.rubrics).toEqual(data.rubrics.filter((r) => r.programmeId !== id))
    expect(deleted.activeRubricIds).not.toHaveProperty(id)
    expect(deleted.users.every((u) => !u.programmeIds.includes(id))).toBe(true)
    expect(deleted.audit.some((e) => e.id === 'run-audit')).toBe(false)
    expect(deleted.audit.at(-1)).toMatchObject({
      action: 'Delete programme workspace',
      target: id,
      actor: 'tutor-a',
    })
    for (const documentId of app.documentIds) expect(await readFile(documentId)).toBeUndefined()
    expect(await (await readFile(unrelated.documentIds[0]))!.text()).toBe(original)
    const after = await commandDemo({ op: 'backup' }, 'admin-a')
    await validateBackup(takeBackup(after.backupId!))
    await commandDemo({ op: 'restore', backupId: stageBackup(backup) }, 'admin-a')
    expect(
      ((await queryDemo({ op: 'programmes' }, 'tutor-a')) as Programme[]).find((p) => p.id === id)
        ?.createdBy,
    ).toBe('tutor-a')
    expect(await readFile(app.documentIds[0])).toBeDefined()
  })

  it('allows deleting the last course and backs up/restores an empty workspace dataset', async () => {
    const id = await createWorkspace()
    const data = (await readDataset())!
    data.programmes = data.programmes.filter((p) => p.id === id)
    data.rubrics = data.rubrics.filter((r) => r.programmeId === id)
    data.activeRubricIds = { [id]: data.activeRubricIds[id] }
    data.applications = []
    data.documents = []
    data.users.forEach((u) => {
      u.programmeIds = u.programmeIds.filter((p) => p === id)
    })
    await writeDataset(data, {}, [], true)
    await commandDemo({ op: 'deleteWorkspace', id, confirmed: true }, 'tutor-a')
    expect(await queryDemo({ op: 'programmes' }, 'tutor-a')).toEqual([])
    const exported = await commandDemo({ op: 'backup' }, 'admin-a')
    const backup = takeBackup(exported.backupId!)!
    await validateBackup(backup)
    await commandDemo({ op: 'reset' }, 'admin-a')
    await commandDemo({ op: 'restore', backupId: stageBackup(backup) }, 'admin-a')
    expect(await queryDemo({ op: 'programmes' }, 'admin-a')).toEqual([])
    expect((await readDataset())!.rubrics).toEqual([])
    await expect(
      commandDemo({ op: 'workspace', name: 'Start again' }, 'tutor-a'),
    ).resolves.toHaveProperty('id')
  })

  it('recovers ownership of earlier workspaces from their creation audit without claiming shared courses', async () => {
    const id = await createWorkspace()
    const data = (await readDataset())!
    delete data.programmes.find((p) => p.id === id)!.createdBy
    await writeDataset(data)
    const programmes = (await queryDemo({ op: 'programmes' }, 'tutor-a')) as Programme[]
    expect(programmes.find((p) => p.id === id)?.createdBy).toBe('tutor-a')
    expect(programmes.find((p) => p.id === 'programme-1')?.createdBy).toBeUndefined()
    await expect(
      commandDemo({ op: 'deleteWorkspace', id, confirmed: true }, 'tutor-a'),
    ).resolves.toEqual({})
  })

  it('preserves ownership across metadata edits and rejects invalid owners in backups', async () => {
    const id = await createWorkspace()
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
})
