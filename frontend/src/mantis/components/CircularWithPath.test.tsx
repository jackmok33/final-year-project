// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import CircularWithPath from './CircularWithPath'

describe('CircularWithPath', () => {
  it('announces only the active spinner while hiding its decorative track', () => {
    renderPage(<CircularWithPath size={24} aria-label="Loading assessment" />)
    expect(screen.getAllByRole('progressbar')).toHaveLength(1)
    expect(screen.getByRole('progressbar', { name: 'Loading assessment' })).toBeInTheDocument()
  })
})
