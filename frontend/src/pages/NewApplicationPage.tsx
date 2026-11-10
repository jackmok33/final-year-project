import { Alert } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCommandMutation, useBatchQuery, useProgrammeIntakesQuery } from '../app/api'
import {
  applicationPath,
  batchPath,
  intakePath,
  intakeYearFromSegment,
  matchesRouteScope,
  newApplicationPath,
  PROGRAMMES_PATH,
} from '../app/paths'
import { useWorkspace } from '../hooks/useWorkspace'
import {
  NewApplicationForm,
  type SelectedDocuments,
} from '../components/applications/NewApplicationForm'
import { ErrorNotice, Loading, Page } from '../components/common'
import { documentTypes, type DocumentType, type Programme, type User } from '../domain/types'
import { isWithinApplicationPageLimit } from '../domain/documentLimits'
import { programmeIntakeLabel } from '../domain/programmeDisplay'
import { intakeYears, normalizeIntakeYear } from '../domain/intakes'
import { useContent } from '../hooks/useContent'
import { useIsMounted } from '../hooks/useIsMounted'
import { releaseUploads, stageUploads } from '../services/fileStaging'

export function NewApplicationPage() {
  const content = useContent('newApplicationPage')
  const {
    user,
    programme: selectedProgramme,
    programmes = [],
    intakeYear: selectedIntakeYear,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace()
  const routeParams = useParams()
  const [params] = useSearchParams()
  const batchId = routeParams.programmeId ? routeParams.batchId : params.get('batch')
  const programmeId = routeParams.programmeId ?? params.get('programme')
  const routeIntakeYear = intakeYearFromSegment(
    routeParams.intake ?? params.get('intake') ?? undefined,
  )
  const batchQuery = useBatchQuery(batchId ?? '', { skip: !batchId })
  const batch = batchId ? batchQuery.currentData : undefined
  const programme = programmeId
    ? programmes.find((p) => p.id === programmeId)
    : batchId
      ? programmes.find((p) => p.id === batch?.programmeId)
      : selectedProgramme
  const intakeYear = batch?.intakeYear ?? routeIntakeYear ?? selectedIntakeYear
  const intakes = useProgrammeIntakesQuery(undefined, { skip: !programme || Boolean(batchId) })
  if (workspaceLoading || (batchId && batchQuery.isLoading)) return <Loading />
  if (batchId && (batchQuery.error || !batch || !programme))
    return <ErrorNotice error={batchQuery.error ?? content.batchUnavailable} />
  if (workspaceError) return <ErrorNotice error={workspaceError} />
  if (programmeId && !programme) return <ErrorNotice error={content.workspaceUnavailable} />
  if (!programme) return <Alert severity="info">{content.noWorkspaceMessage}</Alert>
  const year = normalizeIntakeYear(intakeYear ?? programme.year) ?? intakeYear ?? programme.year
  const scope = { programmeId: programme.id, intakeYear: year, batchId: batchId ?? undefined }
  if (
    !matchesRouteScope(routeParams, scope) ||
    (batch && (batch.id !== batchId || batch.programmeId !== programme.id)) ||
    (routeIntakeYear !== undefined && routeIntakeYear !== year)
  )
    return <ErrorNotice error={content.batchUnavailable} />
  if (!batchId && !normalizeIntakeYear(year)) {
    const knownYears =
      intakes.currentData?.find((row) => row.programmeId === programme.id)?.years ??
      intakeYears(programme, [])
    if (!knownYears.includes(year)) {
      if (intakes.isLoading || intakes.isFetching) return <Loading />
      return <ErrorNotice error={intakes.error ?? content.workspaceUnavailable} />
    }
  }
  return (
    <NewApplicationEditor
      key={`${user?.id}:${programme.id}:${year}:${batchId ?? ''}`}
      user={user}
      programme={programme}
      intakeYear={year}
      batchId={batchId ?? undefined}
      batchSequence={batch?.sequence}
    />
  )
}

// A different account, programme, intake or batch starts a fresh upload draft.
function NewApplicationEditor({
  user,
  programme,
  intakeYear,
  batchId,
  batchSequence,
}: {
  user?: User
  programme: Programme
  intakeYear: string
  batchId?: string
  batchSequence?: number
}) {
  const content = useContent('newApplicationPage')
  const [candidate, setCandidate] = useState('')
  const [files, setFiles] = useState<SelectedDocuments>({})
  const [validationError, setValidationError] = useState('')
  const [checking, setChecking] = useState<DocumentType | null>(null)
  const [command, { isLoading, error }] = useCommandMutation()
  const navigate = useNavigate()
  const isMounted = useIsMounted()
  async function select(type: DocumentType, selected: File[]) {
    if (!selected.length || checking || isLoading) return
    setValidationError('')
    setChecking(type)
    try {
      const { inspectPdf } = await import('../services/pdf')
      const inspected: { file: File; pages: number }[] = []
      for (const file of selected) inspected.push({ file, pages: (await inspectPdf(file)).pages })
      if (isMounted())
        setFiles((previous) => ({
          ...previous,
          [type]: type === 'reference' ? [...(previous[type] ?? []), ...inspected] : inspected,
        }))
    } catch (error) {
      if (isMounted()) {
        if (type !== 'reference') remove(type, 0)
        setValidationError(error instanceof Error ? error.message : content.unableToReadPdf)
      }
    } finally {
      if (isMounted()) setChecking(null)
    }
  }
  const total = Object.values(files)
    .flat()
    .reduce((n, file) => n + file.pages, 0)
  const ownsProgramme = Boolean(
    user?.active && user.roles.includes('tutor') && programme.createdBy === user.id,
  )
  const disabled =
    isLoading ||
    !!checking ||
    !candidate.trim() ||
    !Object.keys(files).length ||
    !isWithinApplicationPageLimit(total) ||
    !ownsProgramme
  function remove(type: DocumentType, index: number) {
    setFiles((previous) => {
      const next = { ...previous }
      const remaining = (next[type] ?? []).filter((_, i) => i !== index)
      if (remaining.length) next[type] = remaining
      else delete next[type]
      return next
    })
  }
  async function submit() {
    if (disabled) return
    const refs = stageUploads(
      documentTypes.flatMap((type) => (files[type] ?? []).map(({ file }) => ({ type, file }))),
    )
    try {
      const result = await command({
        op: 'create',
        ...(batchId ? { batchId } : {}),
        candidate,
        programmeId: programme.id,
        intakeYear,
        uploads: refs,
      }).unwrap()
      if (isMounted() && result.id)
        navigate(
          applicationPath({
            programmeId: programme.id,
            intakeYear,
            batchId: result.batchId ?? batchId,
            applicationId: result.id,
          }),
        )
    } catch {
      /* RTK Query presents the error. */
    } finally {
      releaseUploads(refs)
    }
  }
  const scope = { programmeId: programme.id, intakeYear, batchId }
  const breadcrumbs = [
    { title: content.programme, to: PROGRAMMES_PATH },
    { title: programmeIntakeLabel(programme, intakeYear), to: intakePath(scope) },
    ...(batchId && batchSequence
      ? [{ title: content.batchName(batchSequence), to: batchPath({ ...scope, batchId }) }]
      : []),
    { title: content.newApplication, to: newApplicationPath(scope) },
  ]
  return (
    <Page title={content.newApplication} subtitle={content.subtitle} breadcrumbs={breadcrumbs}>
      <NewApplicationForm
        programme={{ ...programme, year: intakeYear }}
        candidate={candidate}
        setCandidate={setCandidate}
        files={files}
        remove={remove}
        validationError={validationError}
        checking={checking}
        isLoading={isLoading}
        error={error}
        select={select}
        total={total}
        submit={submit}
        disabled={disabled}
      />
    </Page>
  )
}
