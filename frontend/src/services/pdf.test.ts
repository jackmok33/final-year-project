import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import { inspectPdf, MAX_FILE_SIZE, openPdf } from './pdf'
vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn(), GlobalWorkerOptions: { workerSrc: '' } }))
const destroy = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getDocument).mockReturnValue({
    promise: Promise.resolve({ numPages: 4, loadingTask: { destroy } }),
  } as never)
})
describe('PDF upload inspection', () => {
  it('uses the locally bundled worker and passes bytes to PDF.js', async () => {
    const file = new File(['%PDF'], 'source.PDF', { type: 'application/pdf' })
    expect(GlobalWorkerOptions.workerSrc).toContain('pdf.worker')
    expect(await inspectPdf(file)).toEqual({ pages: 4 })
    expect(getDocument).toHaveBeenCalledWith({
      data: await file.arrayBuffer(),
      useSystemFonts: true,
    })
    expect(destroy).toHaveBeenCalledOnce()
  })
  it.each([
    new File(['x'], 'source.txt', { type: 'application/pdf' }),
    new File(['x'], 'source.pdf', { type: 'text/plain' }),
    new File([], 'empty.pdf', { type: 'application/pdf' }),
  ])('rejects invalid type or empty documents before parsing', async (file) => {
    await expect(inspectPdf(file)).rejects.toThrow()
    expect(getDocument).not.toHaveBeenCalled()
  })
  it('accepts missing MIME types but enforces the exact 20 MB boundary', async () => {
    const file = new File(['%PDF'], 'source.pdf')
    Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE, configurable: true })
    await expect(inspectPdf(file)).resolves.toEqual({ pages: 4 })
    Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE + 1 })
    await expect(inspectPdf(file)).rejects.toThrow('20 MB')
  })
  it.each([100, 101])('handles the %s-page limit and releases the PDF task', async (pages) => {
    vi.mocked(getDocument).mockReturnValue({
      promise: Promise.resolve({ numPages: pages, loadingTask: { destroy } }),
    } as never)
    const result = inspectPdf(new File(['%PDF'], 'source.pdf'))
    if (pages === 100) await expect(result).resolves.toEqual({ pages })
    else await expect(result).rejects.toThrow('100 pages')
    expect(destroy).toHaveBeenCalledOnce()
  })
  it('explains unreadable/password-protected PDFs without hiding the cause', async () => {
    const cause = new Error('PasswordException')
    vi.mocked(getDocument).mockReturnValue({ destroy, promise: Promise.reject(cause) } as never)
    await expect(inspectPdf(new File(['bad'], 'source.pdf'))).rejects.toMatchObject({
      message: expect.stringContaining('password-protected'),
      cause,
    })
  })
  it('destroys a failed PDF loading task before reporting an unreadable upload', async () => {
    vi.mocked(getDocument).mockReturnValue({
      destroy,
      promise: Promise.reject(new Error('Corrupt PDF')),
    } as never)
    await expect(inspectPdf(new File(['broken'], 'broken.pdf'))).rejects.toThrow('cannot be read')
    expect(destroy).toHaveBeenCalledOnce()
  })
  it('preserves the parsing error if task cleanup also rejects', async () => {
    destroy.mockRejectedValueOnce(new Error('Worker cleanup failed'))
    const cause = new Error('Corrupt PDF')
    vi.mocked(getDocument).mockReturnValue({ destroy, promise: Promise.reject(cause) } as never)
    await expect(openPdf(new Blob(['broken']))).rejects.toBe(cause)
  })
  it('propagates file read failures from the viewer loader', async () => {
    await expect(
      openPdf({ arrayBuffer: () => Promise.reject(new Error('Read failed')) } as Blob),
    ).rejects.toThrow('Read failed')
  })
})
