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
import { application, detail, documents, programme, rubric, run, tutor } from '../test/fixtures'
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
  const newerRubric = {
    ...rubric,
    id: 'rubric-current',
    version: '1.1',
    createdAt: '2026-10-19T12:00:00Z',
    weights: { academic: 60, cv: 20, statement: 20 },
    rejectBelow: 55,
    offerFrom: 90,
    margin: 2,
    mandatoryRule: 'Current internal rule',
  }
  function versionHistory() {
    apiMocks.useRubricsQuery.mockReturnValue(
      queryResult({ rubrics: [rubric, newerRubric], activeId: newerRubric.id }),
    )
  }
  it('loads all numeric settings from an older version without changing the active version', async () => {
    versionHistory()
    renderCriteria()
    await userEvent.click(screen.getByRole('button', { name: 'Load criteria v1.0' }))
    expect(screen.getByLabelText('Academic performance (%)')).toHaveValue(50)
    expect(screen.getByLabelText('CV & experience (%)')).toHaveValue(25)
    expect(screen.getByLabelText('Personal statement (%)')).toHaveValue(25)
    expect(screen.getByLabelText('Reject below')).toHaveValue(60)
    expect(screen.getByLabelText('Offer from')).toHaveValue(80)
    expect(screen.getByLabelText('Review margin (± points)')).toHaveValue(3)
    expect(
      within(screen.getByRole('form', { name: 'Admission criteria' })).getByRole('status'),
    ).toHaveTextContent('Loaded v1.0 into the form')
    expect(screen.getByRole('button', { name: 'Load criteria v1.0' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Load criteria v1.1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByText('Active: v1.1')).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Admission criteria' })).toHaveFocus()
    expect(command).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save criteria' })).toBeEnabled()
  })
  it('saves restored settings against the current version without restoring obsolete metadata', async () => {
    versionHistory()
    renderCriteria()
    await userEvent.click(screen.getByRole('button', { name: 'Load criteria v1.0' }))
    fireEvent.change(screen.getByLabelText('Offer from'), { target: { value: '85' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save criteria' }))
    expect(command).toHaveBeenCalledWith({
      op: 'rubric',
      rubric: {
        ...newerRubric,
        weights: rubric.weights,
        rejectBelow: rubric.rejectBelow,
        offerFrom: 85,
        margin: rubric.margin,
      },
    })
    expect(rubric.weights).toEqual({ academic: 50, cv: 25, statement: 25 })
    expect(newerRubric.weights).toEqual({ academic: 60, cv: 20, statement: 20 })
  })
  it('loads versions by keyboard and restores active settings when discarded or the active row is selected', async () => {
    versionHistory()
    renderCriteria()
    const old = screen.getByRole('button', { name: 'Load criteria v1.0' })
    old.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByLabelText('Offer from')).toHaveValue(80)
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.getByLabelText('Offer from')).toHaveValue(90)
    expect(
      within(screen.getByRole('form', { name: 'Admission criteria' })).queryByRole('status'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load criteria v1.1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(old)
    await userEvent.click(screen.getByRole('button', { name: 'Load criteria v1.1' }))
    expect(screen.getByLabelText('Academic performance (%)')).toHaveValue(60)
    expect(
      within(screen.getByRole('form', { name: 'Admission criteria' })).queryByRole('status'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save criteria' })).toBeDisabled()
  })
  it('keeps saving disabled when an older version has identical numeric values', async () => {
    apiMocks.useRubricsQuery.mockReturnValue(
      queryResult({
        rubrics: [rubric, { ...rubric, id: newerRubric.id, version: newerRubric.version }],
        activeId: newerRubric.id,
      }),
    )
    renderCriteria()
    await userEvent.click(screen.getByRole('button', { name: 'Load criteria v1.0' }))
    expect(
      within(screen.getByRole('form', { name: 'Admission criteria' })).getByRole('status'),
    ).toHaveTextContent('Loaded v1.0 into the form')
    expect(screen.getByRole('button', { name: 'Save criteria' })).toBeDisabled()
    expect(command).not.toHaveBeenCalled()
  })
  it('does not load settings from a different course', async () => {
    apiMocks.useRubricsQuery.mockReturnValue(
      queryResult({
        rubrics: [{ ...rubric, programmeId: 'other-course' }, newerRubric],
        activeId: newerRubric.id,
      }),
    )
    renderCriteria()
    await userEvent.click(screen.getByRole('button', { name: 'Load criteria v1.0' }))
    expect(screen.getByLabelText('Offer from')).toHaveValue(90)
    expect(
      within(screen.getByRole('form', { name: 'Admission criteria' })).queryByRole('status'),
    ).not.toBeInTheDocument()
  })
  it.each([false, true])(
    'lets the course owner tune numeric criteria regardless of legacy publication permission (%s)',
    (permission) => {
      apiMocks.useMeQuery.mockReturnValue(queryResult({ ...tutor, canPublishCriteria: permission }))
      workspaceMock.mockReturnValue({
        user: { ...tutor, canPublishCriteria: permission },
        programme: { ...programme, createdBy: tutor.id },
        isLoading: false,
      })
      renderCriteria()
      expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/batches')
      for (const label of [
        'Academic performance (%)',
        'CV & experience (%)',
        'Personal statement (%)',
        'Offer from',
        'Reject below',
        'Review margin (± points)',
      ])
        expect(screen.getByLabelText(label)).toBeEnabled()
      expect(screen.queryByLabelText('Mandatory academic rule')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save criteria' })).toBeDisabled()
      expect(screen.getByText('Active: v1.0')).toBeInTheDocument()
      expect(command).not.toHaveBeenCalled()
    },
  )
  it('requires valid weights and thresholds, supports decimals and discards unsaved changes', async () => {
    renderCriteria()
    fireEvent.change(screen.getByLabelText('Academic performance (%)'), { target: { value: '' } })
    expect(screen.getByText('—% · Invalid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save criteria' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Academic performance (%)'), {
      target: { value: '50.5' },
    })
    fireEvent.change(screen.getByLabelText('CV & experience (%)'), { target: { value: '24.5' } })
    expect(screen.getByText('100% · Valid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save criteria' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Offer from'), { target: { value: '50' } })
    expect(screen.getByText(/Use thresholds between/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save criteria' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Offer from'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Save criteria' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.getByLabelText('Academic performance (%)')).toHaveValue(50)
    expect(screen.getByLabelText('Offer from')).toHaveValue(80)
    expect(screen.queryByText(/Use thresholds between/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save criteria' })).toBeDisabled()
  })
  it('submits an independent draft against the active version and prevents duplicate saves', async () => {
    renderCriteria()
    fireEvent.change(screen.getByLabelText('Academic performance (%)'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('CV & experience (%)'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('Personal statement (%)'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('Offer from'), { target: { value: '85' } })
    fireEvent.change(screen.getByLabelText('Reject below'), { target: { value: '55' } })
    fireEvent.change(screen.getByLabelText('Review margin (± points)'), {
      target: { value: '2.5' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Save criteria' }))
    expect(command).toHaveBeenCalledWith({
      op: 'rubric',
      rubric: {
        ...rubric,
        weights: { academic: 60, cv: 20, statement: 20 },
        offerFrom: 85,
        rejectBelow: 55,
        margin: 2.5,
      },
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save criteria' })).toBeDisabled(),
    )
    expect(rubric.weights).toEqual({ academic: 50, cv: 25, statement: 25 })
  })
  it('keeps the draft after a failed save and shows the service error', async () => {
    unwrap.mockRejectedValue(new Error('Storage unavailable'))
    mutation.error = { data: 'Storage unavailable' }
    renderCriteria()
    fireEvent.change(screen.getByLabelText('Offer from'), { target: { value: '85' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save criteria' }))
    expect(screen.getByText('Storage unavailable')).toBeInTheDocument()
    expect(screen.getByLabelText('Offer from')).toHaveValue(85)
    expect(screen.getByRole('button', { name: 'Save criteria' })).toBeEnabled()
  })
  it('resets the draft when the active version or selected course changes', () => {
    const view = renderCriteria()
    fireEvent.change(screen.getByLabelText('Offer from'), { target: { value: '95' } })
    const next = { ...rubric, id: 'new-version', version: '1.1', offerFrom: 85 }
    apiMocks.useRubricsQuery.mockReturnValue(
      queryResult({ rubrics: [rubric, next], activeId: next.id }),
    )
    view.rerender(<CriteriaPage />)
    expect(screen.getByText('Active: v1.1')).toBeInTheDocument()
    expect(screen.getByLabelText('Offer from')).toHaveValue(85)
    expect(screen.getByText('v1.0 · Preserved')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Offer from'), { target: { value: '90' } })
    workspaceMock.mockReturnValue({
      user: tutor,
      programme: { ...programme, id: 'programme-2' },
      isLoading: false,
    })
    view.rerender(<CriteriaPage />)
    expect(screen.getByLabelText('Offer from')).toHaveValue(85)
  })
  it.each([
    { ...tutor, id: 'another-tutor' },
    { ...tutor, roles: ['admin'] },
    { ...tutor, active: false },
  ])('does not expose editing to a non-owner, administrator or inactive account', (user) => {
    workspaceMock.mockReturnValue({ user, programme, isLoading: false })
    renderCriteria()
    expect(screen.getByLabelText('Academic performance (%)')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save criteria' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load criteria v1.0' })).toBeDisabled()
  })
  it('disables fields during a save', () => {
    mutation.isLoading = true
    renderCriteria()
    expect(screen.getByLabelText('Offer from')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Load criteria v1.0' })).toBeDisabled()
  })
  it('preserves a draft and surfaces a failed background refresh of cached criteria', () => {
    const view = renderCriteria()
    fireEvent.change(screen.getByLabelText('Offer from'), { target: { value: '85' } })
    apiMocks.useRubricsQuery.mockReturnValue({
      ...queryResult({ rubrics: [rubric], activeId: rubric.id }),
      error: { data: 'Refresh failed' },
    })
    view.rerender(<CriteriaPage />)
    expect(screen.getByText('Refresh failed')).toBeInTheDocument()
    expect(screen.getByLabelText('Offer from')).toHaveValue(85)
  })
  it('handles missing criteria and rubric query errors without rendering a broken form', () => {
    apiMocks.useRubricsQuery.mockReturnValue(queryResult({ rubrics: [], activeId: 'missing' }))
    const view = renderCriteria()
    expect(screen.getByRole('alert')).toHaveTextContent('criteria for this course are unavailable')
    apiMocks.useRubricsQuery.mockReturnValue({ error: { data: 'Query failed' } })
    view.rerender(<CriteriaPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Query failed')
  })
  it('handles workspace errors and unassigned courses', () => {
    workspaceMock.mockReturnValue({ isLoading: false, error: { data: 'Workspace failed' } })
    const view = renderCriteria()
    expect(screen.getByText('Workspace failed')).toBeInTheDocument()
    view.unmount()
    workspaceMock.mockReturnValue({ isLoading: false })
    renderCriteria()
    expect(screen.getByText(/Choose a course from All courses/)).toBeInTheDocument()
  })
})
