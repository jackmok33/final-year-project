// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { application, detail, documents, run } from '../test/fixtures'
import { apiMocks, command, mutation, queryResult, resetPageMocks, unwrap } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { CorrectionPage } from './CorrectionPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
describe('fact correction page', () => {
  beforeEach(resetPageMocks)
  it.each([0, 67.5, 92])('initialises the correction from the extracted grade %s', (grade) => {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({
        ...detail,
        application: { ...application, runs: [{ ...run, extractedGrade: grade }] },
      }),
    )
    renderPage(<CorrectionPage />)
    expect(screen.getByLabelText(/Corrected value/)).toHaveValue(grade)
  })
  it('does not offer corrections for the previous application while the next record loads', () => {
    apiMocks.useApplicationQuery.mockReturnValue({
      ...queryResult(detail),
      currentData: undefined,
    })
    renderPage(<CorrectionPage />, '/applications/APP-OTHER/correct')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Corrected value/)).not.toBeInTheDocument()
  })
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

it('cancels through the supplied callback without saving', async () => {
  resetPageMocks()
  const close = vi.fn()
  renderPage(<CorrectionPage onClose={close} />)
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(close).toHaveBeenCalledOnce()
  expect(command).not.toHaveBeenCalled()
})

it('calls the saved callback only after a valid correction succeeds', async () => {
  resetPageMocks()
  const saved = vi.fn()
  renderPage(<CorrectionPage onSaved={saved} />)
  await userEvent.type(screen.getByLabelText(/Reason for correction/), 'Verified transcript')
  await userEvent.click(screen.getByRole('button', { name: 'Save & re-evaluate' }))
  await waitFor(() => expect(saved).toHaveBeenCalledOnce())
})

it.each(['0', '-1', '1.5', '5', ''])(
  'rejects invalid source page %s before saving',
  async (page) => {
    resetPageMocks()
    renderPage(<CorrectionPage />)
    fireEvent.change(screen.getByLabelText(/Source page/), { target: { value: page } })
    await userEvent.type(screen.getByLabelText(/Reason for correction/), 'Verified transcript')
    expect(screen.getByRole('button', { name: 'Save & re-evaluate' })).toBeDisabled()
    expect(command).not.toHaveBeenCalled()
  },
)

it.each(['-1', '101', ''])('rejects invalid corrected grade %s before saving', async (grade) => {
  resetPageMocks()
  renderPage(<CorrectionPage />)
  fireEvent.change(screen.getByLabelText(/Corrected value/), { target: { value: grade } })
  await userEvent.type(screen.getByLabelText(/Reason for correction/), 'Verified transcript')
  expect(screen.getByRole('button', { name: 'Save & re-evaluate' })).toBeDisabled()
  expect(command).not.toHaveBeenCalled()
})

it('keeps historical correction bookmarks read-only', () => {
  resetPageMocks()
  apiMocks.useApplicationQuery.mockReturnValue(
    queryResult({
      ...detail,
      application: { ...application, runs: [{ ...run, id: 'older' }, run] },
    }),
  )
  renderPage(<CorrectionPage />, '/applications/APP-TEST/correct?run=older')
  expect(screen.getByRole('dialog', { name: 'Correct extracted fact' })).toBeInTheDocument()
  expect(screen.getByText(/latest assessment before correcting/)).toBeInTheDocument()
  expect(screen.queryByLabelText(/Corrected value/)).not.toBeInTheDocument()
  expect(command).not.toHaveBeenCalled()
})

it('disables edits and dismissal while a correction is saving', async () => {
  resetPageMocks()
  mutation.isLoading = true
  const close = vi.fn()
  renderPage(<CorrectionPage onClose={close} />)
  for (const label of [/Corrected value/, /Source page/, /Reason for correction/]) {
    expect(screen.getByLabelText(label)).toBeDisabled()
  }
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Close fact correction' })).toBeDisabled()
  await userEvent.keyboard('{Escape}')
  expect(close).not.toHaveBeenCalled()
  expect(command).not.toHaveBeenCalled()
})

it('does not dismiss another screen after an in-flight save finishes', async () => {
  resetPageMocks()
  let finish!: (result: { id?: string }) => void
  unwrap.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const saved = vi.fn()
  const view = renderPage(<CorrectionPage onSaved={saved} />)
  await userEvent.type(screen.getByLabelText(/Reason for correction/), 'Verified transcript')
  await userEvent.click(screen.getByRole('button', { name: 'Save & re-evaluate' }))
  view.unmount()
  finish({ id: 'corrected-run' })
  await Promise.resolve()
  expect(saved).not.toHaveBeenCalled()
})

it('does not close a replacement run draft when an earlier save finishes', async () => {
  resetPageMocks()
  let finish!: (result: { id?: string }) => void
  unwrap.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const saved = vi.fn()
  const view = renderPage(<CorrectionPage onSaved={saved} />)
  await userEvent.type(screen.getByLabelText(/Reason for correction/), 'Earlier run note')
  await userEvent.click(screen.getByRole('button', { name: 'Save & re-evaluate' }))
  apiMocks.useApplicationQuery.mockReturnValue(
    queryResult({
      ...detail,
      application: { ...application, runs: [run, { ...run, id: 'replacement-run' }] },
    }),
  )
  view.rerender(<CorrectionPage onSaved={saved} />)
  expect(screen.getByLabelText(/Reason for correction/)).toHaveValue('')
  finish({ id: 'corrected-run' })
  await Promise.resolve()
  expect(saved).not.toHaveBeenCalled()
})

it('blocks corrections without a transcript, grade, or assessed result', () => {
  resetPageMocks()
  apiMocks.useApplicationQuery.mockReturnValue(queryResult({ ...detail, documents: [] }))
  const view = renderPage(<CorrectionPage />)
  expect(screen.getByRole('button', { name: 'Save & re-evaluate' })).toBeDisabled()
  for (const runs of [
    [],
    [{ ...run, extractedGrade: null }],
    [{ ...run, flags: [{ code: 'BACKEND_UNAVAILABLE', message: 'Unavailable', critical: true }] }],
  ]) {
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({ ...detail, application: { ...application, runs } }),
    )
    view.rerender(<CorrectionPage />)
    expect(screen.getByText(/completed extraction is required/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Corrected value/)).not.toBeInTheDocument()
  }
})
