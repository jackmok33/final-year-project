// @vitest-environment jsdom
import '../../test/domSetup'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EvidenceClaim } from './EvidenceClaim'
import { documents, run } from '../../test/fixtures'
describe('source verification and correction access', () => {
  it('exposes a grade contradiction and links to the correction workflow', () => {
    render(
      <MemoryRouter>
        <EvidenceClaim
          citation={run.justification.citations[0]}
          run={{
            ...run,
            extractedGrade: 71,
            flags: [{ code: 'GRADE_MISMATCH', message: 'Verify grade', critical: true }],
          }}
          doc={documents[0]}
          page={2}
          id="APP-TEST"
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Needs verification')).toBeInTheDocument()
    expect(screen.getByLabelText('Extracted final grade')).toHaveValue('71%')
    expect(screen.getByText(/synthetic transcript shows 74%/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Correct extracted fact' })).toHaveAttribute(
      'href',
      '/applications/APP-TEST/correct',
    )
  })
  it.each(['queued', 'running', 'failed'] as const)(
    'blocks correction during a %s assessment',
    (status) => {
      render(
        <MemoryRouter>
          <EvidenceClaim run={{ ...run, status }} doc={documents[0]} page={1} id="APP-TEST" />
        </MemoryRouter>,
      )
      expect(screen.getByRole('link', { name: 'Correct extracted fact' })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
      expect(screen.getByText(/No assessment claim cites this page/)).toBeInTheDocument()
    },
  )
  it('does not imply a grade was extracted when the backend is unavailable', () => {
    render(
      <MemoryRouter>
        <EvidenceClaim
          run={{ ...run, extractedGrade: null }}
          doc={documents[0]}
          page={1}
          id="APP-TEST"
        />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('Extracted final grade')).toHaveValue('Not extracted')
    expect(screen.getByRole('link', { name: 'Correct extracted fact' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
