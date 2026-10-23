// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { application, documents, run } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { CorrectionForm } from './CorrectionForm'

describe('CorrectionForm', () => {
  it('keeps the original fact read-only while forwarding correction fields and submission', async () => {
    const setValue = vi.fn(),
      setPage = vi.fn(),
      setReason = vi.fn(),
      submit = vi.fn().mockResolvedValue(undefined)
    renderPage(
      <CorrectionForm
        id={application.id}
        run={run}
        transcript={documents[0]}
        value="74"
        setValue={setValue}
        page="2"
        setPage={setPage}
        reason="Source checked"
        setReason={setReason}
        mutation={{ isLoading: false }}
        submit={submit}
        disabled={false}
      />,
    )
    expect(screen.getByLabelText(/Original extraction/)).toHaveAttribute('readonly')
    fireEvent.change(screen.getByLabelText(/Corrected value/), { target: { value: '79' } })
    fireEvent.change(screen.getByLabelText(/Source page/), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText(/Reason for correction/), {
      target: { value: 'Verified page 3' },
    })
    expect(setValue).toHaveBeenCalledWith('79')
    expect(setPage).toHaveBeenCalledWith('3')
    expect(setReason).toHaveBeenCalledWith('Verified page 3')
    await userEvent.click(screen.getByRole('button', { name: 'Save & re-evaluate' }))
    expect(submit).toHaveBeenCalledOnce()
  })
})
