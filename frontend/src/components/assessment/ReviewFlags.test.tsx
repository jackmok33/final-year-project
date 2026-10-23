// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { run } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { ReviewFlags } from './ReviewFlags'

describe('ReviewFlags', () => {
  it('offers a correction only for supported grade flags with permission', () => {
    const flagged = {
      ...run,
      flags: [{ code: 'GRADE_MISMATCH', message: 'Check transcript', critical: true }],
    }
    const view = renderPage(<ReviewFlags run={flagged} id="APP/1" canCorrect />)
    expect(screen.getByRole('alert')).toHaveTextContent('Check transcript')
    expect(screen.getByRole('link', { name: 'Update detail' })).toHaveAttribute(
      'href',
      '/applications/APP%2F1/correct',
    )
    view.rerender(<ReviewFlags run={flagged} id="APP/1" canCorrect={false} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
  it('omits backend placeholders and raw codes', () => {
    renderPage(
      <ReviewFlags
        run={{
          ...run,
          flags: [{ code: 'BACKEND_UNAVAILABLE', message: 'Backend unavailable', critical: true }],
        }}
        id="APP"
        canCorrect
      />,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('BACKEND_UNAVAILABLE')).not.toBeInTheDocument()
  })
})
