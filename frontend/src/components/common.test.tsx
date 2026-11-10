// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import '../test/domSetup'
import { Confirm, ErrorNotice, Page, Status } from './common'
import { FilePicker } from './FilePicker'

describe('shared accessible controls', () => {
  it.each([undefined, []])(
    'retains the plain page heading without a populated trail (%s)',
    (breadcrumbs) => {
      render(
        <Page title="Programme" breadcrumbs={breadcrumbs}>
          Course cards
        </Page>,
      )
      expect(screen.getByRole('heading', { level: 1, name: 'Programme' })).toBeVisible()
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
      expect(screen.getByText('Course cards')).toBeVisible()
    },
  )
  it('uses the linked trail as the heading while preserving subtitle, actions and page content', () => {
    render(
      <MemoryRouter>
        <Page
          title="Duplicate title"
          breadcrumbs={[
            { title: 'Programme', to: '/modules' },
            { title: 'Batch 1', to: '/batches/batch-1' },
          ]}
          subtitle="Eight applications"
          actions={<button>Export course results</button>}
        >
          Applicant table
        </Page>
      </MemoryRouter>,
    )
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 1, name: 'Batch 1' })).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.queryByText('Duplicate title')).not.toBeInTheDocument()
    expect(screen.getByText('Eight applications')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Export course results' })).toBeVisible()
    expect(screen.getByText('Applicant table')).toBeVisible()
  })
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
