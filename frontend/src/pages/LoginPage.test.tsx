// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { administrator, tutor } from '../test/fixtures'
import { apiMocks, dispatch, queryResult, resetPageMocks } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { LoginPage } from './LoginPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
describe('Mantis sign-in', () => {
  beforeEach(() => {
    resetPageMocks()
  })
  it.each([
    ['tutor', tutor, '/modules'],
    ['admin', administrator, '/admin/health'],
  ] as const)('signs in a %s and clears cached data', async (_role, account, destination) => {
    apiMocks.useAccountsQuery.mockReturnValue(queryResult([account]))
    renderPage(<LoginPage />, '/login', '/login')
    expect(screen.getByRole('img', { name: 'UCL' })).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), account.email)
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'demo')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(dispatch.mock.calls).toEqual([
      [{ type: 'api/reset' }],
      [{ type: 'session/signIn', payload: account.id }],
    ])
    expect(screen.getByLabelText('Current URL')).toHaveTextContent(destination)
  })
  it('lists only active prototype accounts and fills the chosen email', async () => {
    apiMocks.useAccountsQuery.mockReturnValue(
      queryResult([
        tutor,
        administrator,
        { ...tutor, id: 'former', name: 'Former tutor', active: false },
      ]),
    )
    renderPage(<LoginPage />, '/login', '/login')
    await userEvent.click(screen.getByRole('button', { name: "I don't have an account" }))
    expect(screen.queryByText('Former tutor')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: new RegExp(administrator.name) }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue(administrator.email)
  })
  it('rejects unknown emails and disables sign-in without active accounts', async () => {
    const view = renderPage(<LoginPage />, '/login', '/login')
    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'unknown@example.test')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'demo')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No active account matches this email.')
    expect(dispatch).not.toHaveBeenCalled()
    apiMocks.useAccountsQuery.mockReturnValue(queryResult([{ ...tutor, active: false }]))
    view.rerender(<LoginPage />)
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled()
  })
  it('shows loading and query errors', () => {
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
