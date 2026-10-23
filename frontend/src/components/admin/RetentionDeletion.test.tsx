// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { RetentionDeletion } from './RetentionDeletion'

describe('RetentionDeletion', () => {
  it('requests distinct deletion/reset confirmations and forwards the identifier', async () => {
    const setId = vi.fn(),
      setAction = vi.fn()
    renderPage(<RetentionDeletion id="APP-1" setId={setId} setAction={setAction} busy={false} />)
    fireEvent.change(screen.getByLabelText('Application identifier'), {
      target: { value: 'APP-2' },
    })
    expect(setId).toHaveBeenCalledWith('APP-2')
    await userEvent.click(screen.getByRole('button', { name: 'Review deletion impact' }))
    await userEvent.click(screen.getByRole('button', { name: 'Reset demo dataset' }))
    expect(setAction.mock.calls).toEqual([['delete'], ['reset']])
  })
  it('disables deletion for a blank identifier and both actions while busy', () => {
    const view = renderPage(
      <RetentionDeletion id=" " setId={vi.fn()} setAction={vi.fn()} busy={false} />,
    )
    expect(screen.getByRole('button', { name: 'Review deletion impact' })).toBeDisabled()
    view.rerender(<RetentionDeletion id="APP-1" setId={vi.fn()} setAction={vi.fn()} busy />)
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
  })
})
