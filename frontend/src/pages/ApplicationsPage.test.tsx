// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Application, BatchSummary, Decision } from '../domain/types'
import * as presentation from '../services/applicantPresentation'
import '../test/domSetup'
import { application, otherProgramme, programme, run, tutor } from '../test/fixtures'
import { apiMocks, queryResult, resetPageMocks, workspaceMock } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { ApplicationsPage } from './ApplicationsPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
describe('applicant queue', () => {
  beforeEach(resetPageMocks)
  it('scopes rows and summary counts to the selected intake', () => {
    workspaceMock.mockReturnValue({
      user: tutor,
      programme,
      programmes: [programme],
      intakeYear: '2025 / 26',
    })
    apiMocks.useApplicationsQuery.mockReturnValue(
      queryResult([
        application,
        { ...application, id: 'APP-OLDER', candidate: 'OLDER', intakeYear: '2025 / 26' },
      ]),
    )
    renderPage(<ApplicationsPage />, '/applications', '*')
    expect(screen.getByRole('link', { name: 'View OLDER' })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: `View ${application.candidate}` }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Export/ })).not.toBeInTheDocument()
  })
  it('filters search and workflow and sorts scores without altering records', async () => {
    apiMocks.useApplicationsQuery.mockReturnValue(
      queryResult([
        application,
        {
          ...application,
          id: 'OTHER',
          candidate: 'Other applicant',
          runs: [{ ...run, status: 'failed' }],
        },
      ]),
    )
    renderPage(<ApplicationsPage />, '/applications', '*')
    await userEvent.type(screen.getByRole('textbox', { name: 'Search applicant' }), 'Other')
    expect(
      screen.queryByRole('link', { name: `View ${application.candidate}` }),
    ).not.toBeInTheDocument()
    await userEvent.clear(screen.getByRole('textbox', { name: 'Search applicant' }))
    await userEvent.click(screen.getByRole('combobox', { name: 'All status' }))
    await userEvent.click(screen.getByRole('option', { name: 'failed' }))
    expect(screen.getByRole('link', { name: 'View Other applicant' })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: `View ${application.candidate}` }),
    ).not.toBeInTheDocument()
  })
})
describe('applicant rows within a ZIP batch', () => {
  const batch: BatchSummary = {
    sequence: 2,
    applicantCount: 2,
    pendingReviewCount: 1,
    id: 'batch/one?',
    programmeId: programme.id,
    intakeYear: '2025 / 26',
    filename: 'November applications.zip',
    uploadedAt: '2025-11-12T10:30:00Z',
    uploadedBy: tutor.id,
    source: 'zip',
  }
  beforeEach(resetPageMocks)
  it('uses the batch module/intake rather than a different selected workspace and scopes rows and summaries', () => {
    workspaceMock.mockReturnValue({
      user: tutor,
      programme: otherProgramme,
      programmes: [programme, otherProgramme],
      intakeYear: otherProgramme.year,
    })
    apiMocks.useBatchQuery.mockReturnValue(queryResult(batch))
    apiMocks.useApplicationsQuery.mockReturnValue(
      queryResult([
        { ...application, batchId: batch.id, intakeYear: batch.intakeYear },
        { ...application, id: 'OTHER-BATCH', batchId: 'other', intakeYear: batch.intakeYear },
        {
          ...application,
          id: 'WRONG-MODULE',
          batchId: batch.id,
          programmeId: otherProgramme.id,
          intakeYear: batch.intakeYear,
        },
      ]),
    )
    renderPage(<ApplicationsPage />, '/batches/batch-one', '/batches/:batchId')
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/batches')
    expect(screen.queryByRole('link', { name: 'Admission criteria' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: `View ${application.candidate}` })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open OTHER-BATCH' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open WRONG-MODULE' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Batch 2' })).toBeInTheDocument()
    expect(screen.queryByText(batch.filename)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Document assessment is not connected|Demo storage/),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New application' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Export/ })).not.toBeInTheDocument()
  })
  it('does not fall back to the full queue for unavailable or forbidden batch links', () => {
    apiMocks.useBatchQuery.mockReturnValue({ error: { data: 'Tutor access denied' } })
    renderPage(<ApplicationsPage />, '/batches/forbidden', '/batches/:batchId')
    expect(screen.getByText('Tutor access denied')).toBeInTheDocument()
    expect(apiMocks.useApplicationsQuery).toHaveBeenCalledWith('', {
      skip: true,
      pollingInterval: 1000,
    })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
  it('shows batch loading and a concise heading for earlier applications', () => {
    apiMocks.useBatchQuery.mockReturnValue({ isLoading: true })
    const view = renderPage(<ApplicationsPage />, '/batches/existing', '/batches/:batchId')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    apiMocks.useBatchQuery.mockReturnValue(
      queryResult({ ...batch, intakeYear: programme.year, source: 'existing', sequence: 1 }),
    )
    view.rerender(<ApplicationsPage />)
    expect(screen.getByRole('heading', { name: 'Batch 1' })).toBeInTheDocument()
    expect(screen.queryByText('Existing applications')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'CSML 26/27', level: 1 })).toBeInTheDocument()
    expect(screen.queryByText(/Review your assigned applications/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Document assessment is not connected/)).not.toBeInTheDocument()
  })
})
describe('applicant column sorting', () => {
  function decision(outcome: Decision['outcome'], runId = run.id): Decision {
    return {
      id: outcome,
      runId,
      recommendation: 'Offer',
      outcome,
      reason: '',
      actor: tutor.id,
      at: run.finishAt,
    }
  }
  const applicants: Application[] = [
    {
      ...application,
      id: 'one',
      candidate: 'Zoe',
      submittedAt: '2026-10-01T09:00:00Z',
      runs: [{ ...run, overall: 0, recommendation: 'Reject' }],
      decisions: [decision('Conditional')],
    },
    {
      ...application,
      id: 'two',
      candidate: 'Alice',
      submittedAt: '2026-10-02T09:00:00Z',
      runs: [{ ...run, overall: 80 }],
    },
    {
      ...application,
      id: 'three',
      candidate: 'Bob',
      submittedAt: '2026-10-03T09:00:00Z',
      runs: [{ ...run, overall: 40, recommendation: 'Further review' }],
      decisions: [decision('Reject')],
    },
    {
      ...application,
      id: 'four',
      candidate: 'Dan',
      submittedAt: '2026-10-04T09:00:00Z',
      runs: [{ ...run, overall: 99, status: 'failed' }],
      decisions: [decision('Unconditional', 'old-run')],
    },
  ]
  function names() {
    return within(screen.getByRole('table', { name: 'Applicants' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1].textContent)
  }
  beforeEach(() => {
    vi.spyOn(presentation, 'applicantProfile').mockImplementation((app) => {
      const profiles: Record<string, { studentId: string; university: string }> = {
        Zoe: { studentId: '100', university: 'Zeta University' },
        Alice: { studentId: '20', university: 'Alpha University' },
        Bob: { studentId: '3', university: 'Beta University' },
        Dan: { studentId: '8', university: '' },
      }
      return { name: app.candidate, ...(profiles[app.candidate] ?? profiles.Dan) }
    })
    resetPageMocks()
    apiMocks.useApplicationsQuery.mockReturnValue(queryResult(structuredClone(applicants)))
  })
  it.each([
    ['Id', ['Zoe', 'Alice', 'Bob', 'Dan'], ['Dan', 'Bob', 'Alice', 'Zoe']],
    ['Name', ['Alice', 'Bob', 'Dan', 'Zoe'], ['Zoe', 'Dan', 'Bob', 'Alice']],
    ['Student ID', ['Bob', 'Dan', 'Alice', 'Zoe'], ['Zoe', 'Alice', 'Dan', 'Bob']],
    ['State', ['Alice', 'Zoe', 'Bob', 'Dan'], ['Dan', 'Zoe', 'Bob', 'Alice']],
    ['University', ['Alice', 'Bob', 'Zoe', 'Dan'], ['Zoe', 'Bob', 'Alice', 'Dan']],
    ['Score', ['Zoe', 'Bob', 'Alice', 'Dan'], ['Alice', 'Bob', 'Zoe', 'Dan']],
    ['AI', ['Bob', 'Zoe', 'Alice', 'Dan'], ['Alice', 'Zoe', 'Bob', 'Dan']],
    ['Decision', ['Zoe', 'Alice', 'Dan', 'Bob'], ['Bob', 'Alice', 'Dan', 'Zoe']],
  ])(
    'toggles %s in both directions and preserves the underlying records',
    async (header, ascending, descending) => {
      const original = structuredClone(applicants)
      renderPage(<ApplicationsPage />, '/applications', '*')
      const column = screen.getByRole('columnheader', { name: header })
      const toggle = within(column).getByRole('button', { name: header })
      await userEvent.click(toggle)
      expect(column).toHaveAttribute('aria-sort', 'ascending')
      expect(names()).toEqual(ascending)
      await userEvent.click(toggle)
      expect(column).toHaveAttribute('aria-sort', 'descending')
      expect(names()).toEqual(descending)
      expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent(
        header === 'Score' ? 'Highest score' : `${header} (descending)`,
      )
      expect(apiMocks.useApplicationsQuery.mock.results[0].value.currentData).toEqual(original)
    },
  )
  it('keeps quick sort options and headers in sync and resets direction for another column', async () => {
    renderPage(<ApplicationsPage />, '/applications', '*')
    await userEvent.click(screen.getByRole('combobox', { name: 'Sort by' }))
    await userEvent.click(screen.getByRole('option', { name: 'Highest score' }))
    expect(screen.getByRole('columnheader', { name: 'Score' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    expect(names()).toEqual(['Alice', 'Bob', 'Zoe', 'Dan'])
    await userEvent.click(screen.getByRole('button', { name: 'Score' }))
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent('Lowest score')
    const name = screen.getByRole('button', { name: 'Name' })
    name.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
    expect(screen.getByRole('columnheader', { name: 'Score' })).not.toHaveAttribute('aria-sort')
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent('Name')
    await userEvent.click(screen.getByRole('combobox', { name: 'Sort by' }))
    await userEvent.click(screen.getByRole('option', { name: 'Newest first' }))
    expect(names()).toEqual(['Dan', 'Bob', 'Alice', 'Zoe'])
  })
  it('sorts the whole filtered result before pagination and returns to page one', async () => {
    apiMocks.useApplicationsQuery.mockReturnValue(
      queryResult(
        Array.from({ length: 12 }, (_, index) => ({
          ...application,
          id: `app-${index + 1}`,
          candidate: `Applicant ${index + 1}`,
        })),
      ),
    )
    renderPage(<ApplicationsPage />, '/applications', '*')
    await userEvent.click(screen.getByRole('button', { name: 'Go to page 2' }))
    expect(screen.getByRole('spinbutton', { name: 'Go to' })).toHaveValue(2)
    await userEvent.click(screen.getByRole('button', { name: 'Id' }))
    expect(screen.getByRole('spinbutton', { name: 'Go to' })).toHaveValue(1)
    await userEvent.click(screen.getByRole('button', { name: 'Id' }))
    expect(names()).toEqual([
      'Applicant 12',
      'Applicant 11',
      'Applicant 10',
      'Applicant 9',
      'Applicant 8',
    ])
    await userEvent.type(screen.getByRole('textbox', { name: 'Search applicant' }), 'Applicant 1')
    expect(names()).toEqual(['Applicant 12', 'Applicant 11', 'Applicant 10', 'Applicant 1'])
    expect(
      within(screen.getByRole('columnheader', { name: 'Actions' })).queryByRole('button'),
    ).not.toBeInTheDocument()
  })
})
