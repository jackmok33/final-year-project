// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { programme, rubric, tutor } from '../test/fixtures'
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
import { CriteriaPage } from './CriteriaPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
describe('versioned criteria page', () => {
  beforeEach(resetPageMocks)
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
  it('shows only active settings without history and discards drafts back to the active criteria', async () => {
    apiMocks.useRubricsQuery.mockReturnValue(
      queryResult({ rubrics: [rubric, newerRubric], activeId: newerRubric.id }),
    )
    renderCriteria()
    expect(screen.getByLabelText('Academic performance (%)')).toHaveValue(60)
    expect(screen.getByLabelText('Offer from')).toHaveValue(90)
    expect(screen.queryByRole('heading', { name: 'Version history' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Load criteria/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Offer from'), { target: { value: '85' } })
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.getByLabelText('Offer from')).toHaveValue(90)
    expect(command).not.toHaveBeenCalled()
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
    expect(screen.getByLabelText('Offer from')).toHaveValue(85)
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
  })
  it('disables fields during a save', () => {
    mutation.isLoading = true
    renderCriteria()
    expect(screen.getByLabelText('Offer from')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
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
