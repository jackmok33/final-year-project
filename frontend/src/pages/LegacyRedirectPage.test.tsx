// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigationType,
  useParams,
} from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LegacyRedirectPage } from './LegacyRedirectPage'
import { intakeYearFromSegment } from '../app/paths'
import { detail, otherProgramme, programme } from '../test/fixtures'
import { apiMocks, queryResult, resetPageMocks, workspaceMock } from '../test/pageMocks'
import '../test/domSetup'

vi.mock('../app/api', async () => (await import('../test/pageMocks')).apiMocks)
vi.mock('../hooks/useWorkspace', async () => ({
  useWorkspace: (await import('../test/pageMocks')).workspaceMock,
}))

const base = '/programmes/programme-1/intakes/2026-27'
const batch = {
  id: 'batch-1',
  programmeId: programme.id,
  intakeYear: programme.year,
  sequence: 1,
  uploadedAt: '2026-10-10T09:00:00Z',
  filename: 'batch.zip',
  source: 'zip',
  applicantCount: 1,
  pendingReviewCount: 1,
}

function RouteState() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const { intake } = useParams()
  return (
    <>
      <p data-testid="destination">
        {location.pathname + location.search + location.hash} {navigationType}
      </p>
      <output data-testid="intake">{intakeYearFromSegment(intake)}</output>
    </>
  )
}

