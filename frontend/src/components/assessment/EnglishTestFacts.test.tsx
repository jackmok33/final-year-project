// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { EnglishTestFacts } from './EnglishTestFacts'

describe('EnglishTestFacts', () => {
  it('shows available bands and labels the demo result when a band is missing', () => {
    renderPage(
      <EnglishTestFacts
        result={{
          outcome: 'needs_review',
          reason: 'missing_bands',
          testType: 'IELTS Academic',
          testDate: null,
          overall: 7,
          listening: 7.5,
          reading: 7,
          writing: null,
          speaking: 7,
        }}
      />,
    )
    expect(screen.getByText('IELTS Academic')).toBeVisible()
    expect(screen.getByText('Listening').nextElementSibling).toHaveTextContent('7.5')
    expect(screen.getByText('Writing').nextElementSibling).toHaveTextContent('Unavailable')
    const status = screen.getByRole('status', { name: '' })
    expect(status).toHaveTextContent('Demo eligibility')
    expect(status).toHaveTextContent('Needs review')
    expect(status).toHaveTextContent('One or more bands could not be read.')
  })

  it('shows why an unsupported report needs review without inventing bands', () => {
    renderPage(
      <EnglishTestFacts
        result={{
          outcome: 'needs_review',
          reason: 'unsupported_report',
          testType: null,
          testDate: null,
          overall: null,
          listening: null,
          reading: null,
          writing: null,
          speaking: null,
        }}
      />,
    )
    const status = screen.getByRole('status', { name: '' })
    expect(status).toHaveTextContent('Needs review')
    expect(status).toHaveTextContent('report type or page count')
    expect(screen.queryByText('Overall')).not.toBeInTheDocument()
  })
})
