// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { administrator, tutor } from '../test/fixtures'
import { command, resetPageMocks, unwrap } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { UsersAccessPage } from './UsersAccessPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
describe('accounts and permissions', () => {
  beforeEach(resetPageMocks)
  const show = (page: React.ReactElement) => renderPage(page, '/admin', '*')
  it('creates an account without course-sharing or criteria-editing controls', async () => {
    show(<UsersAccessPage />)
    await userEvent.type(screen.getByLabelText(/Name/), 'New tutor')
    await userEvent.type(screen.getByLabelText(/Demo email/), 'new@example.test')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Allow rubric publication')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(command).toHaveBeenCalledWith({
      op: 'user',
      user: {
        ...tutor,
        id: '',
        name: 'New tutor',
        email: 'new@example.test',
        programmeIds: [],
        canPublishCriteria: false,
      },
    })
    expect(await screen.findByText('Account and permissions saved.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Name/)).toHaveValue('')
  })
  it('loads an existing account and resets its draft when another account is selected', async () => {
    show(<UsersAccessPage />)
    await userEvent.click(screen.getByRole('button', { name: `Edit ${tutor.name}` }))
    expect(screen.getByLabelText(/Name/)).toHaveValue(tutor.name)
    await userEvent.clear(screen.getByLabelText(/Name/))
    await userEvent.type(screen.getByLabelText(/Name/), 'Unsaved edit')
    await userEvent.click(screen.getByRole('button', { name: `Edit ${administrator.name}` }))
    expect(screen.getByLabelText(/Name/)).toHaveValue(administrator.name)
    expect(screen.queryByLabelText('Allow rubric publication')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save account' }))
    expect(command).toHaveBeenCalledWith({ op: 'user', user: administrator })
    await waitFor(() => expect(screen.getByLabelText(/Name/)).toHaveValue(''))
  })
  it('changes account roles, deactivates accounts and preserves draft on save failure', async () => {
    unwrap.mockRejectedValue(new Error('Email already assigned'))
    show(<UsersAccessPage />)
    await userEvent.click(screen.getByRole('button', { name: `Edit ${tutor.name}` }))
    await userEvent.click(screen.getByRole('combobox', { name: 'Role' }))
    await userEvent.click(screen.getByRole('option', { name: 'Tutor + administrator' }))
    await userEvent.click(screen.getByLabelText('Account active'))
    await userEvent.click(screen.getByRole('button', { name: 'Save account' }))
    expect(command).toHaveBeenCalledWith({
      op: 'user',
      user: { ...tutor, roles: ['tutor', 'admin'], active: false },
    })
    expect(screen.getByLabelText(/Name/)).toHaveValue(tutor.name)
  })
})
