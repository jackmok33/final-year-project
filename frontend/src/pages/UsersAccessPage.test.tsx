// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { administrator, tutor } from '../test/fixtures'
import { apiMocks, command, mutation, queryResult, resetPageMocks, unwrap } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { UsersAccessPage } from './UsersAccessPage'

vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))

describe('user management', () => {
  beforeEach(resetPageMocks)
  const show = () => renderPage(<UsersAccessPage />, '/admin/users', '*')

  it('shows accounts without programme dependencies or a permanently open editor', () => {
    show()
    expect(screen.getByRole('heading', { name: 'Users', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'User accounts' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Owned courses')).not.toBeInTheDocument()
    expect(apiMocks.useProgrammesQuery).not.toHaveBeenCalled()
  })

  it('creates an account, preserves compatibility fields and leaves success feedback outside the dialog', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'New account' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Create account' }))
    await userEvent.type(dialog.getByLabelText(/Name/), 'New tutor')
    await userEvent.type(dialog.getByLabelText(/Email/), 'NEW@example.test')
    expect(dialog.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(dialog.queryByLabelText('Allow rubric publication')).not.toBeInTheDocument()
    await userEvent.click(dialog.getByRole('button', { name: 'Create account' }))
    expect(command).toHaveBeenCalledWith({
      op: 'user',
      user: {
        id: '',
        name: 'New tutor',
        email: 'new@example.test',
        roles: ['tutor'],
        programmeIds: [],
        canPublishCriteria: false,
        active: true,
      },
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Account saved.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'New account' }))
    expect(screen.getByLabelText(/Name/)).toHaveValue('')
    expect(screen.getByLabelText(/Email/)).toHaveValue('')
    expect(screen.queryByText('Account saved.')).not.toBeInTheDocument()
  })

  it('discards cancelled drafts and loads the next account independently', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: `Edit ${tutor.name}` }))
    await userEvent.clear(screen.getByLabelText(/Name/))
    await userEvent.type(screen.getByLabelText(/Name/), 'Unsaved edit')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(screen.getByRole('button', { name: `Edit ${administrator.name}` }))
    expect(screen.getByRole('dialog', { name: 'Edit account' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Name/)).toHaveValue(administrator.name)
    await userEvent.click(screen.getByRole('button', { name: 'Save account' }))
    expect(command).toHaveBeenCalledWith({ op: 'user', user: administrator })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Account saved.')).toBeVisible()
  })

  it('changes roles/status while preserving ownership fields and a failed draft', async () => {
    unwrap.mockRejectedValue(new Error('Email already assigned'))
    mutation.error = { data: 'Email already assigned' }
    show()
    await userEvent.click(screen.getByRole('button', { name: `Edit ${tutor.name}` }))
    await userEvent.click(screen.getByRole('combobox', { name: 'Role' }))
    await userEvent.click(screen.getByRole('option', { name: 'Tutor + administrator' }))
    await userEvent.click(screen.getByLabelText('Account active'))
    await userEvent.click(screen.getByRole('button', { name: 'Save account' }))
    expect(command).toHaveBeenCalledWith({
      op: 'user',
      user: { ...tutor, roles: ['tutor', 'admin'], active: false },
    })
    expect(screen.getByRole('dialog', { name: 'Edit account' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Name/)).toHaveValue(tutor.name)
    expect(screen.getByRole('alert')).toHaveTextContent('Email already assigned')
  })

  it('surfaces the last-administrator protection without closing the draft', async () => {
    unwrap.mockRejectedValue(new Error('Keep at least one active administrator.'))
    mutation.error = { data: 'Keep at least one active administrator.' }
    show()
    await userEvent.click(screen.getByRole('button', { name: `Edit ${administrator.name}` }))
    await userEvent.click(screen.getByLabelText('Account active'))
    await userEvent.click(screen.getByRole('button', { name: 'Save account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Keep at least one active administrator.')
    expect(screen.getByRole('dialog', { name: 'Edit account' })).toBeInTheDocument()
  })

  it('blocks edits, duplicate saves and dismissal while saving', async () => {
    mutation.isLoading = true
    show()
    await userEvent.click(screen.getByRole('button', { name: `Edit ${tutor.name}` }))
    for (const label of [/Name/, /Email/, 'Account active']) {
      expect(screen.getByLabelText(label)).toBeDisabled()
    }
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Save account' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close account form' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Edit account' })).toBeInTheDocument()
    expect(command).not.toHaveBeenCalled()
  })

  it('does not close a replacement draft when an earlier save finishes', async () => {
    let finish!: (value: { id?: string }) => void
    unwrap.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    show()
    await userEvent.click(screen.getByRole('button', { name: `Edit ${tutor.name}` }))
    await userEvent.click(screen.getByRole('button', { name: 'Save account' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(screen.getByRole('button', { name: 'New account' }))
    await userEvent.type(screen.getByLabelText(/Name/), 'Replacement draft')
    await act(async () => {
      finish({})
    })
    expect(screen.getByRole('dialog', { name: 'Create account' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Name/)).toHaveValue('Replacement draft')
    expect(screen.queryByText('Account saved.')).not.toBeInTheDocument()
  })

  it('shows loading and query errors without requesting programme metadata', () => {
    apiMocks.useUsersQuery.mockReturnValue({ isLoading: true })
    const view = show()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    apiMocks.useUsersQuery.mockReturnValue({
      ...queryResult(),
      error: { data: 'Accounts unavailable' },
    })
    view.rerender(<UsersAccessPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Accounts unavailable')
    expect(screen.getByRole('button', { name: 'New account' })).toBeDisabled()
    expect(apiMocks.useProgrammesQuery).not.toHaveBeenCalled()
  })
})
