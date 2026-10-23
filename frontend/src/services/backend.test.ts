import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { application, documents, rubric, run } from '../test/fixtures'
import { backendUrl, evaluateBackend } from './backend'
import { evaluateApplication } from './evaluation'

const fetchMock = vi.fn<typeof fetch>()
const result = () => ({
  ...structuredClone(run),
  id: 'http-run',
  parentRunId: run.id,
  evaluationSource: 'fastapi-mock',
  error: null,
})
beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8000/api/v1/')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('FastAPI adapter', () => {
  it('sends only synthetic assessment context and preserves run identities and citations', async () => {
    fetchMock.mockResolvedValue(Response.json(result()))
    const response = await evaluateApplication(application, documents, rubric, 74, true)
    expect(response).toMatchObject({
      id: 'http-run',
      parentRunId: run.id,
      rubricId: rubric.id,
      evaluationSource: 'fastapi-mock',
    })
    expect(response.error).toBeUndefined()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:8000/api/v1/mock/assessments')
    expect(options?.method).toBe('POST')
    const body = JSON.parse(options?.body as string)
    expect(body).toMatchObject({
      applicationId: application.id,
      grade: 74,
      modelAvailable: true,
      parentRunId: run.id,
      criteria: { id: rubric.id, weights: rubric.weights },
    })
    expect(body.candidate).toBeUndefined()
    expect(body.documents).toEqual(documents.map(({ id, type, pages }) => ({ id, type, pages })))
  })
  it('accepts a first run and null scores without turning them into zero', async () => {
    const response = {
      ...result(),
      parentRunId: null,
      overall: null,
      extractedGrade: null,
      recommendation: 'Further review',
      sections: run.sections.map((s) => ({ ...s, score: null })),
    }
    fetchMock.mockResolvedValue(Response.json(response))
    const first = await evaluateBackend(
      { ...application, runs: [] },
      documents,
      rubric,
      null,
      false,
    )
    expect(first.parentRunId).toBeUndefined()
    expect(first.overall).toBeNull()
  })
  it('keeps standalone browser mode and real uploads outside the mock endpoint', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '   ')
    expect(backendUrl()).toBe('')
    expect(
      (await evaluateApplication(application, documents, rubric, 74, true)).evaluationSource,
    ).toBeUndefined()
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8000/api/v1')
    const uploaded = await evaluateApplication(
      { ...application, fixture: undefined },
      documents,
      rubric,
      74,
      true,
    )
    expect(uploaded.overall).toBeNull()
    expect(uploaded.flags).toContainEqual(expect.objectContaining({ code: 'BACKEND_UNAVAILABLE' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('fails explicitly without silently falling back to browser-generated scores', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(evaluateApplication(application, documents, rubric, 74, true)).rejects.toThrow(
      'Cannot reach',
    )
    expect(application.runs).toHaveLength(1)
  })
  it('bounds requests with a timeout and rejects missing configuration', async () => {
    fetchMock.mockResolvedValue(Response.json(result()))
    await evaluateBackend(application, documents, rubric, 74, true)
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
    vi.stubEnv('VITE_API_BASE_URL', undefined)
    await expect(evaluateBackend(application, documents, rubric, 74, true)).rejects.toThrow(
      'not configured',
    )
  })
  it.each([
    [
      Response.json({ detail: 'Only seeded synthetic cases are supported.' }, { status: 422 }),
      'Only seeded',
    ],
    [Response.json({ detail: [] }, { status: 422 }), 'HTTP 422'],
    [new Response('Server error', { status: 500 }), 'HTTP 500'],
    [new Response('broken JSON'), 'invalid JSON'],
  ])('surfaces backend and contract errors', async (response, message) => {
    fetchMock.mockResolvedValue(response)
    await expect(evaluateBackend(application, documents, rubric, 74, true)).rejects.toThrow(message)
  })
  it.each([
    null,
    { applicationId: 'other' },
    { rubricId: 'other' },
    { id: run.id },
    { parentRunId: 'other' },
    { simulated: false },
    { evaluationSource: 'other' },
    { overall: 101 },
    { extractedGrade: -1 },
    { status: 'queued' },
    { recommendation: 'Auto admit' },
    { startedAt: 'not a date' },
    { finishAt: '2020-01-01' },
    { error: 123 },
    { sections: [] },
    { sections: [run.sections[0], run.sections[0], run.sections[0]] },
    { flags: [{ code: 'bad', message: 'bad', critical: 'yes' }] },
    {
      justification: {
        ...run.justification,
        citations: [{ documentId: 'other', page: 1, claim: 'bad' }],
      },
    },
    {
      justification: {
        ...run.justification,
        citations: [{ documentId: documents[0].id, page: 100, claim: 'bad' }],
      },
    },
    { justification: { ...run.justification, rules: [123] } },
    { justification: { ...run.justification, summary: null } },
    { flags: [{ code: 'critical', message: 'missing', critical: true }] },
    {
      sections: run.sections.map((s) => ({ ...s, score: null })),
      recommendation: 'Further review',
    },
  ])('rejects malformed assessments before persistence', async (change) => {
    fetchMock.mockResolvedValue(Response.json(change === null ? null : { ...result(), ...change }))
    await expect(evaluateBackend(application, documents, rubric, 74, true)).rejects.toThrow(
      /Invalid|invalid/,
    )
  })
})
