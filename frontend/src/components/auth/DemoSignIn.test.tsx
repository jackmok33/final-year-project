// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { DemoSignIn } from './DemoSignIn'

function props() {
  return {
    email: 'tutor@example.test',
    password: 'secret',
    showPassword: false,
    onEmailChange: vi.fn(),
    onPasswordChange: vi.fn(),
    onTogglePassword: vi.fn(),
    onHelp: vi.fn(),
    login: vi.fn(),
    error: undefined,
    isLoading: false,
    disabled: false,
  }
}

describe('DemoSignIn', () => {
  it('forwards field edits, password visibility, help and submission', async () => {
    const callbacks = props()
    renderPage(<DemoSignIn {...callbacks} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'x')
    expect(callbacks.onEmailChange).toHaveBeenCalledWith('tutor@example.testx')
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'password')
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'x')
    expect(callbacks.onPasswordChange).toHaveBeenCalledWith('secretx')
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(callbacks.onTogglePassword).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: "I don't have an account" }))
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(callbacks.onHelp.mock.calls).toEqual([['accounts'], ['password']])
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(callbacks.login).toHaveBeenCalledOnce()
  })

  it('shows loading instead of editable fields and respects disabled submission', () => {
    const callbacks = props()
    const view = renderPage(<DemoSignIn {...callbacks} isLoading />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    view.rerender(<DemoSignIn {...callbacks} disabled showPassword />)
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled()
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'text')
  })
})
