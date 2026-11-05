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
        items={[
          {
            id: 'one',
            label: 'CSML 26/27',
            path: '/programmes/one/intakes/2026-27',
            selected: true,
          },
        ]}
        onNavigate={onNavigate}
      />,
    )
    const link = screen.getByRole('link', { name: 'Open course CSML 26/27' })
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(link).toHaveAttribute('href', '/programmes/one/intakes/2026-27')
    await userEvent.click(link)
    expect(onNavigate).toHaveBeenCalledOnce()
  })
  it.each([
    [false, '/programmes'],
    [true, '/admin/users'],
  ] as const)(
    'returns the logo to the canonical workspace home when admin=%s',
    async (admin, destination) => {
      const onNavigate = vi.fn()
      renderPage(<WorkspaceNavigation admin={admin} items={[]} onNavigate={onNavigate} />)
      const logo = screen.getByRole('link', { name: 'UCL' })
      expect(logo).toHaveAttribute('href', destination)
      await userEvent.click(logo)
      expect(onNavigate).toHaveBeenCalledOnce()
      expect(screen.getByLabelText('Current URL')).toHaveTextContent(destination)
    },
  )
})
