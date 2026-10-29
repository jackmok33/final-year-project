// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { releaseUploads, stageUploads } from '../services/fileStaging'
import { inspectPdf } from '../services/pdf'
import '../test/domSetup'
import { otherProgramme, programme, tutor } from '../test/fixtures'
import {
  apiMocks,
  command,
  queryResult,
  resetPageMocks,
  unwrap,
  workspaceMock,
} from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { NewApplicationPage } from './NewApplicationPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
vi.mock('../services/pdf', () => ({ inspectPdf: vi.fn() }))
vi.mock('../services/fileStaging', () => ({
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
  it.each(['programme', 'intake'] as const)(
    'starts a fresh draft when the selected %s changes',
    async (scope) => {
      const view = renderIntake()
      await userEvent.type(screen.getByLabelText(/Candidate reference/), 'OLD-CANDIDATE')
      await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
      await screen.findByText('4 / 100 pages per application')
      workspaceMock.mockReturnValue({
        user: tutor,
        programme: scope === 'programme' ? otherProgramme : programme,
        programmes: [programme, otherProgramme],
        intakeYear: scope === 'intake' ? '2025 / 26' : programme.year,
      })
      view.rerender(<NewApplicationPage />)
      expect(screen.getByLabelText(/Candidate reference/)).toHaveValue('')
      expect(screen.getByText('0 / 100 pages per application')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Remove Transcript' })).not.toBeInTheDocument()
      expect(command).not.toHaveBeenCalled()
    },
  )
  it('starts a fresh draft when the route switches to another batch in the same intake', async () => {
    apiMocks.useBatchQuery.mockImplementation((id: string) =>
      queryResult({ id, programmeId: programme.id, intakeYear: programme.year }),
    )
    function SwitchBatch() {
      const navigate = useNavigate()
      return (
        <button onClick={() => navigate('/applications/new?batch=second')}>Switch batch</button>
      )
    }
    renderPage(
      <>
        <SwitchBatch />
        <NewApplicationPage />
      </>,
      '/applications/new?batch=first',
      '*',
    )
    await userEvent.type(screen.getByLabelText(/Candidate reference/), 'OLD-BATCH')
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
    await screen.findByText('4 / 100 pages per application')
    await userEvent.click(screen.getByRole('button', { name: 'Switch batch' }))
    expect(screen.getByLabelText(/Candidate reference/)).toHaveValue('')
    expect(screen.getByText('0 / 100 pages per application')).toBeInTheDocument()
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('batch=second')
  })
  it.each(['success', 'failure'] as const)(
    'ignores earlier PDF inspection %s after changing intake',
    async (outcome) => {
      let finish!: () => void
      vi.mocked(inspectPdf).mockReturnValueOnce(
        new Promise((resolve, reject) => {
          finish = () =>
            outcome === 'success'
              ? resolve({ pages: 80 })
              : reject(new Error('Earlier intake PDF failed'))
        }),
      )
      const view = renderIntake()
      await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
      workspaceMock.mockReturnValue({
        user: tutor,
        programme,
        programmes: [programme],
        intakeYear: '2025 / 26',
      })
      view.rerender(<NewApplicationPage />)
      await act(async () => {
        finish()
      })
      expect(screen.getByText('0 / 100 pages per application')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Remove Transcript' })).not.toBeInTheDocument()
      expect(screen.queryByText('Earlier intake PDF failed')).not.toBeInTheDocument()
      await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
      expect(await screen.findByText('4 / 100 pages per application')).toBeInTheDocument()
    },
  )
  it('does not navigate when an earlier intake finishes creating an application, but releases its staged files', async () => {
    let finish!: (result: { id?: string }) => void
    unwrap.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const view = renderIntake()
    await userEvent.type(screen.getByLabelText(/Candidate reference/), 'OLD-INTAKE')
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
    await screen.findByText('4 / 100 pages per application')
    await userEvent.click(screen.getByRole('button', { name: 'Create application' }))
    workspaceMock.mockReturnValue({
      user: tutor,
      programme,
      programmes: [programme],
      intakeYear: '2025 / 26',
    })
    view.rerender(<NewApplicationPage />)
    await act(async () => {
      finish({ id: 'OLD-CREATED' })
    })
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/applications/new')
    expect(screen.getByLabelText(/Candidate reference/)).toHaveValue('')
    expect(releaseUploads).toHaveBeenCalledWith([{ id: 'upload-1', type: 'transcript' }])
  })
  it('uses ownership rather than the legacy assignment projection to enable creation', async () => {
    workspaceMock.mockReturnValue({
      user: { ...tutor, programmeIds: [] },
      programme,
      programmes: [programme],
    })
    renderIntake()
    await userEvent.type(screen.getByLabelText(/Candidate reference/), 'OWNED')
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create application' })).toBeEnabled(),
    )
  })
  it('finishes staging cleanup without redirecting after leaving the upload screen', async () => {
    let finish!: (result: { id?: string }) => void
    unwrap.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const view = renderIntake()
    await userEvent.type(screen.getByLabelText(/Candidate reference/), 'UNMOUNTED')
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
    await screen.findByText('4 / 100 pages per application')
    await userEvent.click(screen.getByRole('button', { name: 'Create application' }))
    view.rerender(<p>Another screen</p>)
    await act(async () => {
      finish({ id: 'LATE-CREATED' })
    })
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/applications/new')
    expect(releaseUploads).toHaveBeenCalledWith([{ id: 'upload-1', type: 'transcript' }])
  })
  it.each([
    { ...tutor, id: 'another-tutor' },
    { ...tutor, active: false },
    { ...tutor, roles: ['admin'] as const },
  ])('does not create for an inactive, non-tutor or non-owner account', async (user) => {
    workspaceMock.mockReturnValue({ user, programme, programmes: [programme] })
    renderIntake()
    await userEvent.type(screen.getByLabelText(/Candidate reference/), 'FORBIDDEN')
    await userEvent.upload(screen.getByLabelText('Upload Transcript'), file())
    await screen.findByText('4 / 100 pages per application')
    expect(screen.getByRole('button', { name: 'Create application' })).toBeDisabled()
    fireEvent.submit(screen.getByLabelText(/Candidate reference/).closest('form')!)
    expect(stageUploads).not.toHaveBeenCalled()
    expect(command).not.toHaveBeenCalled()
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
