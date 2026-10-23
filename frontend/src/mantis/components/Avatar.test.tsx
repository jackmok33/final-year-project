// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import Avatar from './Avatar'

describe('Avatar', () => {
  it('keeps a decorative account initial hidden and filters template-only props', () => {
    renderPage(
      <Avatar size="sm" type="combined" aria-hidden="true">
        J
      </Avatar>,
    )
    const avatar = screen.getByText('J').closest('.MuiAvatar-root')
    expect(avatar).toHaveAttribute('aria-hidden', 'true')
    expect(avatar).not.toHaveAttribute('type')
    expect(avatar).not.toHaveAttribute('size')
  })
})
