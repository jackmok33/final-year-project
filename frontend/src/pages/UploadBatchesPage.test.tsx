// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob } from '../components/files'
import type { BatchSummary, Decision } from '../domain/types'
import { releaseArchive, stageArchive } from '../services/demo'
import '../test/domSetup'
import { application, otherProgramme, programme, run, tutor } from '../test/fixtures'
import {
  apiMocks,
  command,
  mutation,
  queryResult,
  resetPageMocks,
  unwrap,
  workspaceMock,
} from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { UploadBatchesPage } from './UploadBatchesPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
vi.mock('../services/demo', () => ({
  stageArchive: vi.fn(() => 'archive-staged'),
  releaseArchive: vi.fn(),
}))
vi.mock('../components/files', async (original) => ({
  ...(await original<object>()),
  downloadBlob: vi.fn(),
}))
describe('intake upload batches', () => {
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
  function decision(outcome: Decision['outcome'], runId = run.id): Decision {
    return {
      id: `decision-${outcome}`,
      runId,
      recommendation: 'Offer',
      outcome,
      reason: 'Reviewed source evidence.',
      actor: tutor.id,
      at: '2026-10-19T10:00:00Z',
    }
  }
  function summaryValue(label: string, value: string) {
    expect(
      within(
        screen.getByRole('heading', { name: label }).closest('.MuiPaper-root')! as HTMLElement,
      ).getByText(value, { exact: true }),
    ).toBeInTheDocument()
  }
  it('scopes the overview, ZIP upload and batch list to Batches and preserves the upload draft across tabs', async () => {
    renderPage(<UploadBatchesPage />, '/batches', '*')
    const panel = screen.getByRole('tabpanel', { name: 'Batches' })
    expect(within(panel).getByRole('region', { name: 'Intake overview' })).toBeInTheDocument()
    expect(within(panel).getByRole('heading', { name: 'Upload application' })).toBeInTheDocument()
    expect(within(panel).getByRole('table', { name: 'Batches' })).toBeInTheDocument()

    await userEvent.upload(
      within(panel).getByLabelText('Application ZIP file'),
      new File(['ZIP'], 'applications.zip', { type: 'application/zip' }),
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Admission criteria' }))
    expect(screen.getByRole('form', { name: 'Admission criteria' })).toBeInTheDocument()
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('tab=criteria')
    expect(screen.queryByRole('region', { name: 'Intake overview' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Choose application ZIP' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Batches' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Analytics' }))
    expect(screen.getByRole('heading', { name: 'Decision overview' })).toBeInTheDocument()
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('tab=analytics')
    expect(screen.queryByRole('region', { name: 'Intake overview' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Choose application ZIP' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Batches' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Batches' }))
    const restoredPanel = within(screen.getByRole('tabpanel', { name: 'Batches' }))
    expect(restoredPanel.getByRole('region', { name: 'Intake overview' })).toBeInTheDocument()
    expect(restoredPanel.getByText('applications.zip')).toBeInTheDocument()
    expect(restoredPanel.getByRole('button', { name: 'Upload batch' })).toBeEnabled()
    expect(restoredPanel.getByRole('table', { name: 'Batches' })).toBeInTheDocument()
    expect(command).not.toHaveBeenCalled()
  })
  it.each([
    ['/criteria', 'Admission criteria'],
    ['/batches?tab=criteria', 'Admission criteria'],
    ['/batches?tab=analytics', 'Analytics'],
  ])('opens %s without rendering the Batches content', (url, label) => {
    renderPage(<UploadBatchesPage />, url, '*')
    expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: label })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Intake overview' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Choose application ZIP' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Batches' })).not.toBeInTheDocument()
  })
  it('exports the whole course across intakes and batches with safe CSV values and separate tutor decisions', async () => {
    apiMocks.useApplicationsQuery.mockReturnValue(
      queryResult([
        { ...application, candidate: '=1+2', batchId: 'first' },
        {
          ...application,
          id: 'OTHER-INTAKE',
          intakeYear: '25/26',
          batchId: 'second',
          decisions: [decision('Reject')],
        },
        { ...application, id: 'OTHER-COURSE', programmeId: otherProgramme.id },
      ]),
    )
    renderPage(<UploadBatchesPage />, '/batches', '*')
    await userEvent.click(screen.getByRole('button', { name: 'Export results as CSV' }))
    const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0]
    const csv = await blob.text()
    expect(filename).toBe('course-results.csv')
    expect(csv).toContain('Tutor decision')
    expect(csv).toContain('"\'=1+2"')
    expect(csv).toContain('"Unconditional","Pending","1.0"')
    expect(csv).toContain('OTHER-INTAKE')
    expect(csv).toContain('2025 / 26')
    expect(csv).toContain('"Unconditional","Reject","1.0"')
    expect(csv).not.toContain('OTHER-COURSE')
    expect(csv.split('\r\n')).toHaveLength(3)
  })
  it('disables course export without loaded records and criteria, including failed or refreshing queries', () => {
    apiMocks.useApplicationsQuery.mockReturnValue(queryResult([]))
    const view = renderPage(<UploadBatchesPage />, '/batches', '*')
    const exportButton = () => screen.getByRole('button', { name: 'Export results as CSV' })
    expect(exportButton()).toBeDisabled()
    apiMocks.useApplicationsQuery.mockReturnValue(queryResult([application]))
    apiMocks.useRubricsQuery.mockReturnValue({ isLoading: true })
    view.rerender(<UploadBatchesPage />)
    expect(exportButton()).toBeDisabled()
    apiMocks.useRubricsQuery.mockReturnValue({ error: { data: 'Criteria lookup failed' } })
    view.rerender(<UploadBatchesPage />)
    expect(exportButton()).toBeDisabled()
    expect(screen.getByText('Criteria lookup failed')).toBeInTheDocument()
    apiMocks.useRubricsQuery.mockReturnValue(queryResult({ rubrics: [], activeId: '' }))
    apiMocks.useApplicationsQuery.mockReturnValue({
      ...queryResult([application]),
      isFetching: true,
    })
    view.rerender(<UploadBatchesPage />)
    expect(exportButton()).toBeDisabled()
    apiMocks.useApplicationsQuery.mockReturnValue({
      ...queryResult([application]),
      error: { data: 'Applications lookup failed' },
    })
    view.rerender(<UploadBatchesPage />)
    expect(exportButton()).toBeDisabled()
    expect(downloadBlob).not.toHaveBeenCalled()
  })
  it('counts current tutor decisions across all batches in the selected course and intake', () => {
    const cases = [
      {
        ...application,
        id: 'offer',
        batchId: 'one',
        decisions: [decision('Reject'), decision('Unconditional')],
      },
      {
        ...application,
        id: 'reject',
        batchId: 'two',
        decisions: [decision('Unconditional'), decision('Reject')],
      },
      { ...application, id: 'review', decisions: [decision('Further review')] },
      { ...application, id: 'ai-only' },
      {
        ...application,
        id: 'outdated',
        runs: [{ ...run, id: 'new-run' }],
        decisions: [decision('Unconditional')],
      },
      { ...application, id: 'no-assessment', runs: [], decisions: [decision('Unconditional')] },
    ]
    apiMocks.useApplicationsQuery.mockReturnValue(
      queryResult([
        ...cases,
        { ...cases[0], id: 'other-course', programmeId: otherProgramme.id },
        { ...cases[0], id: 'other-intake', intakeYear: '2025 / 26' },
      ]),
    )
    renderPage(<UploadBatchesPage />, '/batches', '*')
    expect(apiMocks.useApplicationsQuery).toHaveBeenCalledWith(programme.id, { skip: false })
    expect(screen.getByRole('region', { name: 'Intake overview' })).toBeInTheDocument()
    summaryValue('Total applications', '6')
    summaryValue('Offers given', '1')
    summaryValue('Total pending review', '4')
    expect(
      screen
        .getByRole('heading', { name: 'Offers given' })
        .compareDocumentPosition(screen.getByRole('heading', { name: 'Upload application' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
  it('shows zero for an empty intake and updates the overview when the intake changes', () => {
    apiMocks.useApplicationsQuery.mockReturnValue(
      queryResult([
        { ...application, intakeYear: '25/26', decisions: [decision('Unconditional')] },
      ]),
    )
    const view = renderPage(<UploadBatchesPage />, '/batches', '*')
    summaryValue('Total applications', '0')
    summaryValue('Offers given', '0')
    summaryValue('Total pending review', '0')
    workspaceMock.mockReturnValue({ programme, programmes: [programme], intakeYear: '2025 / 26' })
    view.rerender(<UploadBatchesPage />)
    summaryValue('Total applications', '1')
    summaryValue('Offers given', '1')
    summaryValue('Total pending review', '0')
  })
  it('keeps unclassified legacy tutor offers pending without changing their stored outcome', async () => {
    const legacy = { ...application, decisions: [decision('Offer')] }
    const original = structuredClone(legacy)
    apiMocks.useApplicationsQuery.mockReturnValue(queryResult([legacy]))
    renderPage(<UploadBatchesPage />, '/batches', '*')
    summaryValue('Offers given', '0')
    summaryValue('Total pending review', '1')
    await userEvent.click(screen.getByRole('tab', { name: 'Analytics' }))
    expect(screen.getByRole('heading', { name: 'Decision overview' })).toBeInTheDocument()
    expect(
      screen.getAllByRole('progressbar').map((item) => item.getAttribute('aria-label')),
    ).toEqual(['Unconditional', 'Conditional', 'Reject', 'Pending'])
    expect(legacy).toEqual(original)
  })
  it('keeps the upload controls available while overview data loads or fails without showing false counts', () => {
    apiMocks.useApplicationsQuery.mockReturnValue({ isLoading: true })
    const view = renderPage(<UploadBatchesPage />, '/batches', '*')
    const overview = () => within(screen.getByRole('region', { name: 'Intake overview' }))
    expect(overview().getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose application ZIP' })).toHaveAttribute(
      'aria-disabled',
      'false',
    )
    expect(screen.queryByRole('heading', { name: 'Offers given' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Total applications' })).not.toBeInTheDocument()
    apiMocks.useApplicationsQuery.mockReturnValue({ data: [application], isLoading: false })
    view.rerender(<UploadBatchesPage />)
    expect(overview().getByRole('progressbar')).toBeInTheDocument()
    apiMocks.useApplicationsQuery.mockReturnValue({
      ...queryResult([application]),
      error: { data: 'Application lookup failed' },
    })
    view.rerender(<UploadBatchesPage />)
    expect(overview().getByRole('alert')).toHaveTextContent('Application lookup failed')
    expect(screen.queryByRole('heading', { name: 'Total applications' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Offers given' })).not.toBeInTheDocument()
    apiMocks.useApplicationsQuery.mockReturnValue(queryResult([application]))
    view.rerender(<UploadBatchesPage />)
    summaryValue('Offers given', '0')
    summaryValue('Total pending review', '1')
  })
  it('queries the selected intake and shows upload date/time, applicant count and encoded batch links', () => {
    workspaceMock.mockReturnValue({
      user: tutor,
      programme,
      programmes: [programme],
      intakeYear: '2025 / 26',
    })
    apiMocks.useBatchesQuery.mockReturnValue(
      queryResult([
        { ...batch, applicantCount: 2 },
        {
          ...batch,
          id: 'old',
          source: 'existing',
          sequence: 1,
          applicantCount: 5,
          pendingReviewCount: 0,
        },
      ]),
    )
    renderPage(<UploadBatchesPage />, '/batches', '*')
    expect(apiMocks.useBatchesQuery).toHaveBeenCalledWith(
      { programmeId: programme.id, intakeYear: '2025 / 26' },
      { skip: false },
    )
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/modules')
    expect(screen.getByRole('tab', { name: 'Admission criteria' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Batch 2' })).toHaveAttribute(
      'href',
      '/batches/batch%2Fone%3F',
    )
    const table = screen.getByRole('table', { name: 'Batches' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Batch', 'Date', 'Applicants', 'Unconditional', 'Conditional', 'Reject', 'Pending'])
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getByRole('row', { name: /Batch 2/ }).lastElementChild).toHaveTextContent(
      '1',
    )
    expect(within(table).getByRole('row', { name: /Batch 1/ }).lastElementChild).toHaveTextContent(
      '0',
    )
    expect(within(table).getByRole('row', { name: /Batch 2/ })).toContainElement(
      within(table).getByRole('cell', { name: '2' }),
    )
    const uploadDateTime = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(batch.uploadedAt))
    expect(screen.getAllByRole('cell', { name: uploadDateTime })).toHaveLength(2)
    expect(
      screen.queryByText(/Uploaded|First application|Earlier examples and individual uploads/),
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: /^Batch [12]$/ }).map((link) => link.textContent),
    ).toEqual(['Batch 2', 'Batch 1'])
    expect(screen.getByRole('link', { name: 'Batch 1' })).toBeInTheDocument()
  })
  it('uses shared pagination and returns to page one when the batch page size changes', async () => {
    apiMocks.useBatchesQuery.mockReturnValue(
      queryResult(
        Array.from({ length: 12 }, (_, index) => ({
          ...batch,
          id: `batch-${index + 1}`,
          sequence: index + 1,
          intakeYear: programme.year,
        })),
      ),
    )
    renderPage(<UploadBatchesPage />, '/batches', '*')
    const table = screen.getByRole('table', { name: 'Batches' })
    expect(within(table).getAllByRole('link')).toHaveLength(10)
    expect(within(table).getByRole('link', { name: 'Batch 12' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Go to page 2' }))
    expect(within(table).getAllByRole('link')).toHaveLength(2)
    expect(within(table).getByRole('link', { name: 'Batch 1' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('combobox', { name: 'Rows per page' }))
    await userEvent.click(screen.getByRole('option', { name: '25/page' }))
    expect(screen.getByRole('spinbutton', { name: 'Go to' })).toHaveValue(1)
    expect(within(table).getAllByRole('link')).toHaveLength(12)
    expect(within(table).getByRole('link', { name: 'Batch 12' })).toBeInTheDocument()
  })
  it('imports a selected ZIP through a staged reference and opens its applicant page', async () => {
    unwrap.mockResolvedValue({ id: batch.id })
    renderPage(<UploadBatchesPage />, '/batches', '*')
    expect(screen.queryByRole('button', { name: 'Upload batch' })).not.toBeInTheDocument()
    expect(screen.getByText(/No batches yet/)).toBeInTheDocument()
    const file = new File(['ZIP'], 'November.zip', { type: 'application/zip' })
    await userEvent.upload(screen.getByLabelText('Application ZIP file'), file)
    await userEvent.click(screen.getByRole('button', { name: 'Upload batch' }))
    expect(stageArchive).toHaveBeenCalledWith(file)
    expect(command).toHaveBeenCalledWith({
      op: 'importBatch',
      programmeId: programme.id,
      intakeYear: programme.year,
      archiveId: 'archive-staged',
    })
    expect(releaseArchive).toHaveBeenCalledWith('archive-staged')
    await waitFor(() =>
      expect(screen.getByLabelText('Current URL')).toHaveTextContent('/batches/batch%2Fone%3F'),
    )
  })
  it('surfaces import errors, releases the staged file and allows choosing a corrected ZIP', async () => {
    unwrap.mockRejectedValue({ data: 'Unreadable PDF' })
    renderPage(<UploadBatchesPage />, '/batches', '*')
    await userEvent.upload(
      screen.getByLabelText('Application ZIP file'),
      new File(['ZIP'], 'bad.zip', { type: 'application/zip' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Upload batch' }))
    expect(await screen.findByText('Unreadable PDF')).toBeInTheDocument()
    expect(releaseArchive).toHaveBeenCalledWith('archive-staged')
    await userEvent.upload(
      screen.getByLabelText('Application ZIP file'),
      new File(['ZIP'], 'fixed.zip', { type: 'application/zip' }),
    )
    expect(screen.queryByText('Unreadable PDF')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload batch' })).toBeEnabled()
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/batches')
  })
  it('clears a previously selected ZIP when its replacement is rejected', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderPage(<UploadBatchesPage />, '/batches', '*')
    const input = screen.getByLabelText('Application ZIP file')
    await user.upload(input, new File(['ZIP'], 'first.zip', { type: 'application/zip' }))
    expect(await screen.findByRole('button', { name: 'Upload batch' })).toBeEnabled()

    await user.upload(input, new File(['PDF'], 'replacement.pdf', { type: 'application/pdf' }))
    expect(await screen.findByText('Choose one ZIP file.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload batch' })).not.toBeInTheDocument()
    expect(screen.queryByText('first.zip')).not.toBeInTheDocument()
    expect(stageArchive).not.toHaveBeenCalled()

    await user.upload(input, new File(['ZIP'], 'corrected.zip', { type: 'application/zip' }))
    expect(await screen.findByRole('button', { name: 'Upload batch' })).toBeEnabled()
    expect(screen.queryByText('Choose one ZIP file.')).not.toBeInTheDocument()
    expect(screen.getByText('corrected.zip')).toBeInTheDocument()
  })
  it('disables duplicate imports and keeps the file visible while busy', async () => {
    const view = renderPage(<UploadBatchesPage />, '/batches', '*')
    await userEvent.upload(
      screen.getByLabelText('Application ZIP file'),
      new File(['ZIP'], 'batch.zip', { type: 'application/zip' }),
    )
    await screen.findByRole('button', { name: 'Upload batch' })
    mutation.isLoading = true
    view.rerender(<UploadBatchesPage />)
    expect(screen.getByRole('button', { name: 'Uploading…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Choose application ZIP' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('progressbar', { name: 'Uploading…' })).toBeInTheDocument()
    expect(command).not.toHaveBeenCalled()
  })
  it('handles loading, workspace failures, no assignments and batch-list failures', () => {
    workspaceMock.mockReturnValue({ programmes: [], isLoading: true })
    const view = renderPage(<UploadBatchesPage />, '/batches', '*')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    workspaceMock.mockReturnValue({ programmes: [], error: { data: 'Storage unavailable' } })
    view.rerender(<UploadBatchesPage />)
    expect(screen.getByText('Storage unavailable')).toBeInTheDocument()
    workspaceMock.mockReturnValue({ programmes: [] })
    view.rerender(<UploadBatchesPage />)
    expect(screen.getByText(/Choose a course and intake/)).toBeInTheDocument()
    workspaceMock.mockReturnValue({ programmes: [programme], programme })
    apiMocks.useBatchesQuery.mockReturnValue({ isLoading: true })
    view.rerender(<UploadBatchesPage />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    apiMocks.useBatchesQuery.mockReturnValue({ error: { data: 'Batch lookup failed' } })
    view.rerender(<UploadBatchesPage />)
    expect(screen.getByText('Batch lookup failed')).toBeInTheDocument()
    expect(screen.queryByText(/No batches yet/)).not.toBeInTheDocument()
  })
})
