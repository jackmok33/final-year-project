// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { admissionsService } from '../../services/admissions'
import { openPdf } from '../../services/pdf'
import '../../test/domSetup'
import { documents } from '../../test/fixtures'
import { PdfViewer } from './PdfViewer'
vi.mock('../../services/admissions', () => ({ admissionsService: { originalDocument: vi.fn() } }))
vi.mock('../../services/pdf', () => ({ openPdf: vi.fn() }))
const cancel = vi.fn(),
  destroy = vi.fn(),
  renderPdf = vi.fn(),
  getPage = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(admissionsService.originalDocument).mockResolvedValue(new Blob(['%PDF']))
  renderPdf.mockReturnValue({ promise: Promise.resolve(), cancel })
  getPage.mockResolvedValue({
    getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
    render: renderPdf,
    getTextContent: async () => ({
      items: [{ str: 'Original embedded PDF text' }, { type: 'image' }],
    }),
  })
  vi.mocked(openPdf).mockResolvedValue({ getPage, loadingTask: { destroy } } as never)
})
describe('local PDF viewer lifecycle', () => {
  it('authorises the original, renders its page and exposes accessible embedded text', async () => {
    const view = render(<PdfViewer document={documents[0]} page={2} userId="tutor-a" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading PDF page')
    expect(await screen.findByText('Original embedded PDF text')).toBeInTheDocument()
    expect(admissionsService.originalDocument).toHaveBeenCalledWith(documents[0].id, 'tutor-a')
    expect(getPage).toHaveBeenCalledWith(2)
    expect(screen.getByRole('img')).toHaveAccessibleName(/transcript.pdf, page 2/)
    view.unmount()
    expect(cancel).toHaveBeenCalledOnce()
    expect(destroy).toHaveBeenCalledOnce()
  })
  it('cancels the previous page render when navigation changes', async () => {
    const view = render(<PdfViewer document={documents[0]} page={1} userId="tutor-a" />)
    await screen.findByText('Original embedded PDF text')
    view.rerender(<PdfViewer document={documents[0]} page={3} userId="tutor-a" />)
    await waitFor(() => expect(getPage).toHaveBeenCalledWith(3))
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('shows the storage/permission error and stops the loading status', async () => {
    vi.mocked(admissionsService.originalDocument).mockRejectedValue(
      new Error('Original PDF missing'),
    )
    render(<PdfViewer document={documents[0]} page={1} userId="tutor-a" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Original PDF missing')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(openPdf).not.toHaveBeenCalled()
  })
  it('surfaces unreadable pages and provides an honest no-OCR fallback', async () => {
    getPage.mockRejectedValue(new Error('Page unavailable'))
    render(<PdfViewer document={documents[0]} page={1} userId="tutor-a" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Page unavailable')
    expect(screen.getByText(/no readable embedded text/)).toBeInTheDocument()
  })
  it('destroys a PDF that finishes loading after the viewer has unmounted', async () => {
    let finish!: (value: Awaited<ReturnType<typeof openPdf>>) => void
    vi.mocked(openPdf).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const view = render(<PdfViewer document={documents[0]} page={1} userId="tutor-a" />)
    await waitFor(() => expect(openPdf).toHaveBeenCalled())
    view.unmount()
    finish({ getPage, loadingTask: { destroy } } as never)
    await waitFor(() => expect(destroy).toHaveBeenCalledOnce())
    expect(getPage).not.toHaveBeenCalled()
  })
})
