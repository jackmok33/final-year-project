// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../test/domSetup'
import { SummaryCards } from './SummaryCards'

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
})
