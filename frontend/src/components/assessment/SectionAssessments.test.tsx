// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { documents, run } from '../../test/fixtures'
import { SectionAssessments } from './SectionAssessments'
describe('section evidence references', () => {
  it('disables invalid or missing source references just as the recommendation does', async () => {
    const sections = [
      {
        ...run.sections[0],
        citations: [
          { documentId: documents[0].id, page: 0, claim: 'Invalid' },
          { documentId: 'missing', page: 1, claim: 'Missing' },
        ],
      },
    ]
    render(
      <MemoryRouter>
        <SectionAssessments run={{ ...run, sections }} documents={documents} id="APP-TEST" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /Academic performance/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByText('transcript.pdf · p.0').closest('a')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByText('Unsupported source reference').closest('a')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
  it('encodes document/run identities so source links cannot change the query parameters', async () => {
    const document = { ...documents[0], id: 'source&extra=wrong' }
    const sourceRun = {
      ...run,
      id: 'run&extra=wrong',
      sections: [
        {
          ...run.sections[0],
          score: null,
          citations: [{ documentId: document.id, page: 2, claim: 'Synthetic citation' }],
        },
      ],
    }
    render(
      <MemoryRouter>
        <SectionAssessments run={sourceRun} documents={[document]} id="APP-TEST" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /Academic performance/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('link', { name: 'transcript.pdf · p.2' })).toHaveAttribute(
      'href',
      `/applications/APP-TEST/evidence?document=${encodeURIComponent(document.id)}&page=2&run=${encodeURIComponent(sourceRun.id)}`,
    )
    expect(screen.getByText('Score unavailable')).toBeInTheDocument()
  })
})
