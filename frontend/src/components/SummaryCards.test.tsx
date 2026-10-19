// @vitest-environment jsdom
import '../test/domSetup'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SummaryCards } from './SummaryCards'
import { QueueSummary } from './applications/QueueSummary'
import { HealthSummary } from './admin/HealthSummary'
import { application, run } from '../test/fixtures'

function card(label: string) {
  return within(
    screen.getByRole('heading', { name: label }).closest('.MuiPaper-root')! as HTMLElement,
  )
}

describe('shared summary cards', () => {
  it('preserves zero values, labels and hints when the items change', () => {
    const { rerender } = render(
      <SummaryCards items={[{ label: 'Jobs', value: 0, hint: 'Queued' }]} />,
    )
    expect(card('Jobs').getByText('0')).toBeInTheDocument()
    expect(card('Jobs').getByText('Queued')).toBeInTheDocument()
    rerender(<SummaryCards items={[{ label: 'Storage', value: 'Browser', hint: 'Demo only' }]} />)
    expect(screen.queryByRole('heading', { name: 'Jobs' })).not.toBeInTheDocument()
    expect(card('Storage').getByText('Browser')).toBeInTheDocument()
    expect(card('Storage').getByText('Demo only')).toBeInTheDocument()
  })

  it('shows queue counts derived from application states', () => {
    render(
      <QueueSummary
        applications={[
          application,
          { ...application, id: 'APP-FAILED', runs: [{ ...run, status: 'failed' }] },
        ]}
      />,
    )
    expect(card('Applications').getByText('2')).toBeInTheDocument()
    expect(card('Awaiting review').getByText('1')).toBeInTheDocument()
    expect(card('Final decisions').getByText('0')).toBeInTheDocument()
    expect(card('Failed runs').getByText('1')).toBeInTheDocument()
  })

  it('keeps health figures separate from queue counts without repeated environment notices', () => {
    const { rerender } = render(<HealthSummary />)
    expect(card('Available services').getByText('3 / 4')).toBeInTheDocument()
    expect(card('Failed jobs').getByText('0')).toBeInTheDocument()
    rerender(<HealthSummary data={{ modelAvailable: true, failed: 2, queued: 3, logs: [] }} />)
    expect(card('Available services').getByText('4 / 4')).toBeInTheDocument()
    expect(card('Failed jobs').getByText('2')).toBeInTheDocument()
    expect(card('Queued evaluations').getByText('3')).toBeInTheDocument()
    expect(screen.queryByText('Simulated environment')).not.toBeInTheDocument()
  })
})
