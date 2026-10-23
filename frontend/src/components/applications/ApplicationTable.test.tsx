// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Application } from '../../domain/types'
import { applicantProfile } from '../../services/applicantPresentation'
import '../../test/domSetup'
import { application, run } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { ApplicationTable } from './ApplicationTable'

function show(applications: Application[], onDelete = vi.fn()) {
  renderPage(
    <ApplicationTable
      rows={applications.map((application, index) => ({
        application,
        index,
        profile: applicantProfile(application),
      }))}
      sort={{ column: 'submittedAt', direction: 'desc' }}
      onSort={vi.fn()}
      onDelete={onDelete}
    />,
    '/applications',
    '*',
  )
  return onDelete
}
function cells(row = 1) {
  return within(screen.getAllByRole('row')[row]).getAllByRole('cell')
}

describe('Mantis applicant table', () => {
  it('shows the new applicant columns and navigates through the applicant name', () => {
    show([application])
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Id',
      'Name',
      'Student ID',
      'State',
      'University',
      'Score',
      'AI',
      'Decision',
      'Actions',
    ])
    expect(screen.getByRole('link', { name: `View ${application.candidate}` })).toHaveAttribute(
      'href',
      `/applications/${application.id}`,
    )
    expect(cells()[5]).toHaveTextContent(String(run.overall))
    expect(cells()[6]).toHaveTextContent('Unconditional')
    expect(cells()[7]).toHaveTextContent('Pending')
  })
  it.each(['queued', 'running', 'failed'] as const)(
    'does not expose scores for %s runs',
    (status) => {
      show([{ ...application, runs: [{ ...run, status }] }])
      expect(cells()[5]).toHaveTextContent('—')
      expect(cells()[6]).toHaveTextContent('—')
      expect(within(cells()[6]).queryByText('Unconditional')).not.toBeInTheDocument()
    },
  )
  it('keeps the recommendation separate from the current tutor decision', () => {
    show([
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
    ])
    expect(cells()[5]).toHaveTextContent('—')
    expect(cells()[6]).toHaveTextContent('Conditional')
    expect(cells()[7]).toHaveTextContent('Reject')
  })
  it('treats old-run decisions as pending and new uploads as unassessed', () => {
    show([
      { ...application, id: 'APP-NEW', runs: [], decisions: [] },
      {
        ...application,
        decisions: [
          {
            id: 'old',
            runId: 'old-run',
            recommendation: 'Reject',
            outcome: 'Reject',
            reason: '',
            actor: 'tutor-a',
            at: run.finishAt,
          },
        ],
      },
    ])
    expect(cells(1)[6]).toHaveTextContent('—')
    expect(cells(2)[7]).toHaveTextContent('Pending')
    expect(within(cells(2)[7]).queryByText('Reject')).not.toBeInTheDocument()
  })
  it('requests deletion without deleting on row selection', () => {
    const onDelete = show([application])
    expect(onDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: `Delete ${application.candidate}` }))
    expect(onDelete).toHaveBeenCalledWith(application)
  })
})
