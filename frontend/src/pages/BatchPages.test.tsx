// @vitest-environment jsdom
import '../test/domSetup'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  apiMocks,
  command,
  mutation,
  queryResult,
  resetPageMocks,
  unwrap,
  workspaceMock,
} from '../test/pageMocks'
import { application, otherProgramme, programme, run, tutor } from '../test/fixtures'
import type { BatchSummary, Decision } from '../domain/types'
import { renderPage } from '../test/renderPage'
import { UploadBatchesPage } from './UploadBatchesPage'
import { ApplicationsPage } from './ApplicationsPage'
import { releaseArchive, stageArchive } from '../services/demo'
import { downloadBlob } from '../components/files'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../app/workspace', async () => ({
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
describe('intake upload batches', () => {
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
    await userEvent.click(screen.getByRole('button', { name: 'Export course results' }))
    const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0]
    const csv = await blob.text()
    expect(filename).toBe('course-results.csv')
    expect(csv).toContain('Tutor decision')
    expect(csv).toContain('"\'=1+2"')
    expect(csv).toContain('"Offer","","1.0"')
    expect(csv).toContain('OTHER-INTAKE')
    expect(csv).toContain('2025 / 26')
    expect(csv).toContain('"Offer","Reject","1.0"')
    expect(csv).not.toContain('OTHER-COURSE')
    expect(csv.split('\r\n')).toHaveLength(3)
  })
  it('disables course export without loaded records and criteria, including failed or refreshing queries', () => {
    apiMocks.useApplicationsQuery.mockReturnValue(queryResult([]))
    const view = renderPage(<UploadBatchesPage />, '/batches', '*')
    const exportButton = () => screen.getByRole('button', { name: 'Export course results' })
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
        decisions: [decision('Reject'), decision('Offer')],
      },
      {
        ...application,
        id: 'reject',
        batchId: 'two',
        decisions: [decision('Offer'), decision('Reject')],
      },
      { ...application, id: 'review', decisions: [decision('Further review')] },
      { ...application, id: 'ai-only' },
      {
        ...application,
        id: 'outdated',
        runs: [{ ...run, id: 'new-run' }],
        decisions: [decision('Offer')],
      },
      { ...application, id: 'no-assessment', runs: [], decisions: [decision('Offer')] },
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
    summaryValue('Total applicants', '6')
    summaryValue('Offers given', '1')
    summaryValue('Reviewed by tutor', '3 / 6')
    expect(
      screen
        .getByRole('heading', { name: 'Offers given' })
        .compareDocumentPosition(screen.getByRole('heading', { name: 'Upload applications' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
  it('shows zero for an empty intake and updates the overview when the intake changes', () => {
    apiMocks.useApplicationsQuery.mockReturnValue(
      queryResult([{ ...application, intakeYear: '25/26', decisions: [decision('Offer')] }]),
    )
    const view = renderPage(<UploadBatchesPage />, '/batches', '*')
    summaryValue('Total applicants', '0')
    summaryValue('Offers given', '0')
    summaryValue('Reviewed by tutor', '0 / 0')
    workspaceMock.mockReturnValue({ programme, programmes: [programme], intakeYear: '2025 / 26' })
    view.rerender(<UploadBatchesPage />)
    summaryValue('Total applicants', '1')
    summaryValue('Offers given', '1')
    summaryValue('Reviewed by tutor', '1 / 1')
  })
  it('keeps the upload controls available while overview data loads or fails without showing false counts', () => {
    apiMocks.useApplicationsQuery.mockReturnValue({ isLoading: true })
    const view = renderPage(<UploadBatchesPage />, '/batches', '*')
    const overview = () => within(screen.getByRole('region', { name: 'Intake overview' }))
    expect(overview().getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose ZIP' })).toBeEnabled()
    expect(screen.queryByRole('heading', { name: 'Offers given' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Total applicants' })).not.toBeInTheDocument()
    apiMocks.useApplicationsQuery.mockReturnValue({ data: [application], isLoading: false })
    view.rerender(<UploadBatchesPage />)
    expect(overview().getByRole('progressbar')).toBeInTheDocument()
    apiMocks.useApplicationsQuery.mockReturnValue({
      ...queryResult([application]),
      error: { data: 'Application lookup failed' },
    })
    view.rerender(<UploadBatchesPage />)
    expect(overview().getByRole('alert')).toHaveTextContent('Application lookup failed')
    expect(screen.queryByRole('heading', { name: 'Total applicants' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Offers given' })).not.toBeInTheDocument()
    apiMocks.useApplicationsQuery.mockReturnValue(queryResult([application]))
    view.rerender(<UploadBatchesPage />)
    summaryValue('Offers given', '0')
    summaryValue('Reviewed by tutor', '0 / 1')
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
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/modules/programme-1',
    )
    expect(screen.getByRole('link', { name: 'Admission criteria' })).toHaveAttribute(
      'href',
      '/criteria',
    )
    expect(screen.getByRole('link', { name: 'Open batch 2' })).toHaveAttribute(
      'href',
      '/batches/batch%2Fone%3F',
    )
    const table = screen.getByRole('table', { name: 'Previous batches' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Batch', 'Date', 'Applicants', 'Pending human review'])
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(
      within(table).getByRole('row', { name: /Open batch 2/ }).lastElementChild,
    ).toHaveTextContent('1')
    expect(
      within(table).getByRole('row', { name: /Open batch 1/ }).lastElementChild,
    ).toHaveTextContent('0')
    expect(within(table).getByRole('row', { name: /Open batch 2/ })).toContainElement(
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
      screen.getAllByRole('link', { name: /^Open batch/ }).map((link) => link.textContent),
    ).toEqual(['Batch 2', 'Batch 1'])
    expect(screen.getByRole('link', { name: 'Open batch 1' })).toBeInTheDocument()
  })
  it('imports a selected ZIP through a staged reference and opens its applicant page', async () => {
    unwrap.mockResolvedValue({ id: batch.id })
    renderPage(<UploadBatchesPage />, '/batches', '*')
    expect(screen.getByRole('button', { name: 'Upload batch' })).toBeDisabled()
    expect(screen.getByText(/No batches yet/)).toBeInTheDocument()
    const file = new File(['ZIP'], 'November.zip', { type: 'application/zip' })
    await userEvent.upload(screen.getByLabelText('Upload applicant ZIP'), file)
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
      screen.getByLabelText('Upload applicant ZIP'),
      new File(['ZIP'], 'bad.zip', { type: 'application/zip' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Upload batch' }))
    expect(await screen.findByText('Unreadable PDF')).toBeInTheDocument()
    expect(releaseArchive).toHaveBeenCalledWith('archive-staged')
    await userEvent.upload(
      screen.getByLabelText('Upload applicant ZIP'),
      new File(['ZIP'], 'fixed.zip', { type: 'application/zip' }),
    )
    expect(screen.queryByText('Unreadable PDF')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload batch' })).toBeEnabled()
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('/batches')
  })
  it('disables duplicate imports and shows an accessible busy state', () => {
    mutation.isLoading = true
    renderPage(<UploadBatchesPage />, '/batches', '*')
    expect(screen.getByRole('button', { name: 'Uploading…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Choose ZIP' })).toBeDisabled()
    expect(
      screen
        .getAllByRole('status')
        .some((element) => element.textContent?.includes('validating PDFs')),
    ).toBe(true)
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
describe('applicant rows within a ZIP batch', () => {
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
    expect(screen.getByRole('link', { name: 'Open APP-TEST' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open OTHER-BATCH' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open WRONG-MODULE' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Batch 2' })).toBeInTheDocument()
    expect(screen.getByText(batch.filename)).toBeInTheDocument()
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
    expect(screen.getByText(`${programme.name} · 26/27 intake`)).toBeInTheDocument()
    expect(screen.queryByText(/Review your assigned applications/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Document assessment is not connected/)).not.toBeInTheDocument()
  })
})
