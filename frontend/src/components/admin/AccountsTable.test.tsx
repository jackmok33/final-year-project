// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { administrator, programme, tutor } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { AccountsTable } from './AccountsTable'

describe('AccountsTable', () => {
  it('shows owned courses rather than legacy assignments and selects the account to edit', async () => {
    const setEditing = vi.fn()
    renderPage(
      <AccountsTable
        users={[tutor, administrator]}
        programmes={[programme]}
        setEditing={setEditing}
      />,
    )
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText(programme.name)).toBeInTheDocument()
    expect(within(rows[1]).queryByText(programme.name)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: `Edit ${tutor.name}` }))
    expect(setEditing).toHaveBeenCalledWith(tutor.id)
  })
})
