// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import { SignInIntro } from './SignInIntro'

describe('SignInIntro', () => {
  it('provides one workspace heading alongside the UCL logo', () => {
    renderPage(<SignInIntro />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Application Review Workspace',
    )
    expect(screen.getByRole('img', { name: 'UCL' })).toBeInTheDocument()
  })
})
