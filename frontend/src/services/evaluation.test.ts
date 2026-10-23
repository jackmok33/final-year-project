import { afterEach, describe, expect, it, vi } from 'vitest'
import { application, documents, rubric, run } from '../test/fixtures'
import { backendUrl, evaluateBackend } from './backend'
import { evaluateApplication } from './evaluation'
import { simulateRun } from './seed'

vi.mock('./backend', () => ({ backendUrl: vi.fn(), evaluateBackend: vi.fn() }))
vi.mock('./seed', () => ({ simulateRun: vi.fn() }))
afterEach(() => vi.resetAllMocks())
describe('evaluateApplication', () => {
  it('uses the configured backend for a known synthetic case', async () => {
    vi.mocked(backendUrl).mockReturnValue('http://localhost/api/v1')
    vi.mocked(evaluateBackend).mockResolvedValue(run)
    expect(await evaluateApplication(application, documents, rubric, 74, true)).toEqual(run)
    expect(evaluateBackend).toHaveBeenCalledWith(application, documents, rubric, 74, true)
    expect(simulateRun).not.toHaveBeenCalled()
  })
  it.each([false, true])(
    'keeps uploaded records on the honest local path with backend configured=%s',
    async (configured) => {
      vi.mocked(backendUrl).mockReturnValue(configured ? 'http://localhost/api/v1' : '')
      vi.mocked(simulateRun).mockReturnValue({ ...run, overall: null })
      const uploaded = { ...application, fixture: undefined }
      expect(await evaluateApplication(uploaded, documents, rubric, null, true)).toMatchObject({
        overall: null,
      })
      expect(simulateRun).toHaveBeenCalledWith(uploaded, documents, rubric, null, true)
      expect(evaluateBackend).not.toHaveBeenCalled()
    },
  )
  it('propagates backend failure without silently substituting local scores', async () => {
    vi.mocked(backendUrl).mockReturnValue('http://localhost/api/v1')
    vi.mocked(evaluateBackend).mockRejectedValue(new Error('Offline'))
    await expect(evaluateApplication(application, documents, rubric, 74, true)).rejects.toThrow(
      'Offline',
    )
    expect(simulateRun).not.toHaveBeenCalled()
  })
})
