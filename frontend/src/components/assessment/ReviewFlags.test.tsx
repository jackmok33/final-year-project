// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import '../../test/domSetup'
import { run } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { ReviewFlags } from './ReviewFlags'

describe('ReviewFlags', () => {
  it('offers a correction only for supported grade flags with permission', async () => {
    const flagged = {
      ...run,
      flags: [{ code: 'GRADE_MISMATCH', message: 'Check transcript', critical: true }],
    }
    const onCorrect = vi.fn()
    const view = renderPage(<ReviewFlags run={flagged} onCorrect={onCorrect} canCorrect />)
    expect(screen.getByRole('alert')).toHaveTextContent('Check transcript')
    await userEvent.click(screen.getByRole('button', { name: 'Update detail' }))
    expect(onCorrect).toHaveBeenCalledOnce()
    view.rerender(<ReviewFlags run={flagged} onCorrect={onCorrect} canCorrect={false} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('omits backend placeholders and raw codes', () => {
    renderPage(
      <ReviewFlags
        run={{
          ...run,
          flags: [{ code: 'BACKEND_UNAVAILABLE', message: 'Backend unavailable', critical: true }],
        }}
        onCorrect={vi.fn()}
        canCorrect
      />,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('BACKEND_UNAVAILABLE')).not.toBeInTheDocument()
  })
})
