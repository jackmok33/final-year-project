// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { programme } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { ModuleCards } from './ModuleCards'

describe('ModuleCards', () => {
  it('links each configured intake directly to the selected programme', () => {
    renderPage(
      <ModuleCards
        modules={[programme]}
        intakes={[{ programmeId: programme.id, years: ['2025 / 26'] }]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Open CSML 25/26' })).toHaveAttribute(
      'href',
      '/batches?programme=programme-1&intake=2025+%2F+26',
    )
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('supplies default intake cards only for the supplied programmes', () => {
    renderPage(<ModuleCards modules={[programme]} />)
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Open CSML 26/27' })).toBeInTheDocument()
  })
})
