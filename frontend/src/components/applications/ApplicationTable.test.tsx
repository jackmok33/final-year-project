// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ApplicationListItem } from '../../services/contracts'
import { applicantProfile } from '../../services/applicantPresentation'
import '../../test/domSetup'
import {
  applicationListItem as application,
  completeApplicationListItem,
  run,
} from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { ApplicationTable } from './ApplicationTable'

function show(applications: ApplicationListItem[], onDelete = vi.fn()) {
  renderPage(
    <ApplicationTable
      scope={{ programmeId: application.programmeId, intakeYear: '2026 / 27' }}
      rows={applications.map((application, index) => ({
        application,
        index,
        profile: applicantProfile(application),
      }))}
      sort={{ column: 'submittedAt', direction: 'desc' }}
      onSort={vi.fn()}
      onDelete={onDelete}
    />,
    '/programmes/programme-1/intakes/2026-27/applications',
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
      `/programmes/programme-1/intakes/2026-27/applications/${application.id}`,
    )
    expect(cells()[5]).toHaveTextContent(String(run.overall))
    expect(cells()[3]).toHaveTextContent('Missing')
    expect(cells()[6]).toHaveTextContent('Unconditional')
    expect(cells()[7]).toHaveTextContent('Pending')
  })
  it('uses each applicant’s actual batch for both its name link and View action', () => {
    const batched = { ...application, id: 'APP/1', batchId: 'batch/one' }
    show([batched])
    const destination =
      '/programmes/programme-1/intakes/2026-27/batches/batch%2Fone/applications/APP%2F1'
    expect(screen.getByRole('link', { name: `View ${batched.candidate}` })).toHaveAttribute(
      'href',
      destination,
    )
    fireEvent.click(screen.getByRole('button', { name: `View ${batched.candidate}` }))
    expect(screen.getByLabelText('Current URL')).toHaveTextContent(destination)
  })
  it.each(['queued', 'running', 'failed'] as const)(
    'does not expose scores for %s runs',
    (status) => {
      show([{ ...completeApplicationListItem, runs: [{ ...run, status }] }])
      expect(cells()[3]).toHaveTextContent('Ready')
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
    expect(cells()[3]).toHaveTextContent('Missing')
  })
  it('shows Ready for all document categories even before assessment or a tutor decision', () => {
    show([{ ...completeApplicationListItem, runs: [], decisions: [] }])
    expect(cells()[3]).toHaveTextContent('Ready')
    expect(cells()[5]).toHaveTextContent('—')
    expect(cells()[7]).toHaveTextContent('Pending')
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
