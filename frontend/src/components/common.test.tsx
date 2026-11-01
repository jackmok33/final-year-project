// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { Confirm, ErrorNotice, Status } from './common'
import { FilePicker } from './FilePicker'

describe('shared accessible controls', () => {
  it('uses a labelled dialog and only calls the explicitly confirmed action', async () => {
    const onClose = vi.fn(),
      onConfirm = vi.fn()
    render(
      <Confirm open title="Delete application?" onClose={onClose} onConfirm={onConfirm} destructive>
        Review impact
      </Confirm>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete application?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
  it('blocks dismissal and duplicate confirmation while saving', async () => {
    const onClose = vi.fn(),
      onConfirm = vi.fn()
    render(
      <Confirm open title="Save?" onClose={onClose} onConfirm={onConfirm} busy>
        Saving a decision
      </Confirm>,
    )
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })
  it('shows explicit error text and renders nothing without an error', () => {
    const view = render(<ErrorNotice error="PDF could not be read" />)
    expect(screen.getByRole('alert')).toHaveTextContent('PDF could not be read')
    view.rerender(<ErrorNotice error={{ status: 422, data: { detail: 'Invalid source page.' } }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid source page.')
    view.rerender(<ErrorNotice error={undefined} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it.each([
    ['Unconditional', 'Success'],
    ['Conditional', 'Info'],
    ['Pending', 'Default'],
    ['Offer', 'Success'],
    ['completed', 'Success'],
    ['Active', 'Success'],
    ['Valid', 'Success'],
    ['Reject', 'Error'],
    ['failed', 'Error'],
    ['Unavailable', 'Error'],
    ['Invalid', 'Error'],
    ['Further review', 'Warning'],
    ['queued', 'Warning'],
    ['Inactive', 'Default'],
    ['constructor', 'Default'],
    ['__proto__', 'Default'],
  ])('keeps labelled %s indicators in the appropriate colour', (label, color) => {
    render(<Status label={label} />)
    expect(screen.getByText(label).closest('.MuiChip-root')).toHaveClass(`MuiChip-color${color}`)
  })
  it('selects the same original file twice and supports cancellation', async () => {
    const onSelect = vi.fn()
    render(
      <FilePicker
        label="Choose PDF"
        inputLabel="Upload source PDF"
        accept=".pdf"
        onSelect={onSelect}
      />,
    )
    const file = new File(['%PDF'], 'source.pdf', { type: 'application/pdf' })
    const input = screen.getByLabelText('Upload source PDF')
    await userEvent.upload(input, file)
    await userEvent.upload(input, file)
    expect(onSelect.mock.calls).toEqual([[file], [file]])
    expect(input).toHaveValue('')
  })
})
