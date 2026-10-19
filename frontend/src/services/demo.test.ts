import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  authorizedFile,
  commandDemo,
  queryDemo,
  stageBackup,
  stageUploads,
  takeBackup,
  validateBackup,
} from './demo'
import { readDataset, readFile, writeDataset } from './storage'
import type { Application, Dataset, Programme, Rubric, User } from '../domain/types'
vi.mock('./pdf', () => ({
  inspectPdf: vi.fn(async (file: File) => ({ pages: file.name.includes('large') ? 60 : 4 })),
}))
const id = 'APP-2026-0142'
beforeEach(async () => {
  await queryDemo({ op: 'accounts' }, null)
  await commandDemo({ op: 'reset' }, 'admin-a')
})
describe('persistent browser demo contract', () => {
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
  it('scopes queues and criteria by course and denies unassigned courses', async () => {
    const programmes = (await queryDemo({ op: 'programmes' }, 'tutor-a')) as Programme[]
    expect(programmes).toHaveLength(3)
    expect(await queryDemo({ op: 'programmes' }, 'tutor-b')).toHaveLength(0)
    const first = (await queryDemo(
      { op: 'applications', programmeId: 'programme-1' },
      'tutor-a',
    )) as Application[]
    const second = (await queryDemo(
      { op: 'applications', programmeId: 'programme-2' },
      'tutor-a',
    )) as Application[]
    expect(first).toHaveLength(8)
    expect(second).toHaveLength(1)
    await expect(
      queryDemo({ op: 'applications', programmeId: 'programme-2' }, 'tutor-b'),
    ).rejects.toThrow('tutor access')
    await expect(
      queryDemo({ op: 'rubrics', programmeId: 'programme-2' }, 'tutor-b'),
    ).rejects.toThrow('tutor access')
    await expect(queryDemo({ op: 'application', id: second[0].id }, 'tutor-b')).rejects.toThrow(
      'tutor access',
    )
    await expect(authorizedFile(second[0].documentIds[0], 'tutor-b')).rejects.toThrow(
      'tutor access',
    )
    const original = (await readDataset())!
    const secondRubric = original.rubrics.find((r) => r.programmeId === 'programme-2')!
    const { id: criteriaId } = await commandDemo(
      { op: 'rubric', rubric: { ...secondRubric, offerFrom: 90 } },
      'tutor-a',
    )
    const saved = (await readDataset())!
    expect(saved.activeRubricIds['programme-1']).toBe(original.activeRubricIds['programme-1'])
    expect(saved.rubrics.slice(0, -1)).toEqual(original.rubrics)
    expect(saved.activeRubricIds['programme-2']).toBe(criteriaId)
    expect(saved.applications).toEqual(original.applications)
    await commandDemo({ op: 'evaluate', id: second[0].id }, 'tutor-a')
    expect(
      (await readDataset())!.applications.find((a) => a.id === second[0].id)?.runs.at(-1)?.rubricId,
    ).toBe(saved.activeRubricIds['programme-2'])
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
  it('enforces roles, programme scope and inactive users at the service boundary', async () => {
    await expect(queryDemo({ op: 'application', id }, 'admin-a')).rejects.toThrow('tutor access')
    await expect(authorizedFile(`${id}-transcript`, 'admin-a')).rejects.toThrow('tutor access')
    await expect(queryDemo({ op: 'users' }, 'tutor-a')).rejects.toThrow('Administrator')
    await expect(
      queryDemo({ op: 'applications', programmeId: 'programme-1' }, null),
    ).rejects.toThrow('session')
    await expect(
      queryDemo({ op: 'applications', programmeId: 'programme-1' }, 'former-tutor'),
    ).rejects.toThrow('deactivated')
    const data = (await readDataset())!
    data.users.find((u) => u.id === 'tutor-b')!.programmeIds = []
    await commandDemo({ op: 'user', user: data.users.find((u) => u.id === 'tutor-b')! }, 'admin-a')
    await expect(queryDemo({ op: 'application', id }, 'tutor-b')).rejects.toThrow('programme')
  })
  it('preserves original facts/runs, refresh recovery and recorded decisions after a correction', async () => {
    const data = (await readDataset())!
    const app = data.applications.find((a) => a.id === id)!
    const run = app.runs[0]
    await commandDemo(
      {
        op: 'decide',
        id,
        runId: run.id,
        outcome: 'Further review',
        reason: 'Verify grade',
        confirmed: false,
      },
      'tutor-a',
    )
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
  it('requires source/reason, final confirmation and override reasons; deduplicates a repeated decision', async () => {
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
    await expect(
      commandDemo(
        { op: 'decide', id, runId: run.id, outcome: 'Offer', reason: 'override', confirmed: true },
        'tutor-a',
      ),
    ).rejects.toThrow('critical')
    const offer = data.applications[1]
    await expect(
      commandDemo(
        {
          op: 'decide',
          id: offer.id,
          runId: offer.runs[0].id,
          outcome: 'Offer',
          reason: '',
          confirmed: false,
        },
        'tutor-a',
      ),
    ).rejects.toThrow('confirm')
    await expect(
      commandDemo(
        {
          op: 'decide',
          id: offer.id,
          runId: offer.runs[0].id,
          outcome: 'Reject',
          reason: '',
          confirmed: true,
        },
        'tutor-a',
      ),
    ).rejects.toThrow('reason')
    const cmd = {
      op: 'decide',
      id: offer.id,
      runId: offer.runs[0].id,
      outcome: 'Offer',
      reason: '',
      confirmed: true,
    } as const
    await commandDemo(cmd, 'tutor-a')
    await commandDemo(cmd, 'tutor-a')
    expect((await readDataset())!.applications[1].decisions).toHaveLength(1)
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
    expect(newApp.runs[0].overall).toBeNull()
    expect(newApp.runs[0].flags.some((f) => f.code === 'BACKEND_UNAVAILABLE')).toBe(true)
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
