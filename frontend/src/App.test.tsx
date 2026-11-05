// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import './test/domSetup'
import { administrator, detail, programme } from './test/fixtures'
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
    ['/programmes', 'Programme'],
    ['/programmes/programme-1', 'CSML 26/27'],
    ['/programmes/programme-1/intakes/2026-27', 'CSML 26/27'],
    ['/programmes/programme-1/intakes/2026-27/applications', 'Applicants'],
    ['/programmes/programme-1/intakes/2026-27/applications/new', 'New application'],
    ['/programmes/programme-1/intakes/2026-27/applications/APP-TEST', '1 - SYN-TEST'],
    ['/programmes/programme-1/intakes/2026-27/applications/APP-TEST/evidence', '1 - SYN-TEST'],
    ['/programmes/programme-1/intakes/2026-27/applications/APP-TEST/correct', 'CSML 26/27'],
    ['/programmes/programme-1/intakes/2026-27/applications/APP-TEST/decision', 'CSML 26/27'],
    ['/applications', 'Applicants'],
    ['/batches', 'CSML 26/27'],
    ['/applications/new', 'New application'],
    ['/applications/APP-TEST', '1 - SYN-TEST'],
    ['/applications/APP-TEST/evidence', '1 - SYN-TEST'],
    ['/applications/APP-TEST/correct', 'CSML 26/27'],
    ['/applications/APP-TEST/decision', 'CSML 26/27'],
    ['/criteria', 'CSML 26/27'],
    ['/admin/health', 'Service health'],
    ['/admin/users', 'Users'],
    ['/admin/programme', 'Users'],
    ['/admin/data', 'Users'],
    ['/admin/backup', 'Users'],
    ['/admin', 'Users'],
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
  it.each([
    '',
    '/applications/new',
    '/applications/APP-TEST',
    '/applications/APP-TEST/evidence',
    '/applications/APP-TEST/correct',
    '/applications/APP-TEST/decision',
  ])('loads a nested batch route %s through the tutor guard', async (suffix) => {
    apiMocks.useBatchQuery.mockReturnValue(
      queryResult({
        id: 'batch-1',
        programmeId: programme.id,
        intakeYear: programme.year,
        sequence: 1,
        applicantCount: 1,
        pendingReviewCount: 1,
        uploadedAt: '2026-10-10T09:00:00Z',
        filename: 'batch.zip',
        source: 'zip',
      }),
    )
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({
        ...detail,
        application: { ...detail.application, batchId: 'batch-1' },
      }),
    )
    render(
      <MemoryRouter
        initialEntries={[`/programmes/programme-1/intakes/2026-27/batches/batch-1${suffix}`]}
      >
        <App />
      </MemoryRouter>,
    )
    if (suffix.endsWith('/correct')) {
      expect(
        await screen.findByRole('dialog', { name: 'Correct extracted fact' }),
      ).toBeInTheDocument()
    } else if (suffix.endsWith('/decision')) {
      expect(await screen.findByRole('dialog', { name: 'Record decision' })).toBeInTheDocument()
    } else {
      expect(
        await screen.findByRole('heading', {
          name:
            suffix === '/applications/new'
              ? 'New application'
              : suffix
                ? '1 - SYN-TEST'
                : 'Batch 1',
          level: 1,
        }),
      ).toBeInTheDocument()
    }
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
  it.each([
    '/applications/APP-TEST',
    '/batches',
    '/batches/secret',
    '/programmes/programme-1/intakes/2026-27/applications/APP-TEST',
    '/programmes/programme-1/intakes/2026-27/batches/batch-1',
  ])('does not let an admin-only session open %s', async (url) => {
    apiMocks.useMeQuery.mockReturnValue(queryResult(administrator))
    render(
      <MemoryRouter initialEntries={[url]}>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Users', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'APP-TEST' })).not.toBeInTheDocument()
  })
  it.each([
    '/programmes/programme-2/intakes/2026-27/applications/APP-TEST',
    '/programmes/programme-1/intakes/2025-26/applications/APP-TEST',
    '/programmes/programme-1/intakes/2026-27/batches/other/applications/APP-TEST',
  ])('rejects a canonical applicant bookmark with mismatching ancestors: %s', async (url) => {
    render(
      <MemoryRouter initialEntries={[url]}>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable')
    expect(
      screen.queryByRole('heading', { name: '1 - SYN-TEST', level: 1 }),
    ).not.toBeInTheDocument()
  })
  it('keeps the backend health screen behind the administrator guard', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/health']}>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Programme', level: 1 })).toBeInTheDocument()
    expect(apiMocks.useBackendHealthQuery).not.toHaveBeenCalled()
  })
})
