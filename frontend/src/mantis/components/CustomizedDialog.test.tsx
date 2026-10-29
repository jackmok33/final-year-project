// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import CustomizedDialog from './CustomizedDialog'

describe('CustomizedDialog', () => {
  it('uses caller copy and labels the dialog with its title alone', () => {
    renderPage(
      <CustomizedDialog open title="Review applicant" closeLabel="Close review" onClose={vi.fn()}>
        <input aria-label="Review note" />
      </CustomizedDialog>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Review applicant' })
    const label = document.getElementById(dialog.getAttribute('aria-labelledby')!)!
    expect(label).toHaveTextContent(/^Review applicant$/)
    expect(label).not.toContainElement(within(dialog).getByRole('button', { name: 'Close review' }))
    expect(within(dialog).getByRole('textbox', { name: 'Review note' })).toBeInTheDocument()
  })

  it('does not mount its contents while closed', () => {
    renderPage(
      <CustomizedDialog open={false} title="Review" closeLabel="Close review" onClose={vi.fn()}>
        Private form
      </CustomizedDialog>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Private form')).not.toBeInTheDocument()
  })

  it('forwards close-button, keyboard and backdrop dismissal to its owner', async () => {
    const onClose = vi.fn()
    renderPage(
      <CustomizedDialog open title="Review" closeLabel="Close review" onClose={onClose}>
        Review form
      </CustomizedDialog>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Close review' }))
    await userEvent.keyboard('{Escape}')
    const backdropTarget = screen.getByRole('dialog').parentElement!
    fireEvent.mouseDown(backdropTarget)
    fireEvent.click(backdropTarget)
    expect(onClose).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('blocks every dismissal path while saving and marks its contents busy', async () => {
    const onClose = vi.fn()
    renderPage(
      <CustomizedDialog open title="Review" closeLabel="Close review" onClose={onClose} busy>
        Saving review
      </CustomizedDialog>,
    )
    const dialog = screen.getByRole('dialog')
    const close = within(dialog).getByRole('button', { name: 'Close review' })
    expect(close).toBeDisabled()
    expect(dialog.querySelector('[aria-busy="true"]')).toHaveTextContent('Saving review')
    await userEvent.click(close)
    await userEvent.keyboard('{Escape}')
    fireEvent.mouseDown(dialog.parentElement!)
    fireEvent.click(dialog.parentElement!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('restores keyboard focus to the trigger after its owner closes it', async () => {
    function Example() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Open review</button>
          <CustomizedDialog
            open={open}
            title="Review"
            closeLabel="Close review"
            onClose={() => setOpen(false)}
          >
            <input aria-label="Review note" />
          </CustomizedDialog>
        </>
      )
    }
    renderPage(<Example />)
    const trigger = screen.getByRole('button', { name: 'Open review' })
    await userEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Review' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('gives separate dialogs distinct title associations', () => {
    renderPage(
      <>
        <CustomizedDialog open title="First review" closeLabel="Close first" onClose={vi.fn()}>
          First form
        </CustomizedDialog>
        <CustomizedDialog open title="Second review" closeLabel="Close second" onClose={vi.fn()}>
          Second form
        </CustomizedDialog>
      </>,
    )
    const dialogs = screen.getAllByRole('dialog', { hidden: true })
    const titleIds = dialogs.map((dialog) => dialog.getAttribute('aria-labelledby'))
    expect(new Set(titleIds).size).toBe(2)
    expect(titleIds.map((id) => document.getElementById(id!)?.textContent)).toEqual([
      'First review',
      'Second review',
    ])
  })
})
