// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { administrator, application, otherProgramme, programme, tutor } from '../test/fixtures'
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
        <Route path="/programmes" element={<p>Tutor destination</p>} />
        <Route path="/admin/users" element={<p>Admin destination</p>} />
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
    expect(screen.getByRole('link', { name: 'UCL' })).toHaveAttribute('href', '/programmes')
    expect(screen.queryByText('Admission Review System')).not.toBeInTheDocument()
    expect(screen.getByText('Programme', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Demo environment')).not.toBeInTheDocument()
    expect(screen.queryByText('Modules', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open course CSML 26/27' })).toHaveAttribute(
      'href',
      '/programmes/programme-1/intakes/2026-27',
    )
    expect(
      screen.getByRole('link', {
        name: 'Open course ML 26/27',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Admissions tutor')).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }))
    expect(screen.getByText('Admissions tutor')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add course' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admission criteria' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /\d{2}\/\d{2} intake/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'All programmes' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Logout' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'session/signOut' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'api/reset' })
  })
  it('opens the canonical intake workspace when a sidebar programme is clicked and closes navigation', async () => {
    renderPage(<Layout />, '/applications', '*')
    await userEvent.click(
      screen.getByRole('link', {
        name: 'Open course ML 26/27',
      }),
    )
    expect(screen.getByLabelText('Current URL')).toHaveTextContent(
      '/programmes/programme-2/intakes/2026-27',
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
  it('selects the authorised programme, intake and sidebar item from a canonical applicant deep link', () => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({ application: { ...application, intakeYear: '2025 / 26', batchId: 'batch-1' } }),
    )
    apiMocks.useBatchQuery.mockReturnValue(
      queryResult({ id: 'batch-1', programmeId: programme.id, intakeYear: '2025 / 26' }),
    )
    renderPage(
      <Layout />,
      '/programmes/programme-1/intakes/2025-26/batches/batch-1/applications/APP-TEST/evidence?run=old&doc=source&page=2',
      '*',
    )
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ui/selectProgramme',
      payload: { userId: tutor.id, programmeId: programme.id, intakeYear: '2025 / 26' },
    })
    expect(screen.getByRole('link', { name: 'Open course CSML 25/26' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(apiMocks.useApplicationQuery).toHaveBeenCalledWith('APP-TEST', { skip: false })
  })
  it.each(['', '/applications/new'])(
    'selects an authorised canonical batch context for %s without reading a new applicant',
    (suffix) => {
      apiMocks.useApplicationQuery.mockReturnValue(queryResult())
      apiMocks.useBatchQuery.mockReturnValue(
        queryResult({ id: 'batch-1', programmeId: otherProgramme.id, intakeYear: '2025 / 26' }),
      )
      renderPage(
        <Layout />,
        `/programmes/programme-2/intakes/2025-26/batches/batch-1${suffix}`,
        '*',
      )
      expect(dispatch).toHaveBeenCalledWith({
        type: 'ui/selectProgramme',
        payload: { userId: tutor.id, programmeId: otherProgramme.id, intakeYear: '2025 / 26' },
      })
      expect(apiMocks.useApplicationQuery).toHaveBeenCalledWith(suffix ? 'new' : '', { skip: true })
    },
  )
  it.each([
    '/programmes/programme-2/intakes/2025-26/batches/batch-1/applications/APP-TEST',
    '/programmes/programme-1/intakes/2024-25/batches/batch-1/applications/APP-TEST',
    '/programmes/programme-1/intakes/2025-26/batches/other-batch/applications/APP-TEST',
    '/programmes/programme-1/intakes/2025-26/applications/APP-TEST',
    '/programmes/forbidden/intakes/2025-26/batches/batch-1/applications/APP-TEST',
    '/programmes/programme-1/intakes/~invalid!/batches/batch-1/applications/APP-TEST?intake=2025+%2F+26',
  ])('does not change remembered selection for forged canonical ancestry: %s', (url) => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({ application: { ...application, intakeYear: '2025 / 26', batchId: 'batch-1' } }),
    )
    apiMocks.useBatchQuery.mockReturnValue(
      queryResult({ id: 'batch-1', programmeId: programme.id, intakeYear: '2025 / 26' }),
    )
    renderPage(<Layout />, url, '*')
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ui/selectProgramme' }),
    )
    expect(
      screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page'),
    ).toHaveLength(0)
  })
  it('does not select another module while viewing module cards or unauthorised application data', () => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({ application: { programmeId: 'unassigned' } }),
    )
    renderPage(<Layout />, '/programmes', '*')
    expect(dispatch).not.toHaveBeenCalled()
  })
  it('keeps administration navigation and the dual-role switch separate', async () => {
    workspaceMock.mockReturnValue({
      user: { ...tutor, roles: ['tutor', 'admin'] },
      programmes: [programme, otherProgramme],
      programme,
    })
    renderPage(<Layout />, '/admin/users', '*')
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Service health' })).toHaveAttribute(
      'href',
      '/admin/health',
    )
    expect(screen.getByRole('link', { name: 'UCL' })).toHaveAttribute('href', '/admin/users')
    for (const name of ['Backup & restore', 'Programme settings', 'Data operations'])
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }))
    expect(screen.getByRole('menuitem', { name: 'Switch to tutor workspace' })).toHaveAttribute(
      'href',
      '/programmes',
    )
    expect(screen.queryByRole('link', { name: 'Open course CSML 26/27' })).not.toBeInTheDocument()
  })
  it('opens the password form without navigation and clears cancelled values', async () => {
    renderPage(<Layout />, '/applications', '*')
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Change password' }))
    expect(screen.getByRole('dialog', { name: 'Change password' })).toBeInTheDocument()
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/applications')
    await userEvent.type(screen.getByLabelText(/Current password/), 'old-password')
    await userEvent.type(screen.getByLabelText(/^New password/), 'new-password')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Change password' }))
    expect(screen.getByLabelText(/Current password/)).toHaveValue('')
    expect(screen.getByLabelText(/^New password/)).toHaveValue('')
  })
  it('validates matching, changed passwords without pretending to save or sending a command', async () => {
    renderPage(<Layout />, '/applications', '*')
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Change password' }))
    await userEvent.type(screen.getByLabelText(/Current password/), 'old-password')
    await userEvent.type(screen.getByLabelText(/^New password/), 'new-password')
    await userEvent.type(screen.getByLabelText(/Confirm new password/), 'different-password')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByText('New passwords must match.')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText(/^New password/))
    await userEvent.clear(screen.getByLabelText(/Confirm new password/))
    await userEvent.type(screen.getByLabelText(/^New password/), 'old-password')
    await userEvent.type(screen.getByLabelText(/Confirm new password/), 'old-password')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByText('Choose a different new password.')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText(/^New password/))
    await userEvent.clear(screen.getByLabelText(/Confirm new password/))
    await userEvent.type(screen.getByLabelText(/^New password/), 'new-password')
    await userEvent.type(screen.getByLabelText(/Confirm new password/), 'new-password')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(
      screen.getByText(
        'Password changes will be available when account authentication is connected.',
      ),
    ).toBeInTheDocument()
    expect(apiMocks.useCommandMutation).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'session/signOut' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close change password' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Change password' }))
    expect(screen.getByLabelText(/Current password/)).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
