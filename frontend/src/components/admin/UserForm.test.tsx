// @vitest-environment jsdom
import type { ComponentProps } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { tutor } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { UserForm } from './UserForm'

type Props = ComponentProps<typeof UserForm>
const props = (overrides: Partial<Props> = {}): Props => ({
  form: tutor,
  setForm: vi.fn(),
  saving: false,
  role: 'tutor',
  setRole: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  cancel: vi.fn(),
  ...overrides,
})

describe('UserForm', () => {
  it('forwards identity, role and status changes while preserving hidden compatibility fields', async () => {
    const values = props()
    renderPage(<UserForm {...values} />)
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'New name' } })
    expect(values.setForm).toHaveBeenCalledWith({ ...tutor, name: 'New name' })
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'new@example.test' } })
    expect(values.setForm).toHaveBeenCalledWith({ ...tutor, email: 'new@example.test' })
    await userEvent.click(screen.getByRole('combobox', { name: 'Role' }))
    await userEvent.click(screen.getByRole('option', { name: 'Tutor + administrator' }))
    expect(values.setRole).toHaveBeenCalledWith('both')
    await userEvent.click(screen.getByLabelText('Account active'))
    expect(values.setForm).toHaveBeenCalledWith({ ...tutor, active: false })
    await userEvent.click(screen.getByRole('button', { name: 'Save account' }))
    expect(values.save).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(values.cancel).toHaveBeenCalledOnce()
    expect(values.save).toHaveBeenCalledOnce()
    expect(screen.queryByText('Owned courses')).not.toBeInTheDocument()
  })

  it('blocks edits, cancellation and repeated submission while saving', async () => {
    const values = props({ saving: true })
    renderPage(<UserForm {...values} />)
    for (const label of [/Name/, /Email/, 'Account active'])
      expect(screen.getByLabelText(label)).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveAttribute('aria-disabled', 'true')
    const submit = screen.getByRole('button', { name: 'Save account' })
    expect(submit).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    fireEvent.submit(submit.closest('form')!)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(values.save).not.toHaveBeenCalled()
    expect(values.cancel).not.toHaveBeenCalled()
  })

  it('requires identity and displays a failed save without replacing supplied values', () => {
    const values = props({
      form: { ...tutor, id: '', name: '', email: '' },
      error: 'Email already assigned',
    })
    const view = renderPage(<UserForm {...values} />)
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Email already assigned')
    view.rerender(<UserForm {...values} form={tutor} />)
    expect(screen.getByLabelText(/Name/)).toHaveValue(tutor.name)
    expect(screen.getByLabelText(/Email/)).toHaveValue(tutor.email)
  })
})
