import { describe, expect, it } from 'vitest'
import { matchRoutes } from 'react-router-dom'
import {
  applicationPath,
  applicationsPath,
  batchPath,
  intakePath,
  intakeYearFromSegment,
  matchesRouteScope,
  newApplicationPath,
  programmePath,
  PROGRAMMES_PATH,
} from './paths'

const scope = { programmeId: 'programme-1', intakeYear: '2026 / 27' }
const base = '/programmes/programme-1/intakes/2026-27'

describe('programme, intake, batch and applicant paths', () => {
  it('builds stable numeric intake paths and keeps unbatched queues available', () => {
    expect(PROGRAMMES_PATH).toBe('/programmes')
    expect(programmePath('programme-1')).toBe('/programmes/programme-1')
    expect(programmePath('id/a')).toBe('/programmes/id%2Fa')
    expect(intakePath(scope)).toBe(base)
    expect(intakePath({ ...scope, intakeYear: '26/2027' })).toBe(base)
    expect(applicationsPath(scope)).toBe(`${base}/applications`)
    expect(newApplicationPath(scope)).toBe(`${base}/applications/new`)
    expect(applicationPath({ ...scope, applicationId: 'APP-1' })).toBe(`${base}/applications/APP-1`)
  })

  it('places batch applicants and uploads underneath their actual batch', () => {
    const batch = { ...scope, batchId: 'batch-1' }
    expect(batchPath(batch)).toBe(`${base}/batches/batch-1`)
    expect(applicationsPath(batch)).toBe(`${base}/batches/batch-1`)
    expect(newApplicationPath(batch)).toBe(`${base}/batches/batch-1/applications/new`)
    expect(applicationPath({ ...batch, applicationId: 'APP-1' })).toBe(
      `${base}/batches/batch-1/applications/APP-1`,
    )
  })

  it('encodes identifiers and descriptive legacy years without interpreting their contents', () => {
    const special = {
      programmeId: 'course/with ?#%',
      intakeYear: 'Legacy / 100% cohort',
      batchId: 'batch/a',
      applicationId: 'APP/1 ?',
    }
    expect(intakePath(special)).toBe(
      '/programmes/course%2Fwith%20%3F%23%25/intakes/~TGVnYWN5IC8gMTAwJSBjb2hvcnQ',
    )
    expect(applicationPath(special)).toBe(
      `${intakePath(special)}/batches/batch%2Fa/applications/APP%2F1%20%3F`,
    )
    expect(intakeYearFromSegment('Legacy / 100% cohort')).toBe(special.intakeYear)
    expect(intakeYearFromSegment('Saved %2F year')).toBe('Saved %2F year')
  })

  it('reads Router-decoded numeric segments and retains descriptive or missing values', () => {
    expect(intakeYearFromSegment('2026-27')).toBe('2026 / 27')
    expect(intakeYearFromSegment('26/27')).toBe('2026 / 27')
    expect(intakeYearFromSegment('Historical intake')).toBe('Historical intake')
    expect(intakeYearFromSegment(undefined)).toBeUndefined()
  })

  it.each([
    'Legacy %2F cohort',
    'Legacy / cohort',
    '歷史年度 / café 🎓',
    '~',
    '~YWJj',
    '.',
    '..',
    '2026-27',
    '\uFEFFLegacy cohort',
  ])('round-trips the exact descriptive label through real Router matching: %s', (intakeYear) => {
    const actual = { ...scope, intakeYear }
    const path = intakePath(actual)
    expect(path).toMatch(/\/intakes\/~[A-Za-z0-9_-]+$/)
    expect(new URL(path, 'https://example.test').pathname).toBe(path)
    const params = matchRoutes([{ path: '/programmes/:programmeId/intakes/:intake' }], path)?.[0]
      .params
    expect(params).toBeDefined()
    expect(intakeYearFromSegment(params?.intake)).toBe(intakeYear)
    expect(matchesRouteScope(params!, actual)).toBe(true)
  })

  it.each(['~', '~a', '~_w', '~TGVnYWN5=', '~TGVnYWN5IB', '~invalid*segment'])(
    'rejects invalid reserved intake encodings without matching a selected-year fallback: %s',
    (segment) => {
      expect(intakeYearFromSegment(segment)).toBeUndefined()
      const params = matchRoutes(
        [{ path: '/programmes/:programmeId/intakes/:intake' }],
        `/programmes/programme-1/intakes/${segment}`,
      )?.[0].params
      expect(matchesRouteScope(params!, scope)).toBe(false)
    },
  )

  it('rejects every mismatching canonical ancestor, including a missing batch', () => {
    const params = { programmeId: scope.programmeId, intake: '2026-27', batchId: 'batch-1' }
    const actual = { ...scope, batchId: 'batch-1' }
    expect(matchesRouteScope(params, actual)).toBe(true)
    expect(matchesRouteScope({ ...params, programmeId: 'other' }, actual)).toBe(false)
    expect(matchesRouteScope({ ...params, intake: '2025-26' }, actual)).toBe(false)
    expect(matchesRouteScope({ ...params, batchId: 'other' }, actual)).toBe(false)
    expect(matchesRouteScope({ ...params, batchId: undefined }, actual)).toBe(false)
    expect(matchesRouteScope(params, scope)).toBe(false)
    expect(matchesRouteScope({ programmeId: scope.programmeId, intake: '2026-27' }, scope)).toBe(
      true,
    )
    expect(
      matchesRouteScope(
        { programmeId: scope.programmeId, intake: 'Historic %2F year' },
        { ...scope, intakeYear: 'Historic %2F year' },
      ),
    ).toBe(true)
    expect(matchesRouteScope({}, actual)).toBe(true)
  })
})
