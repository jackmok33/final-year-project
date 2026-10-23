// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/domSetup'
import { renderPage } from '../../test/renderPage'
import Loader from './Loader'

describe('Loader', () => {
  it('announces the supplied loading state once', () => {
    renderPage(<Loader label="Loading workspace" />)
    expect(screen.getAllByRole('progressbar')).toHaveLength(1)
    expect(screen.getByRole('progressbar', { name: 'Loading workspace' })).toBeInTheDocument()
  })
})
