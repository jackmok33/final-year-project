// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { OutcomeOptions } from './OutcomeOptions'

describe('OutcomeOptions', () => {
  it('offers exactly the three final outcomes and forwards the chosen value', async () => {
    const setOutcome = vi.fn()
    renderPage(<OutcomeOptions outcome="Unconditional" setOutcome={setOutcome} critical={false} />)
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'Unconditional',
      'Conditional',
      'Reject',
    ])
    expect(screen.getByRole('radio', { name: 'Unconditional' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: 'Conditional' }))
    expect(setOutcome).toHaveBeenCalledWith('Conditional')
  })
  it('blocks every final outcome when evidence is critical', async () => {
    const setOutcome = vi.fn()
    renderPage(<OutcomeOptions outcome="Reject" setOutcome={setOutcome} critical />)
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
    screen.getByRole('radio', { name: 'Conditional' }).click()
    expect(setOutcome).not.toHaveBeenCalled()
  })
  it('blocks changes while the enclosing decision form is saving', () => {
    const setOutcome = vi.fn()
    renderPage(
      <OutcomeOptions outcome="Conditional" setOutcome={setOutcome} critical={false} disabled />,
    )
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
    screen.getByRole('radio', { name: 'Reject' }).click()
    expect(setOutcome).not.toHaveBeenCalled()
  })
})
