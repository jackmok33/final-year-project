import { Alert } from '@mui/material'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useApplicationQuery, useBatchQuery, useProgrammeIntakesQuery } from '../app/api'
import {
  applicationPath,
  applicationsPath,
  batchPath,
  intakePath,
  newApplicationPath,
} from '../app/paths'
import { ErrorNotice, Loading } from '../components/common'
import { applicationIntakeYear, intakeYears, normalizeIntakeYear } from '../domain/intakes'
import { useContent } from '../hooks/useContent'
import { useWorkspace } from '../hooks/useWorkspace'

type LegacyDestination = 'programme' | 'workspace' | 'queue' | 'new' | 'batch' | 'application'

/** Resolve saved bookmarks through authorised reads before constructing their new ancestry. */
export function LegacyRedirectPage({ destination }: { destination: LegacyDestination }) {
  const content = useContent('legacyRedirectPage')
  const workspace = useWorkspace()
  const { id, batchId: routeBatchId, programmeId: routeProgrammeId } = useParams()
  const location = useLocation()
  const [params] = useSearchParams()
  const explicitProgramme = params.get('programme')
  const requestedProgramme = routeProgrammeId ?? explicitProgramme
  const explicitIntake = params.get('intake')
  const explicitBatch = params.get('batch')
  const applicationQuery = useApplicationQuery(id ?? '', {
    skip: destination !== 'application' || !id,
  })
  const application =
    destination === 'application' ? applicationQuery.currentData?.application : undefined
  const batchId = destination === 'batch' ? routeBatchId : (explicitBatch ?? undefined)
  const batchQuery = useBatchQuery(batchId ?? '', { skip: !batchId })
  const batch = batchId ? batchQuery.currentData : undefined
  const needsIntakes = destination !== 'application' && !batchId
  const intakesQuery = useProgrammeIntakesQuery(undefined, { skip: !needsIntakes })
  const programmeId =
    application?.programmeId ?? batch?.programmeId ?? requestedProgramme ?? workspace.programme?.id
  const programme = workspace.programmes.find((item) => item.id === programmeId)

  if (
    workspace.isLoading ||
    (destination === 'application' && applicationQuery.isLoading) ||
    (batchId && batchQuery.isLoading) ||
    (needsIntakes && intakesQuery.isLoading) ||
    (!programme && workspace.isFetching)
  )
    return <Loading />
  if (workspace.error) return <ErrorNotice error={workspace.error} />
  if (
    destination === 'application' &&
    (!application || application.id !== id || applicationQuery.error)
  )
    return <ErrorNotice error={applicationQuery.error ?? content.applicationUnavailable} />
  if (batchId && (!batch || batch.id !== batchId || batchQuery.error))
    return <ErrorNotice error={batchQuery.error ?? content.batchUnavailable} />
  if (needsIntakes && intakesQuery.error) return <ErrorNotice error={intakesQuery.error} />
  if (
    (params.has('programme') && !explicitProgramme) ||
    (params.has('intake') && !explicitIntake) ||
    (params.has('batch') && !explicitBatch) ||
    (explicitProgramme !== null && explicitProgramme !== programmeId) ||
    (destination === 'batch' && explicitBatch !== null && explicitBatch !== routeBatchId) ||
    (application && explicitBatch !== null && application.batchId !== explicitBatch)
  )
    return <ErrorNotice error={content.scopeUnavailable} />
  if (!programme) {
    if (requestedProgramme !== null || application || batch)
      return <ErrorNotice error={content.scopeUnavailable} />
    return <Alert severity="info">{content.noProgramme}</Alert>
  }
  if (
    !workspace.user?.active ||
    !workspace.user.roles.includes('tutor') ||
    programme.createdBy !== workspace.user.id
  )
    return <ErrorNotice error={content.scopeUnavailable} />

  const recordYear = application ? applicationIntakeYear(application, programme) : batch?.intakeYear
  const requestedYear =
    explicitIntake === null ? undefined : (normalizeIntakeYear(explicitIntake) ?? explicitIntake)
  const selectedYear = programme.id === workspace.programme?.id ? workspace.intakeYear : undefined
  const intakeYear = recordYear ?? requestedYear ?? selectedYear ?? programme.year
  const normalizedYear = normalizeIntakeYear(intakeYear) ?? intakeYear
  const availableYears =
    intakesQuery.currentData?.find((row) => row.programmeId === programme.id)?.years ??
    intakeYears(programme, [])
  if (
    (requestedYear !== undefined && requestedYear !== normalizedYear) ||
    (!recordYear &&
      !availableYears.some((year) => (normalizeIntakeYear(year) ?? year) === normalizedYear))
  )
    return <ErrorNotice error={content.scopeUnavailable} />

  const scope = {
    programmeId: programme.id,
    intakeYear: normalizedYear,
    batchId: application?.batchId ?? batch?.id,
  }
  let pathname: string
  switch (destination) {
    case 'application': {
      const suffix =
        ['/evidence', '/correct', '/decision'].find((value) => location.pathname.endsWith(value)) ??
        ''
      pathname = applicationPath({ ...scope, applicationId: application!.id }) + suffix
      break
    }
    case 'batch':
      pathname = batchPath({ ...scope, batchId: batch!.id })
      break
    case 'new':
      pathname = newApplicationPath(scope)
      break
    case 'queue':
      pathname = applicationsPath(scope)
      break
    case 'programme':
    case 'workspace':
      pathname = intakePath(scope)
      break
  }
  // Keep bookmark values and their original encoding; only obsolete scope keys are removed.
  const remaining = location.search
    .slice(1)
    .split('&')
    .filter((part) => {
      const name = part.split('=')[0]
      try {
        return !['programme', 'intake', 'batch'].includes(
          decodeURIComponent(name.replace(/\+/g, ' ')),
        )
      } catch {
        return true
      }
    })
    .filter(Boolean)
  if (location.pathname === '/criteria' && !params.has('tab')) remaining.push('tab=criteria')
  const search = remaining.length ? `?${remaining.join('&')}` : ''
  return <Navigate to={{ pathname, search, hash: location.hash }} replace />
}
