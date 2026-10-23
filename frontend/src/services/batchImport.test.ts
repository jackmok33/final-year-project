import { strToU8, zipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dataset, programme } from '../test/fixtures'
import { prepareBatchImport } from './batchImport'
import { inspectPdf } from './pdf'
import { sha256 } from './storage'

vi.mock('./pdf', () => ({ inspectPdf: vi.fn() }))
beforeEach(() => {
  vi.mocked(inspectPdf).mockResolvedValue({ pages: 2 })
})
function archive() {
  return new File(
    [
      new Uint8Array(
        zipSync({
          'Student 1/cv.pdf': strToU8('original cv'),
          'Student 2/transcript.pdf': strToU8('original transcript'),
        }),
      ),
    ],
    'applicants.zip',
  )
}
describe('prepareBatchImport', () => {
  it('prepares linked records and exact original bytes without mutating the dataset', async () => {
    const data = structuredClone(dataset),
      before = structuredClone(data)
    const result = await prepareBatchImport(data, archive(), programme, '2025 / 26', 'tutor-a')
    expect(data).toEqual(before)
    expect(result.batch).toMatchObject({
      programmeId: programme.id,
      intakeYear: '2025 / 26',
      uploadedBy: 'tutor-a',
      filename: 'applicants.zip',
    })
    expect(result.applications).toHaveLength(2)
    for (const app of result.applications) {
      expect(app).toMatchObject({ batchId: result.batch.id, runs: [], decisions: [] })
      const doc = result.documents.find((doc) => doc.applicationId === app.id)!
      expect(app.documentIds).toEqual([doc.id])
      expect(doc.hash).toBe(await sha256(result.files[doc.id]))
    }
    expect(await result.files[result.documents[0].id].text()).toBe('original cv')
  })
  it('identifies the candidate and filename when PDF validation fails', async () => {
    vi.mocked(inspectPdf).mockRejectedValue(new Error('Unreadable PDF'))
    const data = structuredClone(dataset)
    await expect(
      prepareBatchImport(data, archive(), programme, programme.year, 'tutor-a'),
    ).rejects.toThrow('Student 1 / cv.pdf: Unreadable PDF')
    expect(data).toEqual(dataset)
  })
})
