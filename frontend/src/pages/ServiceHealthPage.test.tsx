// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { apiMocks, queryResult, resetPageMocks } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { ServiceHealthPage } from './ServiceHealthPage'

vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)

const checkedAt = '2026-11-01T12:00:00Z'
const refetch = vi.fn()
function healthResult(report: unknown, fetching = false) {
  apiMocks.useBackendHealthQuery.mockReturnValue({
    ...queryResult(report),
    isFetching: fetching,
    refetch,
  })
}
beforeEach(resetPageMocks)

describe('ServiceHealthPage', () => {
  it('shows a real successful probe without claiming database or inference health', async () => {
    healthResult({
      state: 'available',
      checkedAt,
      health: {
        status: 'ok',
        mode: 'mock',
        service: 'ucl-application-review-api',
        database: 'not configured',
        inference: 'not configured',
      },
    })
    renderPage(<ServiceHealthPage />, '/admin/health', '*')
    expect(screen.getByRole('heading', { name: 'Service health', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Administration' })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('link', { name: 'Service health' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText('Available', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('ucl-application-review-api')).toBeInTheDocument()
    expect(screen.getByText('Mock', { exact: true })).toBeInTheDocument()
    expect(screen.getAllByText('Not configured', { exact: true })).toHaveLength(2)
    expect(screen.getByText(/does not test PostgreSQL or AI inference/)).toBeInTheDocument()
    expect(screen.getByText(/^Last checked:/)).toHaveTextContent('1 Nov 2026')
    expect(apiMocks.useBackendHealthQuery).toHaveBeenCalledWith(undefined, {
      refetchOnMountOrArgChange: true,
    })
    await userEvent.click(screen.getByRole('button', { name: 'Refresh status' }))
    expect(refetch).toHaveBeenCalledOnce()
    expect(apiMocks.useCommandMutation).not.toHaveBeenCalled()
  })

  it('reports absent configuration without inventing service details', () => {
    renderPage(<ServiceHealthPage />, '/admin/health', '*')
    expect(screen.getByRole('alert')).toHaveTextContent('No backend service has been configured.')
    expect(screen.getByText('Not configured', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Mock', { exact: true })).not.toBeInTheDocument()
  })

  it('replaces an earlier success with the latest failed check', () => {
    healthResult({ state: 'unavailable', checkedAt, error: 'Cannot reach the backend service.' })
    const view = renderPage(<ServiceHealthPage />, '/admin/health', '*')
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the backend service.')
    expect(screen.getByText('Unavailable', { exact: true })).toBeInTheDocument()
    healthResult({ state: 'not-configured', checkedAt }, true)
    view.rerender(<ServiceHealthPage />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled()
    expect(screen.queryByText('Unavailable', { exact: true })).not.toBeInTheDocument()
  })

  it('shows unexpected query failures and permits retry', async () => {
    apiMocks.useBackendHealthQuery.mockReturnValue({
      ...queryResult(),
      error: { data: 'Health check failed' },
      isFetching: false,
      refetch,
    })
    renderPage(<ServiceHealthPage />, '/admin/health', '*')
    expect(screen.getByRole('alert')).toHaveTextContent('Health check failed')
    await userEvent.click(screen.getByRole('button', { name: 'Refresh status' }))
    expect(refetch).toHaveBeenCalledOnce()
    expect(screen.queryByText('Not configured', { exact: true })).not.toBeInTheDocument()
  })
})
