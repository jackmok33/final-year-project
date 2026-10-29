// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { ChangePasswordForm } from './ChangePasswordForm'

describe('ChangePasswordForm', () => {
  it('labels masked fields and forwards edits and cancel without retaining its own draft', async () => {
    const onChange = vi.fn()
    const onCancel = vi.fn()
    renderPage(
      <ChangePasswordForm
        values={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
        message=""
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    )
    const fields = [
      screen.getByLabelText(/Current password/),
      screen.getByLabelText(/^New password/),
      screen.getByLabelText(/Confirm new password/),
    ]
    for (const field of fields) expect(field).toHaveAttribute('type', 'password')
    expect(fields[0]).toHaveAttribute('autocomplete', 'current-password')
    expect(fields[1]).toHaveAttribute('autocomplete', 'new-password')
    await userEvent.type(fields[0], 'a')
    await userEvent.type(fields[1], 'b')
    await userEvent.type(fields[2], 'b')
    expect(onChange.mock.calls).toEqual([
      ['currentPassword', 'a'],
      ['newPassword', 'b'],
      ['confirmPassword', 'b'],
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
  it('requires every field, submits supplied values, and displays the caller message', async () => {
    const onSubmit = vi.fn()
    const view = renderPage(
      <ChangePasswordForm
        values={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
        message=""
        onChange={vi.fn()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(onSubmit).not.toHaveBeenCalled()
    view.rerender(
      <ChangePasswordForm
        values={{ currentPassword: 'previous', newPassword: 'next', confirmPassword: 'next' }}
        message="Account authentication is unavailable."
        onChange={vi.fn()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Account authentication is unavailable.')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })
})
