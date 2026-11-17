// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { administrator, tutor } from '../test/fixtures'
import { apiMocks, dispatch, resetPageMocks } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { authenticateBackend } from '../services/httpAdmissions'
import { saveBackendSession } from '../services/backendSession'
import { LoginPage } from './LoginPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../services/httpAdmissions', () => ({ authenticateBackend: vi.fn() }))
vi.mock('../services/backendSession', () => ({ saveBackendSession: vi.fn() }))
beforeEach(() => {
  resetPageMocks()
  vi.mocked(authenticateBackend).mockReset()
  vi.mocked(saveBackendSession).mockReset()
})
async function submit() {
  await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), tutor.email)
  await userEvent.type(screen.getByLabelText('Access token', { exact: true }), 'a'.repeat(40))
  await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))
}
describe('server account sign-in', () => {
  it.each([
    [tutor, '/programmes'],
    [administrator, '/admin/users'],
  ] as const)('opens the correct workspace for %j', async (account, destination) => {
    vi.mocked(authenticateBackend).mockResolvedValue(account)
    renderPage(<LoginPage />, '/login', '/login')
    await submit()
    await waitFor(() => expect(screen.getByLabelText('Current URL')).toHaveTextContent(destination))
    expect(saveBackendSession).toHaveBeenCalledWith(account.id, 'a'.repeat(40))
    expect(dispatch.mock.calls).toEqual([
      [{ type: 'api/reset' }],
      [{ type: 'session/signIn', payload: account.id }],
    ])
    expect(apiMocks.useAccountsQuery).not.toHaveBeenCalled()
  })
  it('shows server access failures and allows retry', async () => {
    vi.mocked(authenticateBackend).mockRejectedValue(new Error('Access denied'))
    renderPage(<LoginPage />)
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Access denied')
    expect(saveBackendSession).not.toHaveBeenCalled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'x')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('waits for authentication and ignores a late result after navigation', async () => {
    let resolve!: (value: typeof tutor) => void
    vi.mocked(authenticateBackend).mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const view = renderPage(<LoginPage />)
    await submit()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    view.unmount()
    resolve(tutor)
    await Promise.resolve()
    expect(saveBackendSession).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })
  it.each([
    ['Need access?', 'Account access'],
    ['Access token help', 'Access your account'],
    ['About Us', 'About Us'],
    ['Terms and Conditions', 'Terms and Conditions'],
  ])('opens %s help and restores focus', async (triggerName, title) => {
    renderPage(<LoginPage />)
    const trigger = screen.getByRole('button', { name: triggerName })
    await userEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close help' }))
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
