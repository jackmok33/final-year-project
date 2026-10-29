// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/domSetup'
import { tutor } from '../../test/fixtures'
import { renderPage } from '../../test/renderPage'
import { WorkspaceHeader } from './WorkspaceHeader'

describe('WorkspaceHeader', () => {
  it('provides account actions and a role switch only for dual-role users', async () => {
    const onSignOut = vi.fn(),
      onChangePassword = vi.fn(),
      anchor = document.createElement('button')
    document.body.append(anchor)
    try {
      const view = renderPage(
        <WorkspaceHeader
          user={{ ...tutor, roles: ['tutor', 'admin'] }}
          admin={false}
          accountAnchor={anchor}
          onOpenAccount={vi.fn()}
          onCloseAccount={vi.fn()}
          onOpenNavigation={vi.fn()}
          onChangePassword={onChangePassword}
          onSignOut={onSignOut}
        />,
      )
      expect(screen.getByText(tutor.name)).toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'All programmes' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('menuitem', { name: 'Change password' }))
      expect(onChangePassword).toHaveBeenCalledOnce()
      expect(screen.getByRole('menuitem', { name: /Switch to/ })).toHaveAttribute(
        'href',
        '/admin/health',
      )
      await userEvent.click(screen.getByRole('menuitem', { name: 'Logout' }))
      expect(onSignOut).toHaveBeenCalledOnce()
      view.rerender(
        <WorkspaceHeader
          user={tutor}
          admin={false}
          accountAnchor={anchor}
          onOpenAccount={vi.fn()}
          onCloseAccount={vi.fn()}
          onOpenNavigation={vi.fn()}
          onChangePassword={onChangePassword}
          onSignOut={onSignOut}
        />,
      )
      expect(screen.queryByRole('menuitem', { name: /Switch to/ })).not.toBeInTheDocument()
    } finally {
      anchor.remove()
    }
  })
})
