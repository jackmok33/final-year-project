// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { run } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { SectionAssessments } from './SectionAssessments'

describe('SectionAssessments', () => {
  it('shows section scores and explanations without PDF shortcuts', async () => {
    renderPage(<SectionAssessments run={run} />)
    const academic = screen.getByRole('button', { name: /Academic performance/ })
    expect(academic).toHaveAttribute('aria-expanded', 'true')
    expect(academic).toHaveTextContent('Score: 88/100')
    expect(screen.getByText(run.sections[0].explanation)).toBeVisible()
    expect(screen.getAllByText(run.sections[0].uncertainty)[0]).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    await userEvent.click(academic)
    expect(academic).toHaveAttribute('aria-expanded', 'false')
    const experience = screen.getByRole('button', { name: /CV.*experience/ })
    await userEvent.click(experience)
    expect(experience).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(run.sections[1].explanation)).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
  it('keeps scores unavailable when missing and omits invalid citation shortcuts', () => {
    renderPage(
      <SectionAssessments
        run={{
          ...run,
          sections: [
            {
              ...run.sections[0],
              score: null,
              citations: [{ documentId: 'missing', page: 0, claim: 'Unsupported source' }],
            },
          ],
        }}
      />,
    )
    expect(screen.getAllByText('Score unavailable')).toHaveLength(4)
    expect(screen.getByText(run.sections[0].explanation)).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText('Unsupported source reference')).not.toBeInTheDocument()
  })
  it('shows references without modifying historical runs, and renders an actual reference result', async () => {
    const original = structuredClone(run)
    const view = renderPage(<SectionAssessments run={run} />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
    const references = screen.getByRole('button', { name: /References/ })
    expect(references).toHaveTextContent('Score unavailable')
    await userEvent.click(references)
    expect(screen.getByText('This section was not assessed in this run.')).toBeVisible()
    expect(run).toEqual(original)
    view.rerender(
      <SectionAssessments
        run={{
          ...run,
          sections: [
            ...run.sections,
            {
              key: 'references',
              score: 75,
              explanation: 'Specific observations from both referees.',
              uncertainty: 'Some claims need clarification.',
              citations: [],
            },
          ],
        }}
      />,
    )
    expect(screen.getByRole('button', { name: /References/ })).toHaveTextContent('Score: 75/100')
    expect(screen.getByText('Specific observations from both referees.')).toBeVisible()
  })
})
