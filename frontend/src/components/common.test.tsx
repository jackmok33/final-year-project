// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { documents, run } from '../test/fixtures'
import { Confirm, ErrorNotice, Status } from './common'
import { EvidenceLink } from './evidence/EvidenceLink'
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
describe('recommendation evidence links', () => {
  const show = (sourceRun = run, sourceDocuments = documents) =>
    render(
      <MemoryRouter>
        <EvidenceLink
          applicationId="APP-TEST"
          citation={sourceRun.justification.citations[0]}
          document={sourceDocuments.find(
            (document) => document.id === sourceRun.justification.citations[0].documentId,
          )}
          runId={sourceRun.id}
        />
      </MemoryRouter>,
    )
  it('links an exact source page and run', () => {
    show()
    expect(screen.getByRole('link', { name: 'transcript.pdf · p.2' })).toHaveAttribute(
      'href',
      `/applications/APP-TEST/evidence?document=${documents[0].id}&page=2&run=${run.id}`,
    )
  })
  it('disables citations whose document is missing', () => {
    show(run, [])
    expect(screen.getByText('Unsupported source reference').closest('a')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
  it.each([0, -1, 1.5, NaN, Infinity, 5])(
    'disables invalid page %s rather than treating it as evidence',
    (page) => {
      show({
        ...run,
        justification: {
          ...run.justification,
          citations: [{ ...run.justification.citations[0], page }],
        },
      })
      expect(screen.getByText(/transcript.pdf · p\./).closest('a')).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    },
  )
})
