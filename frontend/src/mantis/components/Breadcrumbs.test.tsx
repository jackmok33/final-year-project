// @vitest-environment jsdom
import { ThemeProvider } from '@mui/material'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { theme } from '../../app/theme'
import '../../test/domSetup'
import Breadcrumbs from './Breadcrumbs'

describe('Mantis heading breadcrumbs', () => {
  it('keeps the complete supplied hierarchy linked with one current page heading', () => {
    const links = [
      { title: 'Programme', to: '/modules' },
      { title: 'CSML 26/27', to: '/batches?programme=csml&intake=2026' },
      { title: 'Batch 1', to: '/batches/batch-1' },
      { title: '1 - Carson', to: '/applications/app-1?tab=documents' },
    ]
    render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <Breadcrumbs links={links} label="Applicant location" />
        </ThemeProvider>
      </MemoryRouter>,
    )
    const navigation = screen.getByRole('navigation', { name: 'Applicant location' })
    expect(within(navigation).getAllByRole('link')).toHaveLength(links.length)
    for (const [index, link] of links.entries()) {
      const item = within(navigation).getByRole('link', { name: link.title })
      expect(item).toHaveAttribute('href', link.to)
      if (index === links.length - 1) expect(item).toHaveAttribute('aria-current', 'page')
      else expect(item).not.toHaveAttribute('aria-current')
    }
    const heading = screen.getByRole('heading', { level: 1, name: '1 - Carson' })
    expect(within(heading).getByRole('link', { name: '1 - Carson' })).toBeVisible()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(within(navigation).getAllByText('/')).toHaveLength(3)
  })

  it('allows keyboard activation of ancestors and the current segment', async () => {
    function Destination() {
      const location = useLocation()
      return <output aria-label="Destination">{location.pathname + location.search}</output>
    }
    render(
      <MemoryRouter initialEntries={['/applications/app-1?tab=flags']}>
        <Breadcrumbs
          label="Applicant location"
          links={[
            { title: 'Programme', to: '/modules' },
            { title: '1 - Carson', to: '/applications/app-1?tab=documents' },
          ]}
        />
        <Destination />
      </MemoryRouter>,
    )
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Programme' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByLabelText('Destination')).toHaveTextContent('/modules')
    await userEvent.tab()
    expect(screen.getByRole('link', { name: '1 - Carson' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByLabelText('Destination')).toHaveTextContent(
      '/applications/app-1?tab=documents',
    )
  })

  it('uses the supplied default collapse behaviour for long hierarchies', async () => {
    const links = Array.from({ length: 10 }, (_, index) => ({
      title: `A long programme or applicant label ${index}`,
      to: `/location/${index}`,
    }))
    render(
      <MemoryRouter>
        <Breadcrumbs label="Complete location" links={links} />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('link')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Show path' }))
    expect(screen.getAllByRole('link')).toHaveLength(10)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(links[9].title)
  })
})
