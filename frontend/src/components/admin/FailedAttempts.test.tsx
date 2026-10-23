// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { FailedAttempts } from './FailedAttempts'

describe('FailedAttempts', () => {
  it('opens the selected redacted job record', async () => {
    const log = { jobId: 'JOB-1', category: 'MODEL_UNAVAILABLE' },
      setLog = vi.fn()
    renderPage(
      <FailedAttempts
        data={{ modelAvailable: false, failed: 1, queued: 0, logs: [log] }}
        setLog={setLog}
      />,
    )
    expect(screen.getByText(log.jobId)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'View redacted log' }))
    expect(setLog).toHaveBeenCalledWith(log)
  })
  it('shows the empty state without a log action', () => {
    renderPage(<FailedAttempts setLog={vi.fn()} />)
    expect(screen.getByText('No failed attempts recorded.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
