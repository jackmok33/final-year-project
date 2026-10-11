// @vitest-environment jsdom
import '../test/domSetup'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiMocks, dispatch, queryResult, resetPageMocks, state } from '../test/pageMocks'
import { administrator, otherProgramme, tutor } from '../test/fixtures'
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
  })
})
