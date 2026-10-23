// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import AnalyticEcommerce from './AnalyticEcommerce'

describe('AnalyticEcommerce', () => {
  it('renders zero as a valid metric with its accessible heading and supporting text', () => {
    renderPage(<AnalyticEcommerce title="Total applications" count={0} extra="This intake" />)
    expect(
      screen.getByRole('heading', { name: 'Total applications', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('This intake')).toBeInTheDocument()
  })
})
