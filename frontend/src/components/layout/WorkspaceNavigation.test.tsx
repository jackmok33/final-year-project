// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { WorkspaceNavigation } from './WorkspaceNavigation'

describe('WorkspaceNavigation', () => {
  it('renders only supplied programme links, marks selection and closes navigation on use', async () => {
    const onNavigate = vi.fn()
    renderPage(
      <WorkspaceNavigation
        admin={false}
        items={[{ id: 'one', label: 'CSML 26/27', path: '/batches?programme=one', selected: true }]}
        onNavigate={onNavigate}
      />,
    )
    const link = screen.getByRole('link', { name: 'Open course CSML 26/27' })
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(link).toHaveAttribute('href', '/batches?programme=one')
    await userEvent.click(link)
    expect(onNavigate).toHaveBeenCalledOnce()
  })
})
