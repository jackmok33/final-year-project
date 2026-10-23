// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import FormActions from './FormActions'

describe('FormActions', () => {
  it('preserves keyboard order and action handlers supplied by its form', async () => {
    const save = vi.fn()
    renderPage(
      <FormActions>
        <button onClick={save}>Save</button>
        <button>Cancel</button>
      </FormActions>,
    )
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(save).toHaveBeenCalledOnce()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })
})
