import { Alert } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCommandMutation, useBatchQuery } from '../app/api'
import { useWorkspace } from '../hooks/useWorkspace'
import {
  NewApplicationForm,
  type SelectedDocuments,
} from '../components/applications/NewApplicationForm'
import { ErrorNotice, Loading } from '../components/common'
import type { DocumentType, Programme, User } from '../domain/types'
import { isWithinApplicationPageLimit } from '../domain/documentLimits'
import { useContent } from '../hooks/useContent'
import { useIsMounted } from '../hooks/useIsMounted'
import { releaseUploads, stageUploads } from '../services/fileStaging'

export function NewApplicationPage() {
  const content = useContent('newApplicationPage')
  const {
    user,
    programme: selectedProgramme,
    programmes,
    intakeYear: selectedIntakeYear,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace()
  const [params] = useSearchParams()
  const batchId = params.get('batch')
  const batchQuery = useBatchQuery(batchId ?? '', { skip: !batchId })
  const batch = batchId ? batchQuery.currentData : undefined
  const programme = batchId
    ? programmes.find((p) => p.id === batch?.programmeId)
    : selectedProgramme
  const intakeYear = batch?.intakeYear ?? selectedIntakeYear
  if (workspaceLoading || (batchId && batchQuery.isLoading)) return <Loading />
  if (batchId && (!batch || !programme))
    return <ErrorNotice error={batchQuery.error ?? content.batchUnavailable} />
  if (workspaceError) return <ErrorNotice error={workspaceError} />
  if (!programme) return <Alert severity="info">{content.noWorkspaceMessage}</Alert>
  const year = intakeYear ?? programme.year
  return (
    <NewApplicationEditor
      key={`${user?.id}:${programme.id}:${year}:${batchId ?? ''}`}
      user={user}
      programme={programme}
      intakeYear={year}
      batchId={batchId ?? undefined}
    />
  )
}

// A different account, programme, intake or batch starts a fresh upload draft.
function NewApplicationEditor({
  user,
  programme,
  intakeYear,
  batchId,
}: {
  user?: User
  programme: Programme
  intakeYear: string
  batchId?: string
}) {
  const content = useContent('newApplicationPage')
  const [candidate, setCandidate] = useState('')
  const [files, setFiles] = useState<SelectedDocuments>({})
  const [validationError, setValidationError] = useState('')
  const [checking, setChecking] = useState<DocumentType | null>(null)
  const [command, { isLoading, error }] = useCommandMutation()
  const navigate = useNavigate()
  const isMounted = useIsMounted()
  async function select(type: DocumentType, file?: File) {
    if (!file || checking || isLoading) return
    setValidationError('')
    setChecking(type)
    try {
      const { inspectPdf } = await import('../services/pdf')
      const { pages } = await inspectPdf(file)
      if (isMounted()) setFiles((previous) => ({ ...previous, [type]: { file, pages } }))
    } catch (error) {
      if (isMounted()) {
        remove(type)
        setValidationError(error instanceof Error ? error.message : content.unableToReadPdf)
      }
    } finally {
      if (isMounted()) setChecking(null)
    }
  }
  const total = Object.values(files).reduce((n, file) => n + file.pages, 0)
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
  function remove(type: DocumentType) {
    setFiles((previous) => {
      const next = { ...previous }
      delete next[type]
      return next
    })
  }
  async function submit() {
    if (disabled) return
    const refs = stageUploads(
      (['transcript', 'cv', 'statement'] as const).flatMap((type) => {
        const document = files[type]
        return document ? [{ type, file: document.file }] : []
      }),
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
      if (isMounted() && result.id) navigate(`/applications/${encodeURIComponent(result.id)}`)
    } catch {
      /* RTK Query presents the error. */
    } finally {
      releaseUploads(refs)
    }
  }
  return (
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
  )
}
