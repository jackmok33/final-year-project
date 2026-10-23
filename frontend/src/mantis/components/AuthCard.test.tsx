// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import AuthCard from './AuthCard'

describe('AuthCard', () => {
  it('preserves form controls and supplied accessible container props', () => {
    renderPage(
      <AuthCard id="sign-in-card">
        <label>
          Email
          <input type="email" />
        </label>
      </AuthCard>,
    )
    expect(document.getElementById('sign-in-card')).toContainElement(
      screen.getByRole('textbox', { name: 'Email' }),
    )
  })
})
