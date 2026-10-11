// @vitest-environment jsdom
import '../test/domSetup'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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
import { application, detail, documents, rubric, run, tutor } from '../test/fixtures'
import { renderPage } from '../test/renderPage'
import { CorrectionPage } from './CorrectionPage'
import { DecisionPage } from './DecisionPage'
import { CriteriaPage } from './CriteriaPage'
import { vi } from 'vitest'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../app/workspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
beforeEach(resetPageMocks)
describe('fact correction page', () => {
  it.each(['queued', 'running', 'failed'] as const)(
    'prevents correction during a %s run',
    (status) => {
      apiMocks.useApplicationQuery.mockReturnValue(
        queryResult({ ...detail, application: { ...application, runs: [{ ...run, status }] } }),
      )
      renderPage(<CorrectionPage />)
      expect(screen.getByText(/completed extraction is required/)).toBeInTheDocument()
      expect(screen.queryByLabelText('Corrected value (%)')).not.toBeInTheDocument()
    },
  )
  it('starts on a valid source page for a one-page transcript', () => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({ ...detail, documents: [{ ...documents[0], pages: 1 }] }),
    )
    renderPage(<CorrectionPage />)
    expect(screen.getByLabelText(/Source page/)).toHaveValue(1)
  })
  it('requires a reason and submits the original run with the source reference', async () => {
    renderPage(<CorrectionPage />)
    expect(screen.getByRole('button', { name: 'Save & re-evaluate' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Corrected value/), { target: { value: '79' } })
    fireEvent.change(screen.getByLabelText(/Source page/), { target: { value: '3' } })
    await userEvent.type(
      screen.getByLabelText(/Reason for correction/),
      'Transcript page 3 confirms 79%.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save & re-evaluate' }))
    expect(command).toHaveBeenCalledWith({
      op: 'correct',
      id: application.id,
      runId: run.id,
      value: 79,
      reason: 'Transcript page 3 confirms 79%.',
      documentId: documents[0].id,
      page: 3,
    })
    await waitFor(() =>
      expect(screen.getByLabelText('Current URL')).toHaveTextContent(
        `/applications/${application.id}`,
      ),
    )
  })
  it('preserves the draft and surfaces errors after a failed correction', async () => {
    unwrap.mockRejectedValue(new Error('Save failed'))
    mutation.error = { data: 'Save failed' }
    renderPage(<CorrectionPage />)
    await userEvent.type(screen.getByLabelText(/Reason for correction/), 'Check transcript')
    await userEvent.click(screen.getByRole('button', { name: 'Save & re-evaluate' }))
    expect(screen.getByText(/original value is preserved/)).toBeInTheDocument()
    expect(screen.getByText('Save failed')).toBeInTheDocument()
    expect(screen.getByLabelText(/Reason for correction/)).toHaveValue('Check transcript')
  })
  it('resets a correction draft when a different run is selected', async () => {
    const view = renderPage(<CorrectionPage />)
    await userEvent.type(screen.getByLabelText(/Reason for correction/), 'Old run note')
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({ ...detail, application: { ...application, runs: [{ ...run, id: 'run-2' }] } }),
    )
    view.rerender(<CorrectionPage />)
    expect(screen.getByLabelText(/Reason for correction/)).toHaveValue('')
  })
})
describe('tutor decision page', () => {
  it('keeps recommendation separate and requires review plus final confirmation for an Offer', async () => {
    renderPage(<DecisionPage />)
    expect(screen.getByText('AI recommendation: Offer')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Offer' }))
    expect(screen.getByRole('button', { name: 'Record offer' })).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Record offer' }))
    expect(command).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: /final Offer/ })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(command).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Record offer' }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }),
    )
    expect(command).toHaveBeenCalledWith({
      op: 'decide',
      id: application.id,
      runId: run.id,
      outcome: 'Offer',
      reason: '',
      confirmed: true,
    })
  })
  it('requires a non-blank override reason and can keep the case unresolved', async () => {
    renderPage(<DecisionPage />)
    expect(screen.getByRole('button', { name: 'Record further review' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/Reason for override/), 'Need more evidence')
    await userEvent.click(screen.getByRole('button', { name: 'Record further review' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'Further review',
        reason: 'Need more evidence',
        confirmed: false,
      }),
    )
  })
  it('blocks final outcomes while critical evidence is unresolved', () => {
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
    renderPage(<DecisionPage />)
    expect(screen.getByRole('radio', { name: 'Offer' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Reject' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Further review' })).toBeEnabled()
  })
  it('closes the confirmation and shows mutation errors if saving fails', async () => {
    unwrap.mockRejectedValue(new Error('Decision failed'))
    mutation.error = { data: 'Decision failed' }
    renderPage(<DecisionPage />)
    await userEvent.click(screen.getByRole('radio', { name: 'Offer' }))
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Record offer' }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Decision failed')).toBeInTheDocument()
  })
  it('requires a completed assessment before recording decisions', () => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({ ...detail, application: { ...application, runs: [] } }),
    )
    renderPage(<DecisionPage />)
    expect(screen.getByText(/completed assessment before/)).toBeInTheDocument()
  })
})
describe('versioned criteria page', () => {
  const renderCriteria = () => renderPage(<CriteriaPage />, '/criteria', '*')
  it('validates weights and activates a new version only after confirmation', async () => {
    renderCriteria()
    fireEvent.change(screen.getByLabelText('Academic performance (%)'), { target: { value: '40' } })
    expect(screen.getByRole('button', { name: 'Activate draft' })).toBeDisabled()
    expect(screen.getByText(/must be between 0 and 100 and total 100/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Academic performance (%)'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('Offer from'), { target: { value: '85' } })
    await userEvent.click(screen.getByRole('button', { name: 'Activate draft' }))
    expect(command).not.toHaveBeenCalled()
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }),
    )
    expect(command).toHaveBeenCalledWith({ op: 'rubric', rubric: { ...rubric, offerFrom: 85 } })
    expect(rubric.offerFrom).toBe(80)
  })
  it('makes criteria read-only without publication permission', () => {
    apiMocks.useMeQuery.mockReturnValue(queryResult({ ...tutor, canPublishCriteria: false }))
    renderCriteria()
    expect(screen.getByLabelText('Offer from')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Activate draft' })).toBeDisabled()
    expect(screen.getByText(/cannot publish/)).toBeInTheDocument()
  })
  it('handles workspace errors and unassigned courses', () => {
    workspaceMock.mockReturnValue({ isLoading: false, error: { data: 'Workspace failed' } })
    const view = renderCriteria()
    expect(screen.getByText('Workspace failed')).toBeInTheDocument()
    view.unmount()
    workspaceMock.mockReturnValue({ isLoading: false })
    renderCriteria()
    expect(screen.getByText(/No course workspace/)).toBeInTheDocument()
  })
})
