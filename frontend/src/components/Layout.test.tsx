// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { administrator, otherProgramme, programme, tutor } from '../test/fixtures'
import {
  apiMocks,
  dispatch,
  queryResult,
  resetPageMocks,
  state,
  workspaceMock,
} from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { Layout } from './Layout'
import { ProtectedRoute } from './auth/ProtectedRoute'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
beforeEach(resetPageMocks)
function guard(admin = false) {
  return render(
    <MemoryRouter initialEntries={['/secure']}>
      <Routes>
        <Route element={<ProtectedRoute admin={admin} />}>
          <Route path="/secure" element={<p>Protected content</p>} />
        </Route>
        <Route path="/login" element={<p>Sign-in destination</p>} />
        <Route path="/modules" element={<p>Tutor destination</p>} />
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
    await userEvent.click(screen.getByRole('button', { name: 'Return to sign-in' }))
    expect(dispatch.mock.calls).toEqual([[{ type: 'session/signOut' }], [{ type: 'api/reset' }]])
  })
})
describe('module sidebar', () => {
  it('lists assigned modules with role and sign out, without the previous workspace controls', async () => {
    renderPage(<Layout />, '/applications', '*')
    expect(screen.getByRole('img', { name: 'UCL' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'UCL' })).toHaveAttribute('href', '/modules')
    expect(screen.queryByText('Application Review Workspace')).not.toBeInTheDocument()
    expect(screen.getByText('Programme', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Demo environment')).not.toBeInTheDocument()
    expect(screen.queryByText('Modules', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open course CSML 26/27' })).toHaveAttribute(
      'href',
      '/batches?programme=programme-1&intake=2026+%2F+27',
    )
    expect(
      screen.getByRole('link', {
        name: 'Open course ML 26/27',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Admissions tutor')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getByText('Admissions tutor')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add course' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admission criteria' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /\d{2}\/\d{2} intake/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'session/signOut' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'api/reset' })
  })
  it('opens the intake selection page when a sidebar module is clicked and closes navigation', async () => {
    renderPage(<Layout />, '/applications', '*')
    await userEvent.click(
      screen.getByRole('link', {
        name: 'Open course ML 26/27',
      }),
    )
    expect(screen.getByLabelText('Current URL')).toHaveTextContent(
      '/batches?programme=programme-2&intake=2026+%2F+27',
    )
    expect(dispatch).toHaveBeenCalledWith({ type: 'ui/setNavigationOpen', payload: false })
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    )
  })
  it('selects the module and intake of an authorised application deep link', () => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({ application: { programmeId: programme.id, intakeYear: '2025 / 26' } }),
    )
    renderPage(<Layout />, '/applications/APP-TEST', '*')
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ui/selectProgramme',
      payload: { userId: tutor.id, programmeId: programme.id, intakeYear: '2025 / 26' },
    })
  })
  it('selects the module and intake from an authorised upload-batch deep link', () => {
    apiMocks.useApplicationQuery.mockReturnValue(queryResult())
    apiMocks.useBatchQuery.mockReturnValue(
      queryResult({ programmeId: otherProgramme.id, intakeYear: '2025 / 26' }),
    )
    renderPage(<Layout />, '/batches/batch-1', '*')
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ui/selectProgramme',
      payload: { userId: tutor.id, programmeId: otherProgramme.id, intakeYear: '2025 / 26' },
    })
  })
  it('does not select another module while viewing module cards or unauthorised application data', () => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({ application: { programmeId: 'unassigned' } }),
    )
    renderPage(<Layout />, '/modules', '*')
    expect(dispatch).not.toHaveBeenCalled()
  })
  it('keeps administration navigation and the dual-role switch separate', async () => {
    workspaceMock.mockReturnValue({
      user: { ...tutor, roles: ['tutor', 'admin'] },
      programmes: [programme, otherProgramme],
      programme,
    })
    renderPage(<Layout />, '/admin/health', '*')
    expect(screen.getByRole('link', { name: 'Users & access' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getByRole('menuitem', { name: 'Switch to tutor workspace' })).toHaveAttribute(
      'href',
      '/modules',
    )
    expect(screen.queryByRole('link', { name: 'Open course CSML 26/27' })).not.toBeInTheDocument()
  })
})
