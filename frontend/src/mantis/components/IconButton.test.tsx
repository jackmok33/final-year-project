// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import IconButton from './IconButton'
describe('IconButton', () => {
  it('preserves icon-button labels, disabled behaviour and filters template-only props', async () => {
    const onClick = vi.fn()
    const view = render(
      <IconButton aria-label="Open navigation" variant="light" shape="rounded" onClick={onClick}>
        ☰
      </IconButton>,
    )
    const button = screen.getByRole('button', { name: 'Open navigation' })
    expect(button).not.toHaveAttribute('variant')
    expect(button).not.toHaveAttribute('shape')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
    view.rerender(
      <IconButton aria-label="Open navigation" disabled onClick={onClick}>
        ☰
      </IconButton>,
    )
    expect(button).toBeDisabled()
    button.click()
    expect(onClick).toHaveBeenCalledOnce()
  })
})
