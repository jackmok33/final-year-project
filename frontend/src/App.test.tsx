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
    ['/modules', 'Courses'],
    ['/modules/programme-1', 'Computational Statistics and Machine Learning MSc'],
    ['/applications', 'Applications'],
    ['/batches', 'Upload batches'],
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
  it.each(['/', '/unknown-path'])('returns %s to the module landing page', async (url) => {
    render(
      <MemoryRouter initialEntries={[url]}>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Courses', level: 1 })).toBeInTheDocument()
  })
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
