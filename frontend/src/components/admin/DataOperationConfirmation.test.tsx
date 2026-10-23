// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { DataOperationConfirmation, type DataOperation } from './DataOperationConfirmation'

describe('DataOperationConfirmation', () => {
  it.each(['delete', 'restore', 'reset'] satisfies DataOperation[])(
    'describes and confirms the pending %s operation',
    async (action) => {
      const confirm = vi.fn().mockResolvedValue(undefined)
      renderPage(
        <DataOperationConfirmation
          action={action}
          cancel={vi.fn()}
          confirm={confirm}
          busy={false}
          id=" APP-1 "
          pending={{ id: 'backup', applications: 2, documents: 3 }}
        />,
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      if (action === 'delete') expect(screen.getByRole('dialog')).toHaveTextContent('APP-1')
      if (action === 'restore')
        expect(screen.getByRole('dialog')).toHaveTextContent('2 applications')
      await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
      expect(confirm).toHaveBeenCalledOnce()
    },
  )
  it('keeps the confirmation closed until an operation is requested', () => {
    renderPage(
      <DataOperationConfirmation
        action={null}
        cancel={vi.fn()}
        confirm={vi.fn()}
        busy={false}
        id=""
        pending={null}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
