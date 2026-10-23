// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { programme } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { ProgrammeForm } from './ProgrammeForm'

describe('ProgrammeForm', () => {
  it('forwards metadata edits, save and discard without changing ownership', async () => {
    const setForm = vi.fn(),
      save = vi.fn().mockResolvedValue(undefined),
      cancel = vi.fn()
    renderPage(
      <ProgrammeForm
        form={programme}
        setForm={setForm}
        mutation={{ isLoading: false }}
        save={save}
        cancel={cancel}
      />,
    )
    fireEvent.change(screen.getByLabelText(/Course code/), { target: { value: 'NEW001' } })
    expect(setForm).toHaveBeenCalledWith({ ...programme, code: 'NEW001' })
    await userEvent.click(screen.getByRole('button', { name: 'Save programme' }))
    expect(save).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel changes' }))
    expect(cancel).toHaveBeenCalledOnce()
  })
})
