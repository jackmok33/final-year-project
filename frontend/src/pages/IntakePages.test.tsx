// @vitest-environment jsdom
import '../test/domSetup'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  apiMocks,
  command,
  dispatch,
  queryResult,
  resetPageMocks,
  unwrap,
  workspaceMock,
} from '../test/pageMocks'
import { administrator, programme, tutor } from '../test/fixtures'
import { renderPage } from '../test/renderPage'
import { LoginPage } from './LoginPage'
import { NewApplicationPage } from './NewApplicationPage'
import { inspectPdf } from '../services/pdf'
import { releaseUploads, stageUploads } from '../services/demo'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../app/workspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
vi.mock('../services/pdf', () => ({ inspectPdf: vi.fn() }))
vi.mock('../services/demo', () => ({
  stageUploads: vi.fn(() => [{ id: 'upload-1', type: 'transcript' }]),
  releaseUploads: vi.fn(),
}))
beforeEach(() => {
  resetPageMocks()
  vi.mocked(inspectPdf).mockResolvedValue({ pages: 4 })
})
describe('demo sign-in', () => {
  it.each([
    ['tutor', tutor, '/modules'],
    ['admin', administrator, '/admin/health'],
  ] as const)('signs in a %s and clears cached user data', async (_role, account, destination) => {
    apiMocks.useAccountsQuery.mockReturnValue(queryResult([account]))
    renderPage(<LoginPage />, '/login', '/login')
    expect(screen.getByRole('img', { name: 'UCL' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Application Review Workspace', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Account' })).toHaveTextContent(account.name)
    expect(screen.queryByText(/Demo environment|Synthetic data/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(dispatch.mock.calls).toEqual([
      [{ type: 'api/reset' }],
      [{ type: 'session/signIn', payload: account.id }],
    ])
    expect(screen.getByLabelText('Current URL')).toHaveTextContent(destination)
  })
  it('excludes inactive accounts and changes the selected demo account', async () => {
    apiMocks.useAccountsQuery.mockReturnValue(
      queryResult([
        tutor,
        administrator,
        { ...tutor, id: 'former', name: 'Former tutor', active: false },
      ]),
    )
    renderPage(<LoginPage />, '/login', '/login')
    await userEvent.click(screen.getByRole('combobox', { name: 'Account' }))
    expect(screen.queryByRole('option', { name: 'Former tutor' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: administrator.name }))
    expect(screen.getByRole('combobox', { name: 'Account' })).toHaveTextContent(administrator.name)
  })
  it('disables sign-in when no active accounts exist', () => {
    apiMocks.useAccountsQuery.mockReturnValue(queryResult([{ ...tutor, active: false }]))
    renderPage(<LoginPage />, '/login', '/login')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })
  it('shows loading and query failures', () => {
    apiMocks.useAccountsQuery.mockReturnValue({ isLoading: true })
    const view = renderPage(<LoginPage />, '/login', '/login')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    apiMocks.useAccountsQuery.mockReturnValue({
      isLoading: false,
      error: { data: 'Accounts unavailable' },
    })
    view.rerender(<LoginPage />)
    expect(screen.getByText('Accounts unavailable')).toBeInTheDocument()
  })
})
describe('new application upload', () => {
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
