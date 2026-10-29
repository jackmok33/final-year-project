// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { BatchSummary } from '../../domain/types'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { BatchList } from './BatchList'

const batch: BatchSummary = {
  id: 'batch/one',
  programmeId: 'p',
  intakeYear: '26/27',
  filename: 'original.zip',
  source: 'zip',
  uploadedAt: '2026-10-23T12:30:00Z',
  sequence: 1,
  applicantCount: 5,
  pendingReviewCount: 2,
  unconditionalCount: 1,
  conditionalCount: 1,
  rejectCount: 1,
}
describe('BatchList', () => {
  it('shows the designed counts, encoded destination and controlled pagination', async () => {
    const onPageChange = vi.fn()
    renderPage(
      <BatchList
        batches={[batch]}
        isLoading={false}
        page={0}
        pageSize={5}
        total={6}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('link', { name: 'Batch 1' })).toHaveAttribute(
      'href',
      '/batches/batch%2Fone',
    )
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell')
    expect(cells[1]).toHaveTextContent(/\d{1,2}\s+[A-Za-z]{3}\s+\d{4},\s+\d{2}:\d{2}/)
    expect(cells.slice(2).map((cell) => cell.textContent)).toEqual(['5', '1', '1', '1', '2'])
    await userEvent.click(screen.getByRole('button', { name: 'Go to page 2' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })
  it('distinguishes loading, unavailable and empty results', () => {
    const props = {
      page: 0,
      pageSize: 5,
      total: 0,
      onPageChange: vi.fn(),
      onPageSizeChange: vi.fn(),
    }
    const view = renderPage(<BatchList {...props} isLoading />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    view.rerender(<BatchList {...props} isLoading={false} error="Storage unavailable" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Storage unavailable')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    view.rerender(<BatchList {...props} isLoading={false} batches={[]} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
