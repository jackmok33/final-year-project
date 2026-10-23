// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { application, detail, run } from '../test/fixtures'
import { apiMocks, command, mutation, queryResult, resetPageMocks, unwrap } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { DecisionPage } from './DecisionPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
describe('tutor decision page', () => {
  beforeEach(resetPageMocks)
  it('does not show a previous application while loading', () => {
    apiMocks.useApplicationQuery.mockReturnValue({ ...queryResult(detail), currentData: undefined })
    renderPage(<DecisionPage />, '/applications/APP-OTHER/decision')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
  it.each(['Conditional', 'Unconditional', 'Reject'] as const)(
    'records %s directly with an optional note',
    async (outcome) => {
      renderPage(<DecisionPage />, '/applications/APP-TEST/decision')
      expect(screen.getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual([
        'Unconditional',
        'Conditional',
        'Reject',
      ])
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Review note (optional)')).not.toBeRequired()
      await userEvent.click(screen.getByRole('radio', { name: outcome }))
      await userEvent.click(screen.getByRole('button', { name: 'Record decision' }))
      expect(command).toHaveBeenCalledExactlyOnceWith({
        op: 'decide',
        id: application.id,
        runId: run.id,
        outcome,
        reason: '',
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() =>
        expect(screen.getByLabelText('Current URL')).toHaveTextContent(
          `/applications/${application.id}`,
        ),
      )
    },
  )
  it('saves the optional note and preserves drafts on storage failure', async () => {
    unwrap.mockRejectedValue(new Error('Decision failed'))
    mutation.error = { data: 'Decision failed' }
    renderPage(<DecisionPage />, '/applications/APP-TEST/decision')
    await userEvent.click(screen.getByRole('radio', { name: 'Unconditional' }))
    await userEvent.type(screen.getByLabelText('Review note (optional)'), 'Keep this note.')
    await userEvent.click(screen.getByRole('button', { name: 'Record decision' }))
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'Unconditional', reason: 'Keep this note.' }),
    )
    expect(screen.getByRole('radio', { name: 'Unconditional' })).toBeChecked()
    expect(screen.getByText('Decision failed')).toBeInTheDocument()
    expect(screen.getByLabelText('Review note (optional)')).toHaveValue('Keep this note.')
  })
  it('blocks all final outcomes while critical evidence remains unresolved', () => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({
        ...detail,
        application: {
          ...application,
          runs: [
            { ...run, flags: [{ code: 'MISSING', message: 'Missing evidence', critical: true }] },
          ],
        },
      }),
    )
    renderPage(<DecisionPage />, '/applications/APP-TEST/decision')
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Record decision' })).toBeDisabled()
  })
  it('prevents duplicate submissions and requires a completed assessment', () => {
    mutation.isLoading = true
    const view = renderPage(<DecisionPage />, '/applications/APP-TEST/decision')
    expect(screen.getByRole('button', { name: 'Record decision' })).toBeDisabled()
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({ ...detail, application: { ...application, runs: [] } }),
    )
    view.rerender(<DecisionPage />)
    expect(screen.getByText(/completed assessment before/)).toBeInTheDocument()
    expect(command).not.toHaveBeenCalled()
  })
})
