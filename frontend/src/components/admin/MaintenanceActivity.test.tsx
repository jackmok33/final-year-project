// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { MaintenanceActivity } from './MaintenanceActivity'

describe('MaintenanceActivity', () => {
  it('shows the last 15 events newest first without mutating their stored order', () => {
    const events = Array.from({ length: 17 }, (_, i) => ({
      id: String(i),
      at: '2026-10-23T12:00:00Z',
      action: `Action ${i}`,
      actor: 'admin',
      target: `Target ${i}`,
    }))
    const original = structuredClone(events)
    renderPage(<MaintenanceActivity events={events} />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(15)
    expect(within(rows[0]).getByText('Action 16')).toBeInTheDocument()
    expect(within(rows.at(-1)!).getByText('Action 2')).toBeInTheDocument()
    expect(events).toEqual(original)
  })
  it('does not render an empty audit table', () => {
    renderPage(<MaintenanceActivity events={[]} />)
    expect(screen.getByText('No demo maintenance actions recorded yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
