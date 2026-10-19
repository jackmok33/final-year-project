// @vitest-environment jsdom
import '../test/domSetup'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { apiMocks, command, queryResult, resetPageMocks, workspaceMock } from '../test/pageMocks'
import { application, detail, documents, run, programme, tutor } from '../test/fixtures'
import { renderPage } from '../test/renderPage'
import { ApplicationsPage } from './ApplicationsPage'
import { AssessmentPage } from './AssessmentPage'
import { EvidencePage } from './EvidencePage'
import { authorizedFile } from '../services/demo'
import { downloadBlob } from '../components/files'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../app/workspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
vi.mock('../services/demo', () => ({ authorizedFile: vi.fn() }))
vi.mock('../components/files', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadBlob: vi.fn(),
}))
// PDF lifecycle has its own unit tests; these page tests verify citation selection.
vi.mock('../components/evidence/PdfViewer', () => ({
  PdfViewer: ({ page, document }: { page: number; document: { name: string } }) => (
    <div role="img" aria-label={`${document.name}, page ${page}`} />
  ),
}))
beforeEach(resetPageMocks)
describe('application queue', () => {
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
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/batches')
    expect(screen.queryByRole('link', { name: 'Admission criteria' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open APP-TEST' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open APP-OLDER' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Export/ })).not.toBeInTheDocument()
  })
  it('filters candidate search, workflow and recommendation independently', async () => {
    apiMocks.useApplicationsQuery.mockReturnValue(
      queryResult([
        application,
        {
          ...application,
          id: 'APP-OTHER',
          candidate: 'SYN-OTHER',
          runs: [{ ...run, recommendation: 'Reject', status: 'failed' }],
        },
      ]),
    )
    renderPage(<ApplicationsPage />, '/applications', '*')
    expect(screen.getByRole('link', { name: 'Open APP-OTHER' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Search application/), { target: { value: 'syn-test' } })
    expect(screen.queryByRole('link', { name: 'Open APP-OTHER' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Search application/), { target: { value: '' } })
    await userEvent.click(screen.getByRole('combobox', { name: 'Workflow state' }))
    await userEvent.click(screen.getByRole('option', { name: /failed/i }))
    expect(screen.queryByRole('link', { name: `Open ${application.id}` })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('combobox', { name: 'Recommendation' }))
    await userEvent.click(screen.getByRole('option', { name: 'Offer' }))
    expect(screen.getByText(/No applications match/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Export/ })).not.toBeInTheDocument()
  })
})
describe('assessment page', () => {
  it('shows unavailable assessments without integration notices or fabricated results', () => {
    const unavailable = {
      ...run,
      overall: null,
      extractedGrade: null,
      flags: [
        {
          code: 'BACKEND_UNAVAILABLE',
          message: 'This upload needs the backend and local AI service.',
          critical: true,
        },
      ],
      sections: run.sections.map((section) => ({
        ...section,
        score: null,
        explanation: 'Evaluation requires the backend and local model.',
        citations: [],
      })),
      justification: {
        ...run.justification,
        summary: 'Connect the backend and local model before evaluating this application.',
        citations: [],
      },
    }
    const original = structuredClone(unavailable)
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({ ...detail, application: { ...application, runs: [unavailable] } }),
    )
    renderPage(<AssessmentPage />)
    expect(screen.getByText('Not assessed', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('No assessment available for these documents.')).toBeInTheDocument()
    expect(screen.queryByText(/backend|local AI service/i)).not.toBeInTheDocument()
    expect(screen.queryByText('88')).not.toBeInTheDocument()
    expect(unavailable).toEqual(original)
  })
  it('does not invent an assessment for a new upload and can request evaluation', async () => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({ ...detail, application: { ...application, fixture: undefined, runs: [] } }),
    )
    renderPage(<AssessmentPage />)
    expect(screen.getByText(/Your original PDFs are saved/)).toBeInTheDocument()
    expect(screen.queryByText('Why this recommendation')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Request evaluation/ }))
    expect(command).toHaveBeenCalledWith({ op: 'evaluate', id: application.id })
  })
  it('disables duplicate evaluation and decisions during processing', () => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({
        ...detail,
        application: { ...application, runs: [{ ...run, status: 'running' }] },
      }),
    )
    renderPage(<AssessmentPage />)
    expect(screen.getByText(/This run will finish even if you refresh/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Re-evaluate/ })).toBeDisabled()
    expect(screen.getByRole('link', { name: /Record decision/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
  it('allows historic run review while retaining original criteria and correction/decision history', async () => {
    const app = {
      ...application,
      runs: [
        run,
        { ...run, id: 'run-2', overall: null, recommendation: 'Further review', status: 'failed' },
      ],
      corrections: [
        {
          id: 'c1',
          runId: run.id,
          original: 71,
          value: 74,
          reason: 'Verified transcript',
          citation: run.justification.citations[0],
          actor: 'tutor-a',
          at: run.startedAt,
        },
      ],
      decisions: [
        {
          id: 'd1',
          runId: run.id,
          recommendation: run.recommendation,
          outcome: 'Offer',
          reason: '',
          actor: 'tutor-a',
          at: run.startedAt,
        },
      ],
    }
    apiMocks.useApplicationQuery.mockReturnValue(queryResult({ ...detail, application: app }))
    renderPage(<AssessmentPage />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Assessment run' }))
    await userEvent.click(screen.getByRole('option', { name: /Run 001/ }))
    expect(screen.getByText(/Viewing a previous run/)).toBeInTheDocument()
    expect(screen.getByText('Verified transcript', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Tutor recorded: Offer')).toBeInTheDocument()
  })
})
describe('source evidence page', () => {
  it.each([
    'document=missing&page=1',
    `document=${documents[0].id}&page=0`,
    `document=${documents[0].id}&page=1.5`,
    `document=${documents[0].id}&page=99`,
    `document=${documents[0].id}&page=2&run=missing`,
  ])('rejects invalid citation parameters %s', (query) => {
    renderPage(<EvidencePage />, `/applications/APP-TEST/evidence?${query}`)
    expect(screen.getByText(/citation has not been verified/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download original' })).toBeDisabled()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
  it('opens the exact cited run/page and keeps run identity during page navigation', async () => {
    renderPage(
      <EvidencePage />,
      `/applications/APP-TEST/evidence?document=${documents[0].id}&page=2&run=${run.id}`,
    )
    expect(screen.getByRole('img', { name: 'transcript.pdf, page 2' })).toBeInTheDocument()
    expect(screen.getByText(/Final average 74%/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByLabelText('Current URL')).toHaveTextContent(`page=3&run=${run.id}`)
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByRole('img', { name: 'transcript.pdf, page 2' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('combobox', { name: 'Original document' }))
    await userEvent.click(screen.getByRole('option', { name: 'cv.pdf' }))
    expect(screen.getByRole('img', { name: 'cv.pdf, page 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  })
  it('downloads the authorised original and surfaces access/storage failures', async () => {
    const blob = new Blob(['%PDF'])
    vi.mocked(authorizedFile)
      .mockResolvedValueOnce(blob)
      .mockRejectedValueOnce(new Error('Original PDF is missing'))
    renderPage(<EvidencePage />, '/applications/APP-TEST/evidence')
    await userEvent.click(screen.getByRole('button', { name: 'Download original' }))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, 'transcript.pdf'))
    expect(authorizedFile).toHaveBeenCalledWith(documents[0].id, 'tutor-a')
    await userEvent.click(screen.getByRole('button', { name: 'Download original' }))
    expect(await screen.findByText('Original PDF is missing')).toBeInTheDocument()
  })
})
