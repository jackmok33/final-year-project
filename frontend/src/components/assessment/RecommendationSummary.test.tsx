// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Decision } from '../../domain/types'
import '../../test/domSetup'
import { run } from '../../test/fixtures'
import { RecommendationSummary } from './RecommendationSummary'

function value(label: string) {
  return within(screen.getByText(label, { exact: true }).parentElement!)
}

describe('applicant AI and tutor decision fields', () => {
  it('renders supplied review actions after the score, AI and decision fields', () => {
    render(<RecommendationSummary run={run} actions={<button>Open decision</button>} />)
    const summary = within(screen.getByRole('region', { name: 'Application review' }))
    expect(summary.getByRole('button', { name: 'Open decision' })).toBeInTheDocument()
    expect(
      summary.getByText('Pending').compareDocumentPosition(summary.getByRole('button')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
  it.each([
    ['Offer', undefined, 'Unconditional', 'Pending'],
    ['Further review', 'Reject', 'Conditional', 'Reject'],
    ['Reject', 'Conditional', 'Reject', 'Conditional'],
    ['Conditional', 'Unconditional', 'Conditional', 'Unconditional'],
    ['Unconditional', 'Further review', 'Unconditional', 'Pending'],
    ['Unconditional', 'Offer', 'Unconditional', 'Pending'],
  ] as const)(
    'shows AI %s and decision %s as separate current fields',
    (recommendation, outcome, ai, decision) => {
      const recorded: Decision | undefined = outcome
        ? {
            id: 'decision',
            runId: run.id,
            recommendation,
            outcome,
            reason: '',
            actor: 'tutor-a',
            at: run.finishAt,
          }
        : undefined
      render(<RecommendationSummary run={{ ...run, recommendation }} decision={recorded} />)
      expect(value('AI').getByText(ai, { exact: true })).toBeInTheDocument()
      expect(value('Decision').getByText(decision, { exact: true })).toBeInTheDocument()
    },
  )

  it('shows Pending when the recorded decision belongs to another assessment', () => {
    render(
      <RecommendationSummary
        run={run}
        decision={{
          id: 'old-decision',
          runId: 'old-run',
          recommendation: 'Offer',
          outcome: 'Unconditional',
          reason: '',
          actor: 'tutor-a',
          at: run.finishAt,
        }}
      />,
    )
    expect(value('Decision').getByText('Pending')).toBeInTheDocument()
    expect(value('Decision').queryByText('Unconditional')).not.toBeInTheDocument()
  })

  it.each(['queued', 'running', 'failed'] as const)(
    'leaves AI blank for a %s assessment',
    (status) => {
      render(<RecommendationSummary run={{ ...run, status }} />)
      expect(value('AI').getByText('—')).toBeInTheDocument()
      expect(value('Decision').getByText('Pending')).toBeInTheDocument()
    },
  )
})
