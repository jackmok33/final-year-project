// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import SimpleBarScroll from './SimpleBarScroll'

describe('SimpleBarScroll', () => {
  it('keeps navigation content accessible and forwards container props', () => {
    renderPage(
      <SimpleBarScroll aria-label="Programme list">
        <a href="/modules">All programmes</a>
      </SimpleBarScroll>,
    )
    expect(screen.getByLabelText('Programme list')).toHaveAttribute(
      'data-simplebar-direction',
      'ltr',
    )
    expect(screen.getByRole('link', { name: 'All programmes' })).toHaveAttribute('href', '/modules')
  })
})
