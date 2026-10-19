import { describe, expect, it } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { MAX_ZIP_SIZE, readApplicantArchive } from './zip'
const archive = (files: Record<string, string>, name = 'November.zip') =>
  new File(
    [
      new Uint8Array(
        zipSync(
          Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)])),
        ),
      ),
    ],
    name,
  )
describe('applicant ZIP layout and bounded extraction', () => {
  it('imports applicant folders, preserves bytes and accepts an outer directory and common PDF filenames', async () => {
    const result = await readApplicantArchive(
      archive({
        'November/A-001/A-001_CV.pdf': 'original CV',
        'November/A-001/academic-transcript.PDF': 'transcript',
        'November/A-001/personal_statement.pdf': 'statement',
        'November/A-002/resume.pdf': 'resume',
        '__MACOSX/._November': 'ignored',
        'November/.DS_Store': 'ignored',
      }),
    )
    expect(result.map((a) => a.candidate)).toEqual(['A-001', 'A-002'])
    expect(result[0].documents.map((d) => d.type)).toEqual(['cv', 'transcript', 'statement'])
    expect(await result[0].documents[0].file.text()).toBe('original CV')
    expect(result[1].documents).toHaveLength(1)
  })
  it.each([
    [{ 'cv.pdf': 'pdf' }, 'one folder per applicant'],
    [{ 'A/deep/folder/cv.pdf': 'pdf' }, 'one folder per applicant'],
    [{ '../A/cv.pdf': 'pdf' }, 'unsafe file path'],
    [{ '/A/cv.pdf': 'pdf' }, 'unsafe file path'],
    [{ 'A\\cv.pdf': 'pdf' }, 'unsafe file path'],
    [{ 'A/cv.docx': 'docx' }, 'PDF documents only'],
    [{ 'A/evidence.pdf': 'pdf' }, 'Cannot identify'],
    [{ 'A/cv-transcript.pdf': 'pdf' }, 'Cannot identify'],
    [{ 'A/cv.pdf': 'pdf', 'A/resume.pdf': 'pdf' }, 'one document per type'],
    [{ 'A/cv.pdf': 'pdf', 'A/CV.PDF': 'pdf' }, 'duplicate file paths'],
    [{ 'A/cv.pdf': 'pdf', 'a/transcript.pdf': 'pdf' }, 'unique, ignoring case'],
    [{ ' A/cv.pdf': 'pdf' }, 'trimmed'],
    [{ 'A/cv.pdf': '' }, 'non-empty'],
    [{ '.DS_Store': 'metadata' }, 'no applicant PDFs'],
  ] as [Record<string, string>, string][])(
    'rejects an unsupported or unsafe archive: %j',
    async (files, message) => {
      await expect(readApplicantArchive(archive(files))).rejects.toThrow(message)
    },
  )
  it('rejects empty, oversized, mislabelled and corrupt ZIPs', async () => {
    const large = archive({ 'A/cv.pdf': 'pdf' })
    Object.defineProperty(large, 'size', { value: MAX_ZIP_SIZE + 1 })
    for (const file of [
      large,
      new File([], 'empty.zip'),
      archive({ 'A/cv.pdf': 'pdf' }, 'wrong.pdf'),
    ])
      await expect(readApplicantArchive(file)).rejects.toThrow('100 MB')
    await expect(readApplicantArchive(new File(['not a ZIP'], 'broken.zip'))).rejects.toThrow(
      'cannot be read',
    )
  })
  it('rejects oversized PDFs and too many applicant folders before importing', async () => {
    await expect(
      readApplicantArchive(archive({ 'A/cv.pdf': 'x'.repeat(20 * 1024 * 1024 + 1) })),
    ).rejects.toThrow('20 MB')
    await expect(
      readApplicantArchive(
        archive(
          Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`A-${i}/cv.pdf`, 'pdf'])),
        ),
      ),
    ).rejects.toThrow('100 applicants')
  })
})

describe('ZIP metadata integrity', () => {
  function zipBytes() {
    return zipSync({ 'A/cv.pdf': strToU8('original') })
  }
  function tamperSize(size: number) {
    const bytes = zipBytes()
    const view = new DataView(bytes.buffer)
    for (let offset = 0; offset <= bytes.length - 28; offset++)
      if (view.getUint32(offset, true) === 0x02014b50) view.setUint32(offset + 24, size, true)
    return new File([new Uint8Array(bytes)], 'tampered.zip')
  }
  it('rejects inconsistent declared sizes instead of accepting partial PDFs', async () => {
    await expect(readApplicantArchive(tamperSize(1))).rejects.toThrow('size limit')
    await expect(readApplicantArchive(tamperSize(20))).rejects.toThrow('incomplete PDF')
  })
  it('limits aggregate extracted size before decompression and caps ignored entries too', async () => {
    const bytes = zipSync(
      Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`A-${i}/cv.pdf`, strToU8('pdf')])),
    )
    const view = new DataView(bytes.buffer)
    for (let offset = 0; offset <= bytes.length - 28; offset++)
      if (view.getUint32(offset, true) === 0x02014b50)
        view.setUint32(offset + 24, 20 * 1024 * 1024, true)
    await expect(
      readApplicantArchive(new File([new Uint8Array(bytes)], 'large.zip')),
    ).rejects.toThrow('200 MB')
    const many = archive(
      Object.fromEntries(Array.from({ length: 1001 }, (_, i) => [`__MACOSX/${i}`, 'metadata'])),
    )
    await expect(readApplicantArchive(many)).rejects.toThrow('too many files')
  })
  it('reads uncompressed PDFs spanning multiple input chunks without changing bytes', async () => {
    const text = 'original PDF content '.repeat(5000)
    const bytes = zipSync({ 'A/cv.pdf': strToU8(text) }, { level: 0 })
    const result = await readApplicantArchive(new File([new Uint8Array(bytes)], 'stored.zip'))
    expect(await result[0].documents[0].file.text()).toBe(text)
  })
})
