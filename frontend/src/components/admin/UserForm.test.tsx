// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { programme, tutor } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { UserForm } from './UserForm'

describe('UserForm', () => {
  it('forwards identity, role, active-status changes and submission', async () => {
    const setForm = vi.fn(),
      setRole = vi.fn(),
      save = vi.fn().mockResolvedValue(undefined)
    renderPage(
      <UserForm
        form={tutor}
        programmes={[programme]}
        setForm={setForm}
        mutation={{ isLoading: false }}
        message=""
        role="tutor"
        setRole={setRole}
        save={save}
      />,
    )
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'New name' } })
    expect(setForm).toHaveBeenCalledWith({ ...tutor, name: 'New name' })
    await userEvent.click(screen.getByRole('combobox', { name: 'Role' }))
    await userEvent.click(screen.getByRole('option', { name: 'Tutor + administrator' }))
    expect(setRole).toHaveBeenCalledWith('both')
    await userEvent.click(screen.getByLabelText('Account active'))
    expect(setForm).toHaveBeenCalledWith({ ...tutor, active: false })
    await userEvent.click(screen.getByRole('button', { name: 'Save account' }))
    expect(save).toHaveBeenCalledOnce()
  })
})
