// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { ServiceAvailability } from './ServiceAvailability'

describe('ServiceAvailability', () => {
  it('forwards model availability and blocks changes while saving', async () => {
    const onModelChange = vi.fn(),
      data = { modelAvailable: false, failed: 0, queued: 0, logs: [] }
    const view = renderPage(
      <ServiceAvailability data={data} busy={false} onModelChange={onModelChange} />,
    )
    await userEvent.click(screen.getByRole('switch'))
    expect(onModelChange).toHaveBeenCalledWith(true)
    view.rerender(<ServiceAvailability data={data} busy onModelChange={onModelChange} />)
    expect(screen.getByRole('switch')).toBeDisabled()
  })
  it('does not allow toggling until health data is available', () => {
    renderPage(<ServiceAvailability busy={false} onModelChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toBeDisabled()
  })
})
