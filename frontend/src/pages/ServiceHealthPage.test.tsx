// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../test/domSetup'
import { apiMocks, command, queryResult, resetPageMocks } from '../test/pageMocks'
import { renderPage } from '../test/renderPage'
import { ServiceHealthPage } from './ServiceHealthPage'
vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../app/store', async () => (await import('../test/pageMocks')).storeMocks)
vi.mock('../hooks/redux', async () => (await import('../test/pageMocks')).reduxMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))
describe('simulated service health', () => {
  beforeEach(resetPageMocks)
  const show = (page: React.ReactElement) => renderPage(page, '/admin', '*')
  it('changes model availability and shows redacted logs without applicant content', async () => {
    show(<ServiceHealthPage />)
    await userEvent.click(screen.getByRole('switch'))
    expect(command).toHaveBeenCalledWith({ op: 'model', available: true })
    await userEvent.click(screen.getByRole('button', { name: 'View redacted log' }))
    const dialog = screen.getByRole('dialog', { name: 'Redacted demo log' })
    expect(dialog).toHaveTextContent('JOB-1')
    expect(dialog).toHaveTextContent('Applicant content: excluded')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('handles healthy services with no failures', () => {
    apiMocks.useHealthQuery.mockReturnValue(
      queryResult({ modelAvailable: true, queued: 0, failed: 0, logs: [] }),
    )
    show(<ServiceHealthPage />)
    expect(screen.getByText('No failed attempts recorded.')).toBeInTheDocument()
    expect(screen.queryByText(/Simulated local model unavailable/)).not.toBeInTheDocument()
  })
})
