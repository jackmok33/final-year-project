// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { releaseUploads, stageUploads } from '../services/demo'
import { inspectPdf } from '../services/pdf'
import '../test/domSetup'
import { programme } from '../test/fixtures'
import { command, resetPageMocks, unwrap, workspaceMock } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { NewApplicationPage } from './NewApplicationPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
vi.mock('../services/pdf', () => ({ inspectPdf: vi.fn() }))
vi.mock('../services/demo', () => ({
  stageUploads: vi.fn(() => [{ id: 'upload-1', type: 'transcript' }]),
  releaseUploads: vi.fn(),
}))
describe('new application upload', () => {
  beforeEach(() => {
    resetPageMocks()
    vi.mocked(inspectPdf).mockResolvedValue({ pages: 4 })
  })
  const renderIntake = () => renderPage(<NewApplicationPage />, '/applications/new', '*')
  const file = () => new File(['%PDF'], 'transcript.pdf', { type: 'application/pdf' })
  it('validates an original PDF, submits it to the selected course and releases staged files', async () => {
    renderIntake()
    expect(screen.getByRole('button', { name: 'Create application' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/Candidate reference/), 'SYN-200')
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
    expect(await screen.findByText('4 / 100 pages per application')).toBeInTheDocument()
    expect(inspectPdf).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Create application' }))
    expect(stageUploads).toHaveBeenCalledWith([{ type: 'transcript', file: expect.any(File) }])
    expect(command).toHaveBeenCalledWith({
      op: 'create',
      candidate: 'SYN-200',
      programmeId: programme.id,
      intakeYear: programme.year,
      uploads: [{ id: 'upload-1', type: 'transcript' }],
    })
    await waitFor(() => expect(releaseUploads).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByLabelText('Current URL')).toHaveTextContent('/applications/APP-CREATED'),
    )
  })
  it('rejects unreadable files and lets users select the same file again', async () => {
    vi.mocked(inspectPdf).mockRejectedValueOnce(new Error('Unreadable PDF'))
    renderIntake()
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
    expect(await screen.findByText('Unreadable PDF')).toBeInTheDocument()
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
    expect(await screen.findByText('4 / 100 pages per application')).toBeInTheDocument()
    expect(inspectPdf).toHaveBeenCalledTimes(2)
    await userEvent.click(screen.getByRole('button', { name: 'Remove Transcript' }))
    expect(screen.getByText('0 / 100 pages per application')).toBeInTheDocument()
  })
  it('clears an earlier PDF when its replacement fails validation, then allows retry', async () => {
    renderIntake()
    await userEvent.type(screen.getByLabelText(/Candidate reference/), 'SYN-200')
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create application' })).toBeEnabled(),
    )

    vi.mocked(inspectPdf).mockRejectedValueOnce(new Error('Unreadable replacement PDF'))
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
    expect(await screen.findByText('Unreadable replacement PDF')).toBeInTheDocument()
    expect(screen.getByText('0 / 100 pages per application')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Transcript' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create application' })).toBeDisabled()
    expect(stageUploads).not.toHaveBeenCalled()

    const replacement = new File(['%PDF-new'], 'replacement.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), replacement)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create application' })).toBeEnabled(),
    )
    expect(screen.queryByText('Unreadable replacement PDF')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create application' }))
    expect(stageUploads).toHaveBeenCalledWith([{ type: 'transcript', file: replacement }])
  })
  it('blocks more than 100 combined pages and allows removal to recover', async () => {
    vi.mocked(inspectPdf).mockResolvedValue({ pages: 60 })
    renderIntake()
    await userEvent.type(screen.getByLabelText(/Candidate reference/), 'SYN-200')
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create application' })).toBeEnabled(),
    )
    await userEvent.upload(
      screen.getByLabelText('Upload CV'),
      new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' }),
    )
    expect(await screen.findByText('120 / 100 pages per application')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create application' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Remove CV' }))
    expect(screen.getByRole('button', { name: 'Create application' })).toBeEnabled()
  })
  it('releases staged uploads on failure while preserving inputs for retry', async () => {
    unwrap.mockRejectedValue(new Error('Storage full'))
    renderIntake()
    fireEvent.change(screen.getByLabelText(/Candidate reference/), { target: { value: 'SYN-200' } })
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create application' })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Create application' }))
    await waitFor(() => expect(releaseUploads).toHaveBeenCalled())
    expect(screen.getByLabelText(/Candidate reference/)).toHaveValue('SYN-200')
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/applications/new')
  })
  it.each([
    { isLoading: true },
    { isLoading: false, error: { data: 'Workspace failed' } },
    { isLoading: false },
  ])('handles missing/loading/failed workspace data', (workspace) => {
    workspaceMock.mockReturnValue(workspace)
    renderIntake()
    expect(screen.queryByRole('button', { name: 'Create application' })).not.toBeInTheDocument()
  })
})
