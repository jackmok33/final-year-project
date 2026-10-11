// @vitest-environment jsdom
import './test/domSetup'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'
import { apiMocks, queryResult, resetPageMocks } from './test/pageMocks'
import { administrator } from './test/fixtures'
vi.mock('./app/api', async () => (await import('./test/pageMocks')).apiMocks)
vi.mock('./app/store', async () => (await import('./test/pageMocks')).storeMocks)
vi.mock('./app/workspace', async () => ({
  useWorkspace: (await import('./test/pageMocks')).workspaceMock,
}))
vi.mock('./components/evidence/PdfViewer', () => ({ PdfViewer: () => <p>Original PDF viewer</p> }))
beforeEach(resetPageMocks)
describe('routed screens and lazy imports', () => {
  it.each([
    ['/login', 'Sign in'],
    ['/applications', 'Applications'],
    ['/applications/new', 'New application'],
    ['/applications/APP-TEST', 'APP-TEST'],
    ['/applications/APP-TEST/evidence', 'Source evidence'],
    ['/applications/APP-TEST/correct', 'Correct extracted fact'],
    ['/applications/APP-TEST/decision', 'Record tutor decision'],
    ['/criteria', 'Admission criteria'],
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
    expect(
      await screen.findByRole('heading', { name: title, level: url === '/login' ? 2 : 1 }),
    ).toBeInTheDocument()
  })
  it.each(['/', '/unknown-path'])('returns %s to the authorised queue', async (url) => {
    render(
      <MemoryRouter initialEntries={[url]}>
        <App />
      </MemoryRouter>,
    )
    expect(
      await screen.findByRole('heading', { name: 'Applications', level: 1 }),
    ).toBeInTheDocument()
  })
  it('does not let an admin-only session open applicant routes', async () => {
    apiMocks.useMeQuery.mockReturnValue(queryResult(administrator))
    render(
      <MemoryRouter initialEntries={['/applications/APP-TEST']}>
        <App />
      </MemoryRouter>,
    )
    expect(
      await screen.findByRole('heading', { name: 'Service health', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'APP-TEST' })).not.toBeInTheDocument()
  })
})
