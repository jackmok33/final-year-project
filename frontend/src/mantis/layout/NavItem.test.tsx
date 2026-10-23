// @vitest-environment jsdom
import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../app/theme'
import '../../test/domSetup'
import NavItem from './NavItem'
describe('NavItem', () => {
  function Location() {
    return <output>{useLocation().pathname}</output>
  }
  it('keeps selected course links operable by keyboard with React Router', async () => {
    const onClick = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/modules']}>
          <NavItem
            label="Machine Learning MSc"
            to="/modules/course-2"
            icon={<span aria-hidden="true">→</span>}
            selected
            ariaLabel="Open course Machine Learning MSc"
            onClick={onClick}
          />
          <Location />
        </MemoryRouter>
      </ThemeProvider>,
    )
    const link = screen.getByRole('link', { name: 'Open course Machine Learning MSc' })
    expect(link).toHaveAttribute('aria-current', 'page')
    await userEvent.tab()
    expect(link).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('/modules/course-2')
  })
})
