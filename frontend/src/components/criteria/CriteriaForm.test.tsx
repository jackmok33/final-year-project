// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { rubric } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { CriteriaForm } from './CriteriaForm'

describe('CriteriaForm', () => {
  it('forwards save/discard and hides editing actions for read-only viewers', async () => {
    const submit = vi.fn().mockResolvedValue(undefined),
      reset = vi.fn()
    const props = {
      draft: rubric,
      total: 100,
      invalidWeights: false,
      canEdit: true,
      disabled: false,
      dirty: true,
      validationError: null,
      mutation: { isLoading: false },
      changeWeight: vi.fn(),
      changeThreshold: vi.fn(),
      submit,
      reset,
    }
    const view = renderPage(<CriteriaForm {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save criteria' }))
    expect(submit).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(reset).toHaveBeenCalledOnce()
    view.rerender(<CriteriaForm {...props} canEdit={false} disabled />)
    expect(screen.queryByRole('button', { name: 'Save criteria' })).not.toBeInTheDocument()
  })
})
