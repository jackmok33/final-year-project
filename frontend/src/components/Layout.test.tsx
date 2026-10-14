// @vitest-environment jsdom
import '../test/domSetup'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import {
  apiMocks,
  command,
  dispatch,
  queryResult,
  resetPageMocks,
  state,
  unwrap,
  workspaceMock,
} from '../test/pageMocks'
import { administrator, otherProgramme, programme, tutor } from '../test/fixtures'
import { renderPage } from '../test/renderPage'
import { Layout, Protected } from './Layout'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../app/workspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
beforeEach(resetPageMocks)
function guard(admin = false) {
  return render(
    <MemoryRouter initialEntries={['/secure']}>
      <Routes>
        <Route element={<Protected admin={admin} />}>
          <Route path="/secure" element={<p>Protected content</p>} />
        </Route>
        <Route path="/login" element={<p>Sign-in destination</p>} />
        <Route path="/applications" element={<p>Tutor destination</p>} />
        <Route path="/admin/health" element={<p>Admin destination</p>} />
      </Routes>
    </MemoryRouter>,
  )
}
describe('permission guards', () => {
  it('redirects anonymous users to sign-in without requesting a profile', () => {
    state.session.userId = null
    guard()
    expect(screen.getByText('Sign-in destination')).toBeInTheDocument()
    expect(apiMocks.useMeQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ skip: true }),
    )
  })
  it.each([
    [false, tutor],
    [true, administrator],
  ])('permits only the matching role', (admin, user) => {
    apiMocks.useMeQuery.mockReturnValue(queryResult(user))
    guard(admin)
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })
  it('does not grant applicant access to an administrator', () => {
    apiMocks.useMeQuery.mockReturnValue(queryResult(administrator))
    guard()
    expect(screen.getByText('Admin destination')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })
  it('does not grant administrative access to a tutor', () => {
    guard(true)
    expect(screen.getByText('Tutor destination')).toBeInTheDocument()
  })
  it('waits for profile loading and handles a deactivated/unavailable session', async () => {
    apiMocks.useMeQuery.mockReturnValue({ isLoading: true })
    const view = guard()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    view.unmount()
    apiMocks.useMeQuery.mockReturnValue({ error: { data: 'Account deactivated' } })
    guard()
    expect(screen.getByText('Account deactivated')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Return to demo sign-in' }))
    expect(dispatch.mock.calls).toEqual([[{ type: 'session/signOut' }], [{ type: 'api/reset' }]])
  })
})
describe('workspace navigation', () => {
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
    renderPage(<Layout />, '/applications', '*')
    await userEvent.click(screen.getByRole('button', { name: 'Delete workspace' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName(`Delete “${programme.name}”?`)
    expect(
      screen.getByText('This will delete 1 application, 3 PDFs and 2 criteria versions.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('1 other tutor will lose access to this workspace.'),
    ).toBeInTheDocument()
    expect(command).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(command).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Delete workspace' }))
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
    renderPage(<Layout />, '/applications', '*')
    await userEvent.click(screen.getByRole('button', { name: 'Delete workspace' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ui/selectProgramme',
      payload: { userId: tutor.id, programmeId: '' },
    })
  })
  it('cannot confirm until the impact loads, or when ownership checks fail', async () => {
    ownWorkspace()
    apiMocks.useWorkspaceDeletionQuery.mockReturnValue({ isFetching: true })
    const view = renderPage(<Layout />, '/applications', '*')
    await userEvent.click(screen.getByRole('button', { name: 'Delete workspace' }))
    expect(screen.getByRole('status')).toHaveTextContent('Checking workspace contents')
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    apiMocks.useWorkspaceDeletionQuery.mockReturnValue({
      isFetching: false,
      error: { data: 'Ownership changed' },
    })
    view.rerender(<Layout />)
    expect(screen.getByText('Ownership changed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    expect(command).not.toHaveBeenCalled()
  })
  it('preserves selection on storage errors and permits retrying deletion', async () => {
    ownWorkspace()
    unwrap.mockRejectedValueOnce({ data: 'Storage unavailable' })
    renderPage(<Layout />, '/applications', '*')
    dispatch.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Delete workspace' }))
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
      programmes: [programme],
    })
    renderPage(<Layout />, '/applications', '*')
    expect(screen.queryByRole('button', { name: 'Delete workspace' })).not.toBeInTheDocument()
  })
  it('creates a named workspace, selects it and closes the dialog', async () => {
    unwrap.mockResolvedValue({ id: 'workspace-new' })
    renderPage(<Layout />, '/applications', '*')
    await userEvent.click(screen.getByRole('button', { name: 'New workspace' }))
    const input = screen.getByRole('textbox', { name: 'Workspace name' })
    expect(input).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeDisabled()
    await userEvent.type(input, '  Computer Science MSc  ')
    await userEvent.keyboard('{Enter}')
    expect(command).toHaveBeenCalledWith({ op: 'workspace', name: 'Computer Science MSc' })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ui/selectProgramme',
      payload: { userId: tutor.id, programmeId: 'workspace-new' },
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('allows creating the first workspace without an assigned course and resets cancelled drafts', async () => {
    workspaceMock.mockReturnValue({ user: tutor, programmes: [], programme: undefined })
    renderPage(<Layout />, '/applications', '*')
    expect(screen.getByRole('combobox', { name: 'Programme workspace' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await userEvent.click(screen.getByRole('button', { name: 'New workspace' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Workspace name' }), 'Draft')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'New workspace' }))
    expect(screen.getByRole('textbox', { name: 'Workspace name' })).toHaveValue('')
    expect(command).not.toHaveBeenCalled()
  })
  it('keeps failed drafts editable and rejects names longer than 100 characters', async () => {
    unwrap.mockRejectedValue({ data: 'Storage unavailable' })
    renderPage(<Layout />, '/applications', '*')
    dispatch.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'New workspace' }))
    const input = screen.getByRole('textbox', { name: 'Workspace name' })
    await userEvent.type(input, 'My programme')
    await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable')
    expect(input).toHaveValue('My programme')
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ui/selectProgramme' }),
    )
    await userEvent.clear(input)
    await userEvent.type(input, 'x'.repeat(101))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeDisabled()
  })
  it('switches course, closes navigation and returns to its queue', async () => {
    renderPage(<Layout />, '/applications', '*')
    await userEvent.click(screen.getByRole('combobox', { name: 'Programme workspace' }))
    await userEvent.click(screen.getByRole('option', { name: otherProgramme.name }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ui/selectProgramme',
      payload: { userId: tutor.id, programmeId: otherProgramme.id },
    })
    expect(dispatch).toHaveBeenCalledWith({ type: 'ui/setNavigationOpen', payload: false })
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'session/signOut' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'api/reset' })
  })
  it('offers administration navigation and a role switch only for dual-role users', () => {
    apiMocks.useMeQuery.mockReturnValue(queryResult({ ...tutor, roles: ['tutor', 'admin'] }))
    renderPage(<Layout />, '/admin/health', '*')
    expect(screen.getByRole('link', { name: 'Users & access' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Switch to tutor workspace' })).toHaveAttribute(
      'href',
      '/applications',
    )
    expect(screen.queryByRole('combobox', { name: 'Programme workspace' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New workspace' })).not.toBeInTheDocument()
  })
})
