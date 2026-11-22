// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { EnglishTestCheck } from '../../domain/types'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { EnglishTestCheckCard } from './EnglishTestCheckCard'

const check: EnglishTestCheck = {
  id: 'english-job',
  documentId: 'english-test-pdf',
  page: 1,
  ruleVersion: 'ielts-academic-demo-v1',
  status: 'queued',
  result: null,
  error: null,
}

describe('EnglishTestCheckCard', () => {
  it('queues a check, prevents duplicates while busy and allows retry after failure', async () => {
    const onRun = vi.fn()
    const view = renderPage(<EnglishTestCheckCard check={null} submitting={false} onRun={onRun} />)
    await userEvent.click(screen.getByRole('button', { name: 'Run English check' }))
    expect(onRun).toHaveBeenCalledOnce()
    view.rerender(<EnglishTestCheckCard check={check} submitting={false} onRun={onRun} />)
    expect(screen.getByText('English check queued.').closest('[role="status"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Run English check' })).toBeDisabled()
    view.rerender(
      <EnglishTestCheckCard
        check={{ ...check, status: 'failed', error: 'interrupted' }}
        submitting={false}
        onRun={onRun}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('The check was interrupted')
    expect(screen.getByRole('button', { name: 'Retry English check' })).toBeEnabled()
  })

  it('shows the reported bands, review reason and original source', () => {
    renderPage(
      <EnglishTestCheckCard
        check={{
          ...check,
          status: 'completed',
          result: {
            outcome: 'needs_review',
            reason: 'missing_bands',
            testType: 'IELTS Academic',
            testDate: '2026-01-15',
            overall: 7,
            listening: 7.5,
            reading: 7,
            writing: null,
            speaking: 7,
          },
        }}
        submitting={false}
        sourcePath="/applications/APP-TEST/evidence?document=english-test-pdf&page=1"
        onRun={vi.fn()}
      />,
    )
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Needs review')
    expect(screen.getByText('Unavailable')).toBeVisible()
    expect(screen.getByText('7.5')).toBeVisible()
    expect(screen.getByRole('link', { name: 'View original report, page 1' })).toHaveAttribute(
      'href',
      '/applications/APP-TEST/evidence?document=english-test-pdf&page=1',
    )
  })
})