function renderBookmark(
  url: string,
  destination: Parameters<typeof LegacyRedirectPage>[0]['destination'],
  pattern: string,
) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={pattern} element={<LegacyRedirectPage destination={destination} />} />
        <Route path="/programmes/:programmeId/intakes/:intake/*" element={<RouteState />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(resetPageMocks)

describe('authorised legacy bookmark redirects', () => {
  it.each([
    ['/batches', 'workspace', '/batches', base],
    ['/criteria', 'workspace', '/criteria', `${base}?tab=criteria`],
    ['/applications', 'queue', '/applications', `${base}/applications`],
    ['/applications/new', 'new', '/applications/new', `${base}/applications/new`],
    ['/programmes/programme-1', 'programme', '/programmes/:programmeId', base],
  ] as const)(
    'resolves %s using the selected authorised programme and intake',
    async (url, destination, pattern, expected) => {
      renderBookmark(url, destination, pattern)
      expect(await screen.findByTestId('destination')).toHaveTextContent(`${expected} REPLACE`)
    },
  )

  it('uses an explicit authorised programme instead of the selected programme', async () => {
    renderBookmark(
      '/batches?programme=programme-2&intake=25%2F26&tab=analytics',
      'workspace',
      '/batches',
    )
    expect(await screen.findByTestId('destination')).toHaveTextContent(
      '/programmes/programme-2/intakes/2025-26?tab=analytics REPLACE',
    )
  })

  it('resolves an actual batch before redirecting batch queues and upload forms', async () => {
    apiMocks.useBatchQuery.mockReturnValue(queryResult(batch))
    const view = renderBookmark('/batches/batch-1?tab=batches', 'batch', '/batches/:batchId')
    expect(await screen.findByTestId('destination')).toHaveTextContent(
      `${base}/batches/batch-1?tab=batches REPLACE`,
    )
    view.unmount()
    renderBookmark('/applications/new?batch=batch-1', 'new', '/applications/new')
    expect(await screen.findByTestId('destination')).toHaveTextContent(
      `${base}/batches/batch-1/applications/new REPLACE`,
    )
  })

  it.each(['', '/evidence', '/correct', '/decision'])(
    'preserves the applicant suffix %s and exact bookmark query encoding',
    async (suffix) => {
      apiMocks.useApplicationQuery.mockReturnValue(
        queryResult({ ...detail, application: { ...detail.application, batchId: batch.id } }),
      )
      renderBookmark(
        `/applications/APP-TEST${suffix}?run=run%2f1&programme=programme-1&doc=APP%20PDF&page=2&tab=documents&correction=1&decision=1#bookmark`,
        'application',
        `/applications/:id${suffix}`,
      )
      expect(await screen.findByTestId('destination')).toHaveTextContent(
        `${base}/batches/batch-1/applications/APP-TEST${suffix}?run=run%2f1&doc=APP%20PDF&page=2&tab=documents&correction=1&decision=1#bookmark REPLACE`,
      )
    },
  )

  it('preserves descriptive saved years and does not decode literal percent sequences twice', async () => {
    const legacyYear = 'Historic %2F intake'
    apiMocks.useApplicationQuery.mockReturnValue(
      queryResult({ ...detail, application: { ...detail.application, intakeYear: legacyYear } }),
    )
    renderBookmark('/applications/APP-TEST', 'application', '/applications/:id')
    expect(await screen.findByTestId('destination')).toHaveTextContent(
      '/programmes/programme-1/intakes/~SGlzdG9yaWMgJTJGIGludGFrZQ/applications/APP-TEST REPLACE',
    )
    expect(screen.getByTestId('intake')).toHaveTextContent(legacyYear)
  })

  it.each([
    '/batches?programme=unknown',
    '/batches?programme=',
    '/batches?intake=',
    '/batches?intake=Unknown%20year',
    '/batches?batch=',
  ])('does not redirect the explicit unavailable scope %s to another queue', async (url) => {
    renderBookmark(url, 'workspace', '/batches')
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable')
    expect(screen.queryByTestId('destination')).not.toBeInTheDocument()
  })

  it('shows permission-checked query failures for unknown applications and batches', async () => {
    apiMocks.useApplicationQuery.mockReturnValue({
      ...queryResult(),
      error: { data: 'Application access denied.' },
    })
    const view = renderBookmark('/applications/secret', 'application', '/applications/:id')
    expect(await screen.findByRole('alert')).toHaveTextContent('Application access denied.')
    view.unmount()
    apiMocks.useBatchQuery.mockReturnValue({
      ...queryResult(),
      error: { data: 'Batch access denied.' },
    })
    renderBookmark('/batches/secret', 'batch', '/batches/:batchId')
    expect(await screen.findByRole('alert')).toHaveTextContent('Batch access denied.')
  })

  it('rejects a mismatching applicant identity or explicit ancestor without using stale data', async () => {
    const view = renderBookmark('/applications/other', 'application', '/applications/:id')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'requested application is unavailable',
    )
    view.unmount()
    renderBookmark(
      '/applications/APP-TEST?programme=programme-2',
      'application',
      '/applications/:id',
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('does not match this record')
  })

  it('does not accept a batch under another intake or an explicit different batch', async () => {
    apiMocks.useBatchQuery.mockReturnValue(queryResult(batch))
    const view = renderBookmark(
      '/batches/batch-1?intake=2025%20%2F%2026',
      'batch',
      '/batches/:batchId',
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('does not match this record')
    view.unmount()
    renderBookmark('/batches/batch-1?batch=other', 'batch', '/batches/:batchId')
    expect(await screen.findByRole('alert')).toHaveTextContent('does not match this record')
  })

  it('waits for fresh query data and an invalidated new programme list', async () => {
    apiMocks.useApplicationQuery.mockReturnValue({
      ...queryResult(),
      data: detail,
      isLoading: true,
    })
    const view = renderBookmark('/applications/APP-TEST', 'application', '/applications/:id')
    expect(await screen.findByText('Loading workspace…')).toBeInTheDocument()
    expect(screen.queryByTestId('destination')).not.toBeInTheDocument()
    view.unmount()
    workspaceMock.mockReturnValue({ ...workspaceMock(), isFetching: true })
    renderBookmark('/programmes/new-programme', 'programme', '/programmes/:programmeId')
    expect(await screen.findByText('Loading workspace…')).toBeInTheDocument()
  })

  it('keeps a genuinely unavailable explicit programme from falling back after refetch', async () => {
    workspaceMock.mockReturnValue({ ...workspaceMock(), isFetching: false })
    renderBookmark('/programmes/missing', 'programme', '/programmes/:programmeId')
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable')
    expect(screen.queryByTestId('destination')).not.toBeInTheDocument()
  })

  it('validates stored descriptive intake choices and ownership from the authorised workspace', async () => {
    apiMocks.useProgrammeIntakesQuery.mockReturnValue(
      queryResult([{ programmeId: otherProgramme.id, years: ['Legacy cohort'] }]),
    )
    renderBookmark('/batches?programme=programme-2&intake=Legacy%20cohort', 'workspace', '/batches')
    expect(await screen.findByTestId('destination')).toHaveTextContent(
      '/programmes/programme-2/intakes/~TGVnYWN5IGNvaG9ydA REPLACE',
    )
  })

  it('shows genuine workspace and intake-query failures without navigating', async () => {
    workspaceMock.mockReturnValue({ ...workspaceMock(), error: { data: 'Programme read failed.' } })
    const view = renderBookmark('/batches', 'workspace', '/batches')
    expect(await screen.findByRole('alert')).toHaveTextContent('Programme read failed.')
    view.unmount()
    resetPageMocks()
    apiMocks.useProgrammeIntakesQuery.mockReturnValue({
      ...queryResult(),
      error: { data: 'Intake read failed.' },
    })
    renderBookmark('/batches', 'workspace', '/batches')
    expect(await screen.findByRole('alert')).toHaveTextContent('Intake read failed.')
  })

  it('distinguishes an empty workspace from an explicitly unavailable programme', async () => {
    workspaceMock.mockReturnValue({ ...workspaceMock(), programme: undefined, programmes: [] })
    const view = renderBookmark('/batches', 'workspace', '/batches')
    expect(await screen.findByRole('alert')).toHaveTextContent('No programme is available.')
    view.unmount()
    renderBookmark('/batches?programme=missing', 'workspace', '/batches')
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable')
  })

  it('does not redirect a programme whose ownership no longer belongs to the active tutor', async () => {
    workspaceMock.mockReturnValue({
      ...workspaceMock(),
      programmes: [{ ...programme, createdBy: 'another-tutor' }],
    })
    renderBookmark('/batches', 'workspace', '/batches')
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable')
    expect(screen.queryByTestId('destination')).not.toBeInTheDocument()
  })

  it('removes encoded scope keys while preserving other query bytes and existing criteria tabs', async () => {
    renderBookmark(
      '/criteria?%70rogramme=programme-1&tab=analytics&%ZZ=raw%20value',
      'workspace',
      '/criteria',
    )
    expect(await screen.findByTestId('destination')).toHaveTextContent(
      `${base}?tab=analytics&%ZZ=raw%20value REPLACE`,
    )
  })
})
