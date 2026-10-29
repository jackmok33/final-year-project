// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import './test/domSetup'
import { administrator } from './test/fixtures'
import { apiMocks, queryResult, resetPageMocks } from './test/pageMocks'
vi.mock('./app/api', async () => (await import('./test/pageMocks')).apiMocks)
vi.mock('./app/store', async () => (await import('./test/pageMocks')).storeMocks)
vi.mock('./hooks/redux', async () => (await import('./test/pageMocks')).reduxMocks)
vi.mock('./hooks/useWorkspace', async () => ({
  useWorkspace: (await import('./test/pageMocks')).workspaceMock,
}))
vi.mock('./components/evidence/PdfViewer', () => ({ PdfViewer: () => <p>Original PDF viewer</p> }))
beforeEach(resetPageMocks)
describe('routed screens and lazy imports', () => {
  it.each([
    ['/login', 'Sign in'],
    ['/modules', 'Programme'],
    ['/applications', 'CSML 26/27'],
    ['/batches', 'CSML 26/27'],
    ['/applications/new', 'New application'],
    ['/applications/APP-TEST', 'CSML 26/27'],
    ['/applications/APP-TEST/evidence', 'CSML 26/27'],
    ['/applications/APP-TEST/correct', 'CSML 26/27'],
    ['/applications/APP-TEST/decision', 'CSML 26/27'],
    ['/criteria', 'CSML 26/27'],
    ['/admin/health', 'Service health'],
    ['/admin/users', 'Users & access'],
    ['/admin/programme', 'Programme settings'],
    ['/admin/data', 'Data operations'],
  ])('loads %s through the appropriate guard', async (url, title) => {
    if (url.startsWith('/admin')) apiMocks.useMeQuery.mockReturnValue(queryResult(administrator))
    render(
      <MemoryRouter initialEntries={[url]}>
        <App />
      </MemoryRouter>,
    )
    if (url.endsWith('/correct')) {
      expect(
        await screen.findByRole('dialog', { name: 'Correct extracted fact' }),
      ).toBeInTheDocument()
      expect(screen.getByText('Review flag').closest('[role=tab]')).toHaveAttribute(
        'aria-selected',
        'true',
      )
      return
    }
    if (url.endsWith('/decision')) {
      expect(await screen.findByRole('dialog', { name: 'Record decision' })).toBeInTheDocument()
      return
    }
    expect(
      await screen.findByRole('heading', { name: title, level: url === '/login' ? 2 : 1 }),
    ).toBeInTheDocument()
  })
  it.each(['/', '/unknown-path', '/modules/programme-1'])(
    'returns %s to the module landing page',
    async (url) => {
      render(
        <MemoryRouter initialEntries={[url]}>
          <App />
        </MemoryRouter>,
      )
      expect(
        await screen.findByRole('heading', { name: 'Programme', level: 1 }),
      ).toBeInTheDocument()
    },
  )
  it.each(['/applications/APP-TEST', '/batches', '/batches/secret'])(
    'does not let an admin-only session open %s',
    async (url) => {
      apiMocks.useMeQuery.mockReturnValue(queryResult(administrator))
      render(
        <MemoryRouter initialEntries={[url]}>
          <App />
        </MemoryRouter>,
      )
      expect(
        await screen.findByRole('heading', { name: 'Service health', level: 1 }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'APP-TEST' })).not.toBeInTheDocument()
    },
  )
})
