// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { documents } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { CorrectionGuidance } from './CorrectionGuidance'

describe('CorrectionGuidance', () => {
  it('clamps the suggested source to a one-page transcript', () => {
    renderPage(<CorrectionGuidance id="APP" transcript={{ ...documents[0], pages: 1 }} />)
    expect(
      screen.getByRole('link', { name: 'Inspect original transcript' }).getAttribute('href'),
    ).toContain('page=1')
  })
  it('disables source navigation without an original transcript', () => {
    renderPage(<CorrectionGuidance id="APP" />)
    expect(screen.getByRole('link', { name: 'Inspect original transcript' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
