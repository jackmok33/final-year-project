// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { DecisionForm } from './DecisionForm'

describe('DecisionForm', () => {
  it('submits directly with optional notes and forwards edits', async () => {
    const record = vi.fn(),
      setReason = vi.fn()
    renderPage(
      <DecisionForm
        outcome="Conditional"
        setOutcome={vi.fn()}
        reason=""
        setReason={setReason}
        critical={false}
        disabled={false}
        record={record}
      />,
    )
    const note = screen.getByLabelText('Review note (optional)')
    expect(note).not.toBeRequired()
    await userEvent.type(note, 'A')
    expect(setReason).toHaveBeenCalledWith('A')
    await userEvent.click(screen.getByRole('button', { name: 'Record decision' }))
    expect(record).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('rejects form submission when disabled and displays the service error', () => {
    const record = vi.fn()
    renderPage(
      <DecisionForm
        outcome="Reject"
        setOutcome={vi.fn()}
        reason=""
        setReason={vi.fn()}
        critical
        disabled
        record={record}
        error="Save failed"
      />,
    )
    const button = screen.getByRole('button', { name: 'Record decision' })
    fireEvent.submit(button.closest('form')!)
    expect(button).toBeDisabled()
    expect(record).not.toHaveBeenCalled()
    expect(screen.getByText('Save failed')).toBeInTheDocument()
  })
  it('allows cancelling even when critical evidence blocks the decision', async () => {
    const record = vi.fn()
    const onCancel = vi.fn()
    renderPage(
      <DecisionForm
        outcome="Conditional"
        setOutcome={vi.fn()}
        reason=""
        setReason={vi.fn()}
        critical
        disabled
        record={record}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByRole('button', { name: 'Record decision' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(record).not.toHaveBeenCalled()
  })
  it('disables edits, dismissal and repeated submission while saving', async () => {
    const record = vi.fn()
    const onCancel = vi.fn()
    const setOutcome = vi.fn()
    const setReason = vi.fn()
    renderPage(
      <DecisionForm
        outcome="Conditional"
        setOutcome={setOutcome}
        reason="Save this note"
        setReason={setReason}
        critical={false}
        disabled={false}
        record={record}
        onCancel={onCancel}
        saving
      />,
    )
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
    expect(screen.getByLabelText('Review note (optional)')).toBeDisabled()
    const submit = screen.getByRole('button', { name: 'Record decision' })
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(submit).toBeDisabled()
    expect(cancel).toBeDisabled()
    fireEvent.submit(submit.closest('form')!)
    await userEvent.click(cancel)
    expect(record).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    expect(setOutcome).not.toHaveBeenCalled()
    expect(setReason).not.toHaveBeenCalled()
  })
})
