// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../test/domSetup'
import { renderPage } from '../test/renderPage'
import { UclLogo } from './UclLogo'

describe('UclLogo', () => {
  it('provides an accessible name and uses the bundled image', () => {
    renderPage(<UclLogo />)
    expect(screen.getByRole('img', { name: 'UCL' })).toHaveAttribute(
      'src',
      expect.stringContaining('ucl-logo.png'),
    )
  })
})
