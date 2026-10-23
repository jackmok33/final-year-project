// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { HealthSummary } from './HealthSummary'

describe('HealthSummary', () => {
  it('shows the supplied availability, failed and queued totals', () => {
    renderPage(<HealthSummary data={{ modelAvailable: true, failed: 2, queued: 3, logs: [] }} />)
    for (const [label, value] of [
      ['Available services', '4 / 4'],
      ['Failed jobs', '2'],
      ['Queued evaluations', '3'],
    ]) {
      const card = screen
        .getByRole('heading', { name: label })
        .closest('.MuiPaper-root')! as HTMLElement
      expect(within(card).getByText(value)).toBeInTheDocument()
    }
  })
})
