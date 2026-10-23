// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob } from '../components/files'
import { authorizedFile } from '../services/demo'
import '../test/domSetup'
import { detail, documents, run } from '../test/fixtures'
import { apiMocks, queryResult, resetPageMocks } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { EvidencePage } from './EvidencePage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
vi.mock('../services/demo', () => ({ authorizedFile: vi.fn() }))
vi.mock('../components/files', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadBlob: vi.fn(),
}))
vi.mock('../components/evidence/PdfViewer', () => ({
  PdfViewer: ({ page, document }: { page: number; document: { name: string } }) => (
    <div role="img" aria-label={`${document.name}, page ${page}`} />
  ),
}))
describe('source evidence page', () => {
  beforeEach(resetPageMocks)
  it('does not display the previous application document while the next record loads', () => {
    apiMocks.useApplicationQuery.mockReturnValue({
      ...queryResult(detail),
      currentData: undefined,
    })
    renderPage(<EvidencePage />, '/applications/APP-OTHER/evidence')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download original' })).not.toBeInTheDocument()
  })
  it.each([
    'document=missing&page=1',
    `document=${documents[0].id}&page=0`,
    `document=${documents[0].id}&page=1.5`,
    `document=${documents[0].id}&page=99`,
    `document=${documents[0].id}&page=2&run=missing`,
  ])('rejects invalid citation parameters %s', (query) => {
    renderPage(<EvidencePage />, `/applications/APP-TEST/evidence?${query}`)
    expect(screen.getByText(/citation has not been verified/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download original' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
  it('opens the exact cited run/page and keeps run identity during page navigation', async () => {
    renderPage(
      <EvidencePage />,
      `/applications/APP-TEST/evidence?document=${documents[0].id}&page=2&run=${run.id}`,
    )
    expect(screen.getByRole('img', { name: 'transcript.pdf, page 2' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'transcript.pdf, page 2' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByLabelText('Current URL')).toHaveTextContent(`page=3&run=${run.id}`)
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByRole('img', { name: 'transcript.pdf, page 2' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('combobox', { name: 'Original document' }))
    await userEvent.click(screen.getByRole('option', { name: 'cv.pdf' }))
    expect(screen.getByRole('img', { name: 'cv.pdf, page 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  })
  it('downloads the authorised original and surfaces access/storage failures', async () => {
    const blob = new Blob(['%PDF'])
    vi.mocked(authorizedFile)
      .mockResolvedValueOnce(blob)
      .mockRejectedValueOnce(new Error('Original PDF is missing'))
    renderPage(<EvidencePage />, '/applications/APP-TEST/evidence')
    await userEvent.click(screen.getByRole('button', { name: 'Download original' }))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, 'transcript.pdf'))
    expect(authorizedFile).toHaveBeenCalledWith(documents[0].id, 'tutor-a')
    await userEvent.click(screen.getByRole('button', { name: 'Download original' }))
    expect(await screen.findByText('Original PDF is missing')).toBeInTheDocument()
  })
})
