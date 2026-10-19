// @vitest-environment jsdom
import '../test/domSetup'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
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
import { application, otherProgramme, programme, tutor } from '../test/fixtures'
import { renderPage } from '../test/renderPage'
import { ModulesPage } from './ModulesPage'
import { ModuleIntakesPage } from './ModuleIntakesPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../app/workspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
beforeEach(resetPageMocks)
describe('module workspace management', () => {
  function ownWorkspace(only = false) {
    const owned = { ...programme, createdBy: tutor.id }
    workspaceMock.mockReturnValue({
      user: tutor,
      programme: owned,
      programmes: only ? [owned] : [owned, otherProgramme],
    })
  }
  it('requires confirmation, previews deletion impact and returns to a remaining workspace', async () => {
    ownWorkspace()
    renderPage(<ModuleIntakesPage />, '/modules/programme-1', '/modules/:id')
    await userEvent.click(screen.getByRole('button', { name: 'Delete course' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName(`Delete course “${programme.name}”?`)
    expect(
      screen.getByText('This will delete 1 application, 3 PDFs and 2 criteria versions.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/other tutor.*lose access/)).not.toBeInTheDocument()
    expect(command).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(command).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Delete course' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(command).toHaveBeenCalledWith({
      op: 'deleteWorkspace',
      id: programme.id,
      confirmed: true,
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ui/selectProgramme',
      payload: { userId: tutor.id, programmeId: otherProgramme.id },
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('clears selection after deleting the last accessible workspace', async () => {
    ownWorkspace(true)
    renderPage(<ModuleIntakesPage />, '/modules/programme-1', '/modules/:id')
    await userEvent.click(screen.getByRole('button', { name: 'Delete course' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ui/selectProgramme',
      payload: { userId: tutor.id, programmeId: '' },
    })
  })
  it('cannot confirm until the impact loads, or when ownership checks fail', async () => {
    ownWorkspace()
    apiMocks.useWorkspaceDeletionQuery.mockReturnValue({ isFetching: true })
    const view = renderPage(<ModuleIntakesPage />, '/modules/programme-1', '/modules/:id')
    await userEvent.click(screen.getByRole('button', { name: 'Delete course' }))
    expect(screen.getByRole('status')).toHaveTextContent('Checking course contents')
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    apiMocks.useWorkspaceDeletionQuery.mockReturnValue({
      isFetching: false,
      error: { data: 'Ownership changed' },
    })
    view.rerender(<ModuleIntakesPage />)
    expect(screen.getByText('Ownership changed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    expect(command).not.toHaveBeenCalled()
  })
  it('preserves selection on storage errors and permits retrying deletion', async () => {
    ownWorkspace()
    unwrap.mockRejectedValueOnce({ data: 'Storage unavailable' })
    renderPage(<ModuleIntakesPage />, '/modules/programme-1', '/modules/:id')
    dispatch.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Delete course' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Storage unavailable')).toBeInTheDocument()
    expect(dispatch).not.toHaveBeenCalled()
    unwrap.mockResolvedValue({})
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('hides deletion for assigned workspaces created by someone else', () => {
    workspaceMock.mockReturnValue({
      user: tutor,
      programme: { ...programme, createdBy: 'tutor-b' },
      programmes: [{ ...programme, createdBy: 'tutor-b' }],
    })
    renderPage(<ModuleIntakesPage />, '/modules/programme-1', '/modules/:id')
    expect(screen.queryByRole('button', { name: 'Delete course' })).not.toBeInTheDocument()
  })
  it('adds a course by name, opens its intake picker and closes the dialog', async () => {
    unwrap.mockResolvedValue({ id: 'workspace-new' })
    renderPage(<ModulesPage />, '/modules', '*')
    await userEvent.click(screen.getByRole('button', { name: 'Add course' }))
    const input = screen.getByRole('textbox', { name: 'Course name' })
    expect(input).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Add course' })).toBeDisabled()
    await userEvent.type(input, '  Data Science & AI MSc  ')
    await userEvent.keyboard('{Enter}')
    expect(command).toHaveBeenCalledWith({ op: 'workspace', name: 'Data Science & AI MSc' })
    await waitFor(() =>
      expect(screen.getByLabelText('Current URL')).toHaveTextContent('/modules/workspace-new'),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('allows creating the first workspace without an assigned course and resets cancelled drafts', async () => {
    workspaceMock.mockReturnValue({ user: tutor, programmes: [], programme: undefined })
    renderPage(<ModulesPage />, '/modules', '*')
    expect(screen.getByRole('alert')).toHaveTextContent('do not have access')
    await userEvent.click(screen.getByRole('button', { name: 'Add course' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Course name' }), 'Draft')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Add course' }))
    expect(screen.getByRole('textbox', { name: 'Course name' })).toHaveValue('')
    expect(command).not.toHaveBeenCalled()
  })
  it('keeps failed drafts editable and rejects names longer than 100 characters', async () => {
    unwrap.mockRejectedValue({ data: 'Storage unavailable' })
    renderPage(<ModulesPage />, '/modules', '*')
    dispatch.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Add course' }))
    const input = screen.getByRole('textbox', { name: 'Course name' })
    await userEvent.type(input, 'COMP0003')
    await userEvent.click(screen.getByRole('button', { name: 'Add course' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable')
    expect(input).toHaveValue('COMP0003')
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ui/selectProgramme' }),
    )
    await userEvent.clear(input)
    await userEvent.type(input, 'x'.repeat(101))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add course' })).toBeDisabled()
  })
})
describe('module and intake selection', () => {
  it('renders module cards and keeps unassigned modules out of the page', () => {
    workspaceMock.mockReturnValue({
      user: tutor,
      programmes: [{ ...programme, name: 'Legacy course title' }],
      isLoading: false,
    })
    renderPage(<ModulesPage />, '/modules', '*')
    expect(screen.getByRole('link', { name: 'Open course Legacy course title' })).toHaveAttribute(
      'href',
      '/modules/programme-1',
    )
    expect(screen.getByRole('heading', { name: 'Legacy course title' })).toBeInTheDocument()
    expect(screen.queryByText(programme.code)).not.toBeInTheDocument()
    expect(screen.queryByText(programme.department)).not.toBeInTheDocument()
    expect(screen.queryByText(otherProgramme.name)).not.toBeInTheDocument()
  })
  it('shows three intake years and counts only applications belonging to each year', async () => {
    apiMocks.useApplicationsQuery.mockReturnValue(
      queryResult([application, { ...application, id: 'OLDER', intakeYear: '2025 / 26' }]),
    )
    renderPage(<ModuleIntakesPage />, '/modules/programme-1', '/modules/:id')
    expect(screen.getByRole('heading', { name: '26/27' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '25/26' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '24/25' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open 25/26 intake' }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ui/selectProgramme',
      payload: { userId: tutor.id, programmeId: programme.id, intakeYear: '2025 / 26' },
    })
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/batches')
  })
  it('rejects unassigned module deep links and skips their applications query', () => {
    renderPage(<ModuleIntakesPage />, '/modules/unassigned', '/modules/:id')
    expect(screen.getByRole('heading', { name: 'Course unavailable' })).toBeInTheDocument()
    expect(apiMocks.useApplicationsQuery).toHaveBeenCalledWith('unassigned', { skip: true })
    expect(screen.queryByRole('button', { name: /Open .* intake/ })).not.toBeInTheDocument()
  })
  it('shows module loading and lookup failures without inventing counts', () => {
    workspaceMock.mockReturnValue({ programmes: [], isLoading: true })
    const view = renderPage(<ModulesPage />, '/modules', '*')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    workspaceMock.mockReturnValue({ programmes: [], error: { data: 'Storage unavailable' } })
    view.rerender(<ModulesPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Storage unavailable')
  })
})
