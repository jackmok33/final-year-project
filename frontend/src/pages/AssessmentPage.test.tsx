// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { application, detail, run } from '../test/fixtures'
import { apiMocks, command, queryResult, resetPageMocks } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { AssessmentPage } from './AssessmentPage'
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
    renderPage(<AssessmentPage />)
    expect(screen.getByRole('heading', { name: 'CSML 26/27', level: 1 })).toBeInTheDocument()
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
    await userEvent.click(screen.getByRole('tab', { name: 'Score breakdown' }))
    expect(screen.getByRole('button', { name: /Academic performance/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByText('academic evidence supported')).toBeInTheDocument()
    expect(screen.queryByText(run.justification.summary)).not.toBeInTheDocument()
  })
  it('opens the decision popup from the summary and returns to the selected tab without saving', async () => {
    renderPage(<AssessmentPage />)
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
      renderPage(<AssessmentPage />, url)
      expect(screen.getByRole('dialog', { name: 'Record decision' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.getAllByRole('tab')).toHaveLength(4)
      expect(screen.getByRole('tab', { name: 'AI recommendation' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(screen.getByLabelText('Current URL')).toHaveTextContent('/applications/APP-TEST')
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
    renderPage(<AssessmentPage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Review flag' }))
    expect(screen.getByRole('alert')).toHaveTextContent('The transcript needs checking.')
    expect(screen.getByRole('link', { name: 'Update detail' })).toHaveAttribute(
      'href',
      `/applications/${application.id}/correct`,
    )
    expect(screen.queryByText('GRADE_MISMATCH')).not.toBeInTheDocument()
  })
  it.each(['queued', 'running', 'failed'] as const)(
    'hides precomputed scores and evidence for %s results',
    async (status) => {
      apiMocks.useApplicationQuery.mockReturnValue(
        queryResult({ ...detail, application: { ...application, runs: [{ ...run, status }] } }),
      )
      renderPage(<AssessmentPage />)
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
    renderPage(<AssessmentPage />)
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
    renderPage(<AssessmentPage />)
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
    renderPage(<AssessmentPage />, '/applications/APP-TEST?run=older')
    expect(screen.getByText(/Viewing a previous assessment/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decision' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Re-run AI evaluation' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Return to latest assessment' }))
    expect(screen.getByText('88.0')).toBeInTheDocument()
    expect(screen.queryByText(/Viewing a previous assessment/)).not.toBeInTheDocument()
  })
  it('does not turn a current-run document link into a historic review after re-evaluation', async () => {
    const view = renderPage(<AssessmentPage />, `/applications/APP-TEST?run=${run.id}`)
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
