// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog'

describe('CreateWorkspaceDialog', () => {
  it('focuses the name and submits a valid controlled draft', async () => {
    const onNameChange = vi.fn(),
      onSubmit = vi.fn(),
      onClose = vi.fn()
    renderPage(
      <CreateWorkspaceDialog
        open
        name="Data Science"
        valid
        saving={false}
        error={undefined}
        onNameChange={onNameChange}
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    )
    expect(screen.getByRole('textbox', { name: /Programme name/ })).toHaveFocus()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'AI MSc' } })
    expect(onNameChange).toHaveBeenCalledWith('AI MSc')
    await userEvent.click(screen.getByRole('button', { name: 'Add Programme' }))
    expect(onSubmit).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('blocks submission and closing while saving', async () => {
    const onSubmit = vi.fn(),
      onClose = vi.fn()
    renderPage(
      <CreateWorkspaceDialog
        open
        name="Data Science"
        valid
        saving
        error={undefined}
        onNameChange={vi.fn()}
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    )
    fireEvent.submit(screen.getByRole('textbox').closest('form')!)
    await userEvent.keyboard('{Escape}')
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })
})
