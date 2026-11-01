// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { administrator, tutor } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { AccountsTable } from './AccountsTable'

describe('AccountsTable', () => {
  it('shows only identity, readable roles, status and editing actions', async () => {
    const onEdit = vi.fn()
    renderPage(
      <AccountsTable
        users={[
          tutor,
          administrator,
          { ...tutor, id: 'both', name: 'Both roles', roles: ['tutor', 'admin'], active: false },
        ]}
        onEdit={onEdit}
      />,
    )
    expect(screen.getAllByRole('columnheader').map((column) => column.textContent)).toEqual([
      'User',
      'Role',
      'Status',
      'Actions',
    ])
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('Admissions tutor')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Administrator')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Tutor + administrator')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Inactive')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: `Edit ${tutor.name}` }))
    expect(onEdit).toHaveBeenCalledWith(tutor)
  })
  it('shows an empty state in the table', () => {
    renderPage(<AccountsTable users={[]} onEdit={vi.fn()} />)
    expect(screen.getByRole('cell', { name: 'No accounts found.' })).toHaveAttribute('colspan', '4')
  })
})
