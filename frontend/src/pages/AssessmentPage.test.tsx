// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { application, applicationListItem, detail, programme, run } from '../test/fixtures'
import { apiMocks, command, queryResult, resetPageMocks } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { AssessmentPage } from './AssessmentPage'

const applicationBase = '/programmes/programme-1/intakes/2026-27/applications/APP-TEST'
function renderReview(element: ReactElement, url = applicationBase) {
  return renderPage(
    element,
    url,
    url.startsWith('/applications/')
      ? '*'
      : '/programmes/:programmeId/intakes/:intake/applications/:id/*',
  )
}
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
vi.mock('../components/evidence/PdfViewer', () => ({
  PdfViewer: ({ page, document }: { page: number; document: { name: string } }) => (
    <div role="img" aria-label={`${document.name}, page ${page}`} />
  ),
}))
describe('application review and decision popup', () => {
  beforeEach(resetPageMocks)
  it('starts with the summary and recommendation, with keyboard-accessible tabs', async () => {
    renderReview(<AssessmentPage />)
    expect(screen.getByRole('heading', { name: '1 - SYN-TEST', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Programme' })).toHaveAttribute('href', '/programmes')
    expect(screen.getByRole('link', { name: 'CSML 26/27' })).toHaveAttribute(
      'href',
      '/programmes/programme-1/intakes/2026-27',
    )
    expect(screen.getByRole('link', { name: '1 - SYN-TEST' })).toHaveAttribute(
      'href',
      applicationBase,
    )
    expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument()
    expect(screen.getByText('88.0')).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'AI recommendation',
      'Review flag',
      'Score breakdown',
      'View documents',
    ])
    const summary = within(screen.getByRole('region', { name: 'Application review' }))
    expect(summary.getByRole('button', { name: 'Decision' })).toBeEnabled()
    expect(summary.getByRole('button', { name: 'Re-run AI evaluation' })).toBeEnabled()
    expect(screen.getByRole('tab', { name: 'AI recommendation' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText(run.justification.summary)).toBeInTheDocument()
    expect(within(screen.getByRole('tabpanel')).queryByRole('link')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Score breakdown' }))
    expect(screen.getByRole('button', { name: /Academic performance/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByText('academic evidence supported')).toBeInTheDocument()
    expect(within(screen.getByRole('tabpanel')).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText(run.justification.summary)).not.toBeInTheDocument()
  })
  it('opens the decision popup from the summary and returns to the selected tab without saving', async () => {
    renderReview(<AssessmentPage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Score breakdown' }))
    const trigger = screen.getByRole('button', { name: 'Decision' })
    await userEvent.click(trigger)
    const dialog = within(screen.getByRole('dialog', { name: 'Record decision' }))
    await userEvent.type(dialog.getByLabelText('Review note (optional)'), 'Unsaved review.')
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('tab', { name: 'Score breakdown' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('tab=scores')
    expect(trigger).toHaveFocus()
    expect(command).not.toHaveBeenCalled()
    await userEvent.click(trigger)
    expect(screen.getByLabelText('Review note (optional)')).toHaveValue('')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })
  it.each(['/applications/APP-TEST/decision', '/applications/APP-TEST?tab=decision'])(
    'keeps the legacy decision link %s usable without a fifth tab',
    async (url) => {
      renderReview(<AssessmentPage />, url)
      expect(screen.getByRole('dialog', { name: 'Record decision' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.getAllByRole('tab')).toHaveLength(4)
      expect(screen.getByRole('tab', { name: 'AI recommendation' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(screen.getByLabelText('Current URL')).toHaveTextContent(applicationBase)
      expect(command).not.toHaveBeenCalled()
    },
  )
  it('keeps flags and the supported correction action in the flag tab', async () => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({
        ...detail,
        application: {
          ...application,
          runs: [
            {
              ...run,
              flags: [
                {
                  code: 'GRADE_MISMATCH',
                  message: 'The transcript needs checking.',
                  critical: true,
                },
              ],
            },
          ],
        },
      }),
    )
    renderReview(<AssessmentPage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Review flag' }))
    expect(screen.getByRole('alert')).toHaveTextContent('The transcript needs checking.')
    const trigger = screen.getByRole('button', { name: 'Update detail' })
    await userEvent.click(trigger)
    const dialog = within(screen.getByRole('dialog', { name: 'Correct extracted fact' }))
    await userEvent.type(dialog.getByLabelText(/Reason for correction/), 'Unsaved correction')
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('tab', { name: 'Review flag' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(trigger).toHaveFocus()
    expect(command).not.toHaveBeenCalled()
    expect(screen.queryByText('GRADE_MISMATCH')).not.toBeInTheDocument()
  })
  it.each(['queued', 'running', 'failed'] as const)(
    'hides precomputed scores and evidence for %s results',
    async (status) => {
      apiMocks.useApplicationQuery.mockReturnValue(
        queryResult({ ...detail, application: { ...application, runs: [{ ...run, status }] } }),
      )
      renderReview(<AssessmentPage />)
      expect(screen.getByRole('button', { name: 'Decision' })).toBeDisabled()
      expect(screen.queryByText('88.0')).not.toBeInTheDocument()
      expect(screen.queryByText(run.justification.summary)).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('tab', { name: 'Score breakdown' }))
      expect(screen.queryByText('academic evidence supported')).not.toBeInTheDocument()
    },
  )
  it('shows no fabricated result for newly uploaded or unavailable applications', () => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({
        ...detail,
        application: {
          ...application,
          runs: [
            {
              ...run,
              flags: [
                { code: 'BACKEND_UNAVAILABLE', message: 'Backend unavailable', critical: true },
              ],
            },
          ],
        },
      }),
    )
    renderReview(<AssessmentPage />)
    expect(screen.queryByText('88.0')).not.toBeInTheDocument()
    expect(screen.queryByText('Backend unavailable')).not.toBeInTheDocument()
    const summary = screen.getByRole('region', { name: 'Application review' })
    expect(within(summary).getAllByText('—')).toHaveLength(2)
    expect(within(summary).getByText('Pending')).toBeInTheDocument()
  })
  it('shows the latest assessment without history controls and keeps re-evaluation available', async () => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({
        ...detail,
        application: { ...application, runs: [{ ...run, id: 'older', overall: 12 }, run] },
      }),
    )
    renderReview(<AssessmentPage />)
    expect(screen.getByText('88.0')).toBeInTheDocument()
    expect(screen.queryByText('12.0')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Assessment history' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Assessment run' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Re-run AI evaluation' }))
    expect(command).toHaveBeenCalledWith({ op: 'evaluate', id: application.id })
  })
  it('keeps bookmarked older results read-only until returning to the latest assessment', async () => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({
        ...detail,
        application: { ...application, runs: [{ ...run, id: 'older', overall: 12 }, run] },
      }),
    )
    renderReview(<AssessmentPage />, '/applications/APP-TEST?run=older')
    expect(screen.getByText(/Viewing a previous assessment/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decision' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Re-run AI evaluation' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Return to latest assessment' }))
    expect(screen.getByText('88.0')).toBeInTheDocument()
    expect(screen.queryByText(/Viewing a previous assessment/)).not.toBeInTheDocument()
  })
  it('does not turn a current-run document link into a historic review after re-evaluation', async () => {
    const view = renderReview(<AssessmentPage />, `/applications/APP-TEST?run=${run.id}`)
    await userEvent.click(screen.getByRole('button', { name: 'Re-run AI evaluation' }))
    expect(screen.getByLabelText('Current URL')).not.toHaveTextContent('run=')
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({
        ...detail,
        application: { ...application, runs: [run, { ...run, id: 'new-run', overall: 90 }] },
      }),
    )
    view.rerender(<AssessmentPage />)
    expect(screen.getByText('90.0')).toBeInTheDocument()
    expect(screen.queryByText(/Viewing a previous assessment/)).not.toBeInTheDocument()
  })
})

describe('canonical application ancestry', () => {
  const route = '/programmes/:programmeId/intakes/:intake/batches/:batchId/applications/:id/*'
  const batchBase = '/programmes/programme-1/intakes/2026-27/batches/batch-2'
  beforeEach(() => {
    resetPageMocks()
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({
        ...detail,
        application: { ...application, batchId: 'batch-2' },
      }),
    )
    apiMocks.useBatchQuery.mockReturnValue(
      queryResult({
        id: 'batch-2',
        programmeId: programme.id,
        intakeYear: programme.year,
        sequence: 2,
      }),
    )
    apiMocks.useApplicationsQuery.mockReturnValue(
      queryResult([
        { ...applicationListItem, id: 'earlier', batchId: 'batch-2' },
        { ...applicationListItem, batchId: 'batch-2' },
      ]),
    )
  })
  it('links the actual batch and applicant using the batch ordinal, retaining document context through tabs and popup cancellation', async () => {
    const base = `${batchBase}/applications/APP-TEST`
    renderPage(<AssessmentPage />, `${base}/evidence?document=APP-TEST-transcript&page=3`, route)
    expect(screen.getByRole('link', { name: 'Batch 2' })).toHaveAttribute('href', batchBase)
    expect(screen.getByRole('link', { name: '2 - SYN-TEST' })).toHaveAttribute('href', base)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2 - SYN-TEST')
    expect(
      screen.queryByRole('heading', { level: 2, name: '2 - SYN-TEST' }),
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Decision' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByLabelText('Current URL')).toHaveTextContent(
      `${base}/evidence?document=APP-TEST-transcript&page=3`,
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Score breakdown' }))
    expect(screen.getByLabelText('Current URL')).toHaveTextContent(
      `${base}?document=APP-TEST-transcript&page=3&tab=scores`,
    )
    await userEvent.click(screen.getByRole('tab', { name: 'View documents' }))
    expect(screen.getByRole('img', { name: 'transcript.pdf, page 3' })).toBeInTheDocument()
  })
  it.each([
    '/programmes/programme-2/intakes/2026-27/batches/batch-2/applications/APP-TEST',
    '/programmes/programme-1/intakes/2025-26/batches/batch-2/applications/APP-TEST',
    '/programmes/programme-1/intakes/2026-27/batches/wrong/applications/APP-TEST',
  ])('rejects mismatched ancestry at %s before showing evidence or actions', (url) => {
    renderPage(<AssessmentPage />, url, route)
    expect(screen.getByRole('alert')).toHaveTextContent('This application is unavailable')
    expect(screen.queryByRole('button', { name: 'Decision' })).not.toBeInTheDocument()
    expect(screen.queryByText(run.justification.summary)).not.toBeInTheDocument()
    expect(command).not.toHaveBeenCalled()
  })
  it('waits for authorised batch metadata and rejects its failure rather than inventing a batch number', () => {
    apiMocks.useBatchQuery.mockReturnValue({ ...queryResult(), isLoading: true })
    const view = renderPage(<AssessmentPage />, `${batchBase}/applications/APP-TEST`, route)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Batch/ })).not.toBeInTheDocument()
    apiMocks.useBatchQuery.mockReturnValue({ ...queryResult(), error: 'Not available' })
    view.rerender(<AssessmentPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('This application is unavailable')
    expect(screen.queryByRole('button', { name: 'Decision' })).not.toBeInTheDocument()
  })
})

it('keeps legacy correction links in the review shell and preserves the historic run on cancel', async () => {
  resetPageMocks()
  apiMocks.useApplicationQuery.mockReturnValue(
    queryResult({
      ...detail,
      application: { ...application, runs: [{ ...run, id: 'older' }, run] },
    }),
  )
  renderReview(<AssessmentPage />, '/applications/APP-TEST/correct?run=older')
  expect(screen.getByRole('dialog', { name: 'Correct extracted fact' })).toBeInTheDocument()
  expect(screen.getByText(/latest assessment before correcting/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Close fact correction' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('run=older')
  expect(screen.getByRole('tab', { name: 'Review flag' })).toHaveAttribute('aria-selected', 'true')
  expect(command).not.toHaveBeenCalled()
})

it('removes the current-run bookmark after saving a correction so the new result can display', async () => {
  resetPageMocks()
  const view = renderReview(
    <AssessmentPage />,
    `/applications/APP-TEST?tab=flags&correction=edit&run=${run.id}`,
  )
  await userEvent.type(screen.getByLabelText(/Reason for correction/), 'Verified transcript')
  await userEvent.click(screen.getByRole('button', { name: 'Save & re-evaluate' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByLabelText('Current URL')).not.toHaveTextContent('run=')
  expect(screen.getByLabelText('Current URL')).not.toHaveTextContent('correction=')
  apiMocks.useApplicationQuery.mockReturnValue(
    queryResult({
      ...detail,
      application: { ...application, runs: [run, { ...run, id: 'new-run', overall: 91 }] },
    }),
  )
  view.rerender(<AssessmentPage />)
  expect(screen.getByText('91.0')).toBeInTheDocument()
  expect(screen.queryByText(/Viewing a previous assessment/)).not.toBeInTheDocument()
})

it('preserves document and page context when closing a correction popup', async () => {
  resetPageMocks()
  renderReview(
    <AssessmentPage />,
    `/applications/APP-TEST/evidence?document=APP-TEST-transcript&page=2&correction=edit`,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('tab', { name: 'View documents' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.getByLabelText('Current URL')).toHaveTextContent(
    'document=APP-TEST-transcript&page=2',
  )
})
