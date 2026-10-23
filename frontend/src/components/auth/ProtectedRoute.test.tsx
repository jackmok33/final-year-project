// @vitest-environment jsdom
import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../app/theme'
import '../../test/domSetup'
import { administrator, tutor } from '../../test/fixtures'
import { apiMocks, dispatch, queryResult, resetPageMocks, state } from '../../test/pageMocks'
import { ProtectedRoute } from './ProtectedRoute'

vi.mock('../../app/api', async () => (await import('../../test/pageMocks')).apiMocks)
vi.mock('../../app/store', async () => (await import('../../test/pageMocks')).storeMocks)
vi.mock('../../hooks/redux', async () => (await import('../../test/pageMocks')).reduxMocks)
beforeEach(resetPageMocks)
function show(admin = false) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route element={<ProtectedRoute admin={admin} />}>
            <Route path="/private" element={<p>Protected content</p>} />
          </Route>
          <Route path="/login" element={<p>Sign in destination</p>} />
          <Route path="/modules" element={<p>Tutor destination</p>} />
          <Route path="/admin/health" element={<p>Admin destination</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('ProtectedRoute', () => {
  it('redirects signed-out visitors before exposing protected content', () => {
    state.session.userId = null
    show()
    expect(screen.getByText('Sign in destination')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })
  it.each([
    [true, tutor, 'Tutor destination'],
    [false, administrator, 'Admin destination'],
  ] as const)('denies the wrong role when admin=%s', (admin, user, destination) => {
    apiMocks.useMeQuery.mockReturnValue(queryResult(user))
    show(admin)
    expect(screen.getByText(destination)).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })
  it('renders a permitted route after loading', () => {
    show()
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })
  it('shows a loading state while checking the account', () => {
    apiMocks.useMeQuery.mockReturnValue({ isLoading: true })
    show()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })
  it('allows clearing a failed session and its cached data', async () => {
    apiMocks.useMeQuery.mockReturnValue({ error: { data: 'Session unavailable' } })
    show()
    expect(screen.getByRole('alert')).toHaveTextContent('Session unavailable')
    await userEvent.click(screen.getByRole('button'))
    expect(dispatch.mock.calls).toEqual([[{ type: 'session/signOut' }], [{ type: 'api/reset' }]])
  })
})
