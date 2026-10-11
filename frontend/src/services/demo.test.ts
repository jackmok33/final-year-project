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
import type { Application, Dataset, Programme, User } from '../domain/types'
vi.mock('./pdf', () => ({
  inspectPdf: vi.fn(async (file: File) => ({ pages: file.name.includes('large') ? 60 : 4 })),
}))
const id = 'APP-2026-0142'
beforeEach(async () => {
  await queryDemo({ op: 'accounts' }, null)
  await commandDemo({ op: 'reset' }, 'admin-a')
})
describe('persistent browser demo contract', () => {
  it('scopes queues and criteria by course and denies unassigned courses', async () => {
    const programmes = (await queryDemo({ op: 'programmes' }, 'tutor-a')) as Programme[]
    expect(programmes).toHaveLength(2)
    expect(await queryDemo({ op: 'programmes' }, 'tutor-b')).toHaveLength(1)
    const first = (await queryDemo(
      { op: 'applications', programmeId: 'programme-1' },
      'tutor-a',
    )) as Application[]
    const second = (await queryDemo(
      { op: 'applications', programmeId: 'programme-2' },
      'tutor-a',
    )) as Application[]
    expect(first).toHaveLength(5)
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
    await commandDemo({ op: 'rubric', rubric: { ...secondRubric, offerFrom: 90 } }, 'tutor-a')
    const saved = (await readDataset())!
    expect(saved.activeRubricIds['programme-1']).toBe(original.activeRubricIds['programme-1'])
    expect(saved.rubrics.at(-1)?.version).toBe('1.1')
    await commandDemo({ op: 'evaluate', id: second[0].id }, 'tutor-a')
    expect((await readDataset())!.applications.at(-1)?.runs.at(-1)?.rubricId).toBe(
      saved.activeRubricIds['programme-2'],
    )
  })
  it('creates a course with its own rubric and grants several courses to one account', async () => {
    const result = await commandDemo(
      {
        op: 'programme',
        programme: {
          id: '',
          name: 'Example course C',
          code: 'DEMO-C',
          year: '2026 / 27',
          department: 'Example',
          description: 'Synthetic course',
        },
      },
      'admin-a',
    )
    const data = (await readDataset())!
    expect(data.programmes).toHaveLength(3)
    expect(data.rubrics.find((r) => r.id === data.activeRubricIds[result.id!])?.programmeId).toBe(
      result.id,
    )
    const user = data.users.find((u) => u.id === 'tutor-b')!
    await commandDemo(
      { op: 'user', user: { ...user, programmeIds: [...user.programmeIds, result.id!] } },
      'admin-a',
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
      3,
    )
  })
  it('migrates old storage and backups without discarding the original review history or PDFs', async () => {
    const exported = await commandDemo({ op: 'backup' }, 'admin-a')
    const modern = takeBackup(exported.backupId!)!
    const { programmes, activeRubricIds, ...records } = modern.dataset
    const legacy = {
      ...records,
      version: 1,
      programme: programmes[0],
      activeRubricId: activeRubricIds['programme-1'],
      users: records.users.map((u) => ({
        ...u,
        programmeIds: u.programmeIds.filter((id) => id === 'programme-1'),
      })),
      applications: records.applications.filter((a) => a.programmeId === 'programme-1'),
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
  it('activates a new rubric without changing old assessments and rejects unauthorised publication', async () => {
    const data = (await readDataset())!
    const rubric = { ...data.rubrics[0], offerFrom: 85 }
    await expect(commandDemo({ op: 'rubric', rubric }, 'tutor-b')).rejects.toThrow('permission')
    await commandDemo({ op: 'rubric', rubric }, 'tutor-a')
    const saved = (await readDataset())!
    expect(saved.rubrics).toHaveLength(3)
    expect(saved.applications[0].runs[0].rubricId).toBe(data.rubrics[0].id)
    expect(saved.activeRubricIds['programme-1']).not.toBe(data.activeRubricIds['programme-1'])
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
    expect((await readDataset())!.applications).toHaveLength(6)
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
    expect(Object.keys(checked.files)).toHaveLength(17)
    const corrupt = structuredClone(backup)
    corrupt.files[0].base64 = btoa('corrupt')
    await expect(validateBackup(corrupt)).rejects.toThrow('intact')
    const invalidCitation = structuredClone(backup)
    invalidCitation.dataset.applications[0].runs[0].justification.citations[0].page = 99
    await expect(validateBackup(invalidCitation)).rejects.toThrow('intact')
    await commandDemo({ op: 'delete', id }, 'admin-a')
    expect(await readFile(`${id}-transcript`)).toBeUndefined()
    expect((await readDataset())!.applications).toHaveLength(5)
    await commandDemo({ op: 'restore', backupId: stageBackup(backup) }, 'admin-a')
    expect(await readFile(`${id}-transcript`)).toBeDefined()
    expect((await readDataset())!.applications).toHaveLength(6)
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
