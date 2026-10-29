import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { ApplicationDetail } from './contracts'
import { application, detail, tutor } from '../test/fixtures'
import { admissionsService } from './admissions'
import { authorizedFile, commandDemo, queryDemo } from './demo'

vi.mock('./demo', () => ({
  queryDemo: vi.fn(),
  commandDemo: vi.fn(),
  authorizedFile: vi.fn(),
}))

beforeEach(() => vi.resetAllMocks())

describe('admissions service boundary', () => {
  it('returns typed application data using the signed-in account scope', async () => {
    vi.mocked(queryDemo).mockResolvedValue(detail)
    const query = { op: 'application', id: application.id } as const
    const result = await admissionsService.query(query, tutor.id)
    expectTypeOf(result).toEqualTypeOf<ApplicationDetail>()
    expect(result).toEqual(detail)
    expect(queryDemo).toHaveBeenCalledWith(query, tutor.id)
  })

  it('passes commands through the selected adapter without changing their payload', async () => {
    vi.mocked(commandDemo).mockResolvedValue({ id: application.id })
    const command = { op: 'evaluate', id: application.id } as const
    expect(await admissionsService.command(command, tutor.id)).toEqual({ id: application.id })
    expect(commandDemo).toHaveBeenCalledWith(command, tutor.id)
  })

  it('returns original binary contents without putting blobs into a query response', async () => {
    const original = new Blob(['%PDF original bytes'], { type: 'application/pdf' })
    vi.mocked(authorizedFile).mockResolvedValue(original)
    const result = await admissionsService.originalDocument('document-1', tutor.id)
    expect(result).toBe(original)
    expect(await result.text()).toBe('%PDF original bytes')
    expect(authorizedFile).toHaveBeenCalledWith('document-1', tutor.id)
    expect(queryDemo).not.toHaveBeenCalled()
  })

  it('preserves access failures instead of substituting another data source', async () => {
    const error = new Error('Tutor access required.')
    vi.mocked(authorizedFile).mockRejectedValue(error)
    await expect(admissionsService.originalDocument('document-1', null)).rejects.toBe(error)
    expect(queryDemo).not.toHaveBeenCalled()
    expect(commandDemo).not.toHaveBeenCalled()
  })
})
