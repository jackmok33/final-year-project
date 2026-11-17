// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { application, documents, programme, rubric, tutor, administrator } from '../test/fixtures'
import { saveBackendSession, clearBackendSession, backendSession } from './backendSession'
import { authenticateBackend, httpAdmissionsService as service } from './httpAdmissions'
import { uploads, archives } from './fileStaging'
import { readApplicantArchive } from './zip'
vi.mock('./zip', () => ({ readApplicantArchive: vi.fn() }))
function fixture() {
  return structuredClone({
    version: 2,
    subject: tutor.id,
    users: [tutor],
    programmes: [programme],
    applications: [{ ...application, intakeYear: programme.year }],
    documents,
    rubrics: [rubric],
    activeRubricIds: { [programme.id]: rubric.id },
    batches: [],
    audit: [],
    modelAvailable: true,
  })
}
beforeEach(() => {
  clearBackendSession()
  saveBackendSession(tutor.id, 'a'.repeat(40))
  vi.stubEnv('VITE_API_BASE_URL', '')
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => Promise.resolve(Response.json(fixture()))),
  )
})
afterEach(() => {
  clearBackendSession()
  uploads.clear()
  archives.clear()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe('HTTP admissions adapter', () => {
  it('authenticates against the server identity without changing the session', async () => {
    clearBackendSession()
    expect(await authenticateBackend(' TUTOR@example.test ', 'a'.repeat(40))).toEqual(tutor)
    expect(backendSession()).toBeUndefined()
    await expect(authenticateBackend('other@test', 'a'.repeat(40))).rejects.toThrow(
      'does not match',
    )
    await expect(authenticateBackend(tutor.email, 'short')).rejects.toThrow(
      'Enter the access token',
    )
  })
  it('projects read models and coalesces concurrent reads', async () => {
    const [me, programmes] = await Promise.all([
      service.query({ op: 'me' }, tutor.id),
      service.query({ op: 'programmes' }, tutor.id),
    ])
    expect(me).toEqual(tutor)
    expect(programmes).toEqual([programme])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(await service.query({ op: 'accounts' }, tutor.id)).toHaveLength(1)
    expect(await service.query({ op: 'programmeIntakes' }, tutor.id)).toEqual([
      { programmeId: programme.id, years: [programme.year, '2025 / 26', '2024 / 25'] },
    ])
    expect(await service.query({ op: 'application', id: application.id }, tutor.id)).toMatchObject({
      application: { id: application.id },
      documents,
    })
    expect(await service.query({ op: 'rubrics', programmeId: programme.id }, tutor.id)).toEqual({
      rubrics: [rubric],
      activeId: rubric.id,
    })
    expect(
      await service.query(
        { op: 'applications', programmeId: programme.id, intakeYear: '26 / 27' },
        tutor.id,
      ),
    ).toMatchObject([{ id: application.id, documentTypes: ['transcript', 'cv', 'statement'] }])
    expect(
      await service.query(
        { op: 'applications', programmeId: programme.id, intakeYear: '2025 / 26' },
        tutor.id,
      ),
    ).toEqual([])
    expect(
      await service.query(
        { op: 'batches', programmeId: programme.id, intakeYear: programme.year },
        tutor.id,
      ),
    ).toEqual([])
  })
  it('enforces session and missing resource handling, and projects batches/admin users', async () => {
    const value = fixture()
    Object.assign(value, {
      batches: [
        {
          id: 'b',
          programmeId: programme.id,
          intakeYear: programme.year,
          filename: 'sample.zip',
          source: 'zip',
          uploadedAt: application.submittedAt,
        },
      ],
    })
    value.applications[0].batchId = 'b'
    vi.mocked(fetch).mockImplementation(async () => Response.json(value))
    expect(await service.query({ op: 'batch', id: 'b' }, tutor.id)).toMatchObject({ id: 'b' })
    for (const query of [
      { op: 'application', id: 'missing' },
      { op: 'batch', id: 'missing' },
      { op: 'applications', programmeId: 'missing' },
      { op: 'users' },
    ] as const)
      await expect(service.query(query, tutor.id)).rejects.toThrow()
    await expect(service.query({ op: 'me' }, null)).rejects.toThrow('Sign in')
    saveBackendSession(administrator.id, 'b'.repeat(40))
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json({
        ...fixture(),
        subject: administrator.id,
        users: [administrator],
        programmes: [],
        applications: [],
        documents: [],
        rubrics: [],
        batches: [],
        activeRubricIds: {},
      }),
    )
    expect(await service.query({ op: 'users' }, administrator.id)).toEqual([administrator])
  })
  it.each([
    [{ op: 'workspace', name: 'Course' }, '/programmes', 'POST'],
    [{ op: 'rubric', rubric }, '/programmes/programme-1/criteria', 'PUT'],
    [{ op: 'user', user: tutor }, '/accounts/tutor-a', 'PUT'],
    [{ op: 'user', user: { ...tutor, id: '' } }, '/accounts', 'POST'],
    [{ op: 'deleteApplicant', id: 'a', confirmed: true }, '/applications/a', 'DELETE'],
    [{ op: 'evaluate', id: 'a' }, '/applications/a/evaluations', 'POST'],
    [
      { op: 'decide', id: 'a', runId: 'r', outcome: 'Conditional', reason: 'reviewed' },
      '/applications/a/decisions',
      'POST',
    ],
    [
      { op: 'correct', id: 'a', runId: 'r', value: 0, reason: 'source', documentId: 'd', page: 1 },
      '/applications/a/corrections',
      'POST',
    ],
  ] as const)('maps %j to a server command', async (command, path, method) => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ id: 'saved' }))
    expect(await service.command(command, tutor.id)).toEqual({ id: 'saved' })
    expect(fetch).toHaveBeenCalledWith('/api/v1' + path, expect.objectContaining({ method }))
  })
  it('sends staged PDF originals and a manifest, using the default intake if omitted', async () => {
    uploads.set('file', new File(['PDF'], 'cv.pdf', { type: 'application/pdf' }))
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json(fixture()))
      .mockResolvedValueOnce(Response.json({ id: 'new', batchId: 'b' }))
    await service.command(
      {
        op: 'create',
        candidate: 'candidate',
        programmeId: programme.id,
        batchId: 'b',
        uploads: [{ id: 'file', type: 'cv' }],
      },
      tutor.id,
    )
    const form = vi.mocked(fetch).mock.calls[1][1]!.body as FormData
    expect(JSON.parse(String(form.get('manifest')))).toEqual({
      candidate: 'candidate',
      intakeYear: programme.year,
      batchId: 'b',
      documents: [{ type: 'cv', fileIndex: 0 }],
    })
    expect(form.get('file')).toBeInstanceOf(File)
    await expect(
      service.command(
        {
          op: 'create',
          candidate: 'a',
          programmeId: programme.id,
          uploads: [{ id: 'missing', type: 'cv' }],
        },
        tutor.id,
      ),
    ).rejects.toThrow('Select the PDF')
  })
  it('resolves ZIP files to applicant parts', async () => {
    const command = {
      op: 'importBatch',
      programmeId: programme.id,
      intakeYear: programme.year,
      archiveId: 'z',
    } as const
    await expect(service.command(command, tutor.id)).rejects.toThrow('Select the ZIP')
    archives.set('z', new File(['zip'], 'batch.zip'))
    vi.mocked(readApplicantArchive).mockResolvedValue([
      { candidate: 'A', documents: [{ type: 'reference', file: new File(['pdf'], 'ref.pdf') }] },
    ])
    vi.mocked(fetch).mockResolvedValue(Response.json({ id: 'b', batchId: 'b' }))
    await service.command(command, tutor.id)
    const form = vi.mocked(fetch).mock.calls[0][1]!.body as FormData
    expect(JSON.parse(String(form.get('manifest'))).applications[0].documents).toEqual([
      { type: 'reference', fileIndex: 0 },
    ])
  })
  it.each([null, [], { id: 1 }, { batchId: 1 }])(
    'rejects invalid save result %j',
    async (result) => {
      vi.mocked(fetch).mockResolvedValue(Response.json(result))
      await expect(service.command({ op: 'evaluate', id: 'a' }, tutor.id)).rejects.toThrow(
        'invalid save',
      )
    },
  )
  it('downloads authenticated PDF bytes and rejects non-PDF responses', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('PDF', { headers: { 'content-type': 'application/pdf' } }),
    )
    expect((await service.originalDocument('d', tutor.id)).size).toBe(3)
    vi.mocked(fetch).mockResolvedValue(Response.json({}))
    await expect(service.originalDocument('d', tutor.id)).rejects.toThrow('did not return a PDF')
  })
  it('rejects late results after an account switch', async () => {
    let resolve!: (r: Response) => void
    vi.mocked(fetch).mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const query = service.query({ op: 'me' }, tutor.id)
    saveBackendSession('other', 'b'.repeat(40))
    resolve(Response.json(fixture()))
    await expect(query).rejects.toThrow('account has changed')
    saveBackendSession(tutor.id, 'a'.repeat(40))
    vi.mocked(fetch).mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const command = service.command({ op: 'evaluate', id: 'a' }, tutor.id)
    clearBackendSession()
    resolve(Response.json({}))
    await expect(command).rejects.toThrow('Sign in')
  })
})
