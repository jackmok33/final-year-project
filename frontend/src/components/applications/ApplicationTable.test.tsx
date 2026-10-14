// @vitest-environment jsdom
import '../../test/domSetup'
import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { application, run } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { ApplicationTable } from './ApplicationTable'

describe('simplified application queue', () => {
  it('shows four columns and opens assessments through the application reference', () => {
    renderPage(<ApplicationTable filtered={[application]} />, '/applications', '*')
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Application',
      'Score',
      'AI recommendation',
      'Decision',
    ])
    expect(screen.getAllByRole('row')[1].children).toHaveLength(4)
    expect(screen.getByRole('link', { name: `Open ${application.id}` })).toHaveAttribute(
      'href',
      `/applications/${application.id}`,
    )
    expect(screen.getByText(application.candidate)).toBeInTheDocument()
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell')
    expect(cells[1]).toHaveTextContent(String(run.overall))
    expect(cells[2]).toHaveTextContent('Offer')
    expect(cells[3]).toHaveTextContent('Not recorded')
  })
  it.each(['queued', 'running', 'failed'] as const)(
    'does not present %s runs as completed scores or recommendations',
    (status) => {
      renderPage(
        <ApplicationTable filtered={[{ ...application, runs: [{ ...run, status }] }]} />,
        '/applications',
        '*',
      )
      const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell')
      expect(cells[1]).toHaveTextContent('—')
      expect(cells[2]).toHaveTextContent(status)
      expect(within(cells[2]).queryByText('Offer')).not.toBeInTheDocument()
    },
  )
  it('retains unavailable scores and distinguishes AI outcomes from tutor decisions', () => {
    renderPage(
      <ApplicationTable
        filtered={[
          {
            ...application,
            runs: [{ ...run, overall: null, recommendation: 'Further review' }],
            decisions: [
              {
                id: 'decision-1',
                runId: run.id,
                recommendation: 'Further review',
                outcome: 'Reject',
                reason: 'Reviewed evidence',
                actor: 'tutor-a',
                at: run.finishAt,
              },
            ],
          },
        ]}
      />,
      '/applications',
      '*',
    )
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell')
    expect(cells[1]).toHaveTextContent('—')
    expect(cells[2]).toHaveTextContent('Further review')
    expect(cells[3]).toHaveTextContent('Reject')
    expect(screen.queryByText('Previous assessment')).not.toBeInTheDocument()
  })
  it('labels decisions from previous runs and handles unevaluated applications', () => {
    renderPage(
      <ApplicationTable
        filtered={[
          { ...application, runs: [], id: 'APP-NEW', decisions: [] },
          {
            ...application,
            decisions: [
              {
                id: 'decision-1',
                runId: 'old-run',
                recommendation: 'Reject',
                outcome: 'Reject',
                reason: '',
                actor: 'tutor-a',
                at: run.finishAt,
              },
            ],
          },
        ]}
      />,
      '/applications',
      '*',
    )
    expect(screen.getByText('Not evaluated')).toBeInTheDocument()
    expect(screen.getByText('Previous assessment')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})
