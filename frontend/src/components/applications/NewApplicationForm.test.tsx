// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { programme } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { NewApplicationForm } from './NewApplicationForm'

describe('NewApplicationForm', () => {
  it('forwards candidate and file edits while keeping programme context read-only', async () => {
    const setCandidate = vi.fn(),
      select = vi.fn().mockResolvedValue(undefined),
      submit = vi.fn().mockResolvedValue(undefined)
    renderPage(
      <NewApplicationForm
        programme={programme}
        candidate="SYN"
        setCandidate={setCandidate}
        files={{}}
        remove={vi.fn()}
        validationError=""
        checking={null}
        isLoading={false}
        error={undefined}
        select={select}
        total={0}
        submit={submit}
        disabled={false}
      />,
    )
    fireEvent.change(screen.getByLabelText(/Candidate reference/), { target: { value: 'NEW' } })
    expect(setCandidate).toHaveBeenCalledWith('NEW')
    expect(screen.getByLabelText('Course')).toHaveAttribute('readonly')
    const file = new File(['pdf'], 'cv.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText('Upload CV'), file)
    expect(select).toHaveBeenCalledWith('cv', file)
    await userEvent.click(screen.getByRole('button', { name: 'Create application' }))
    expect(submit).toHaveBeenCalledOnce()
  })
})
