import { useContent } from '../hooks/useContent'
import { Alert } from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCommandMutation } from '../app/api'
import { useWorkspace } from '../app/workspace'
import {
  NewApplicationForm,
  type SelectedDocuments,
} from '../components/applications/NewApplicationForm'
import { ErrorNotice, Loading } from '../components/common'
import { type DocumentType } from '../domain/types'
import { releaseUploads, stageUploads } from '../services/demo'
export function NewApplicationPage() {
  const content = useContent('newApplicationPage')
  const {
    user,
    programme,
    intakeYear,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace()
  const [candidate, setCandidate] = useState('')
  const [files, setFiles] = useState<SelectedDocuments>({})
  const [validationError, setValidationError] = useState('')
  const [checking, setChecking] = useState<DocumentType | null>(null)
  const [command, { isLoading, error }] = useCommandMutation()
  const navigate = useNavigate()
  async function select(type: DocumentType, file?: File) {
    if (!file) return
    setValidationError('')
    setChecking(type)
    try {
      const { inspectPdf } = await import('../services/pdf')
      const { pages } = await inspectPdf(file)
      setFiles((previous) => ({ ...previous, [type]: { file, pages } }))
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : content.unableToReadPdf)
    } finally {
      setChecking(null)
    }
  }
  const total = Object.values(files).reduce((n, file) => n + file.pages, 0)
  function remove(type: DocumentType) {
    setFiles((previous) => {
      const next = { ...previous }
      delete next[type]
      return next
    })
  }
  async function submit() {
    if (!programme || checking || total > 100) return
    const refs = stageUploads(
      (
        Object.entries(files) as [
          DocumentType,
          {
            file: File
            pages: number
          },
        ][]
      ).map(([type, value]) => ({ type, file: value.file })),
    )
    try {
      const result = await command({
        op: 'create',
        candidate,
        programmeId: programme.id,
        intakeYear: intakeYear ?? programme.year,
        uploads: refs,
      }).unwrap()
      navigate(`/applications/${result.id}`)
    } catch {
      /* RTK Query presents the error. */
    } finally {
      releaseUploads(refs)
    }
  }

  if (workspaceLoading) return <Loading />
  if (workspaceError) return <ErrorNotice error={workspaceError} />
  if (!programme) return <Alert severity="info">{content.noWorkspaceMessage}</Alert>
  const disabled =
    isLoading ||
    !!checking ||
    !candidate.trim() ||
    !Object.keys(files).length ||
    total > 100 ||
    !user?.programmeIds.includes(programme?.id ?? '')
  return (
    <NewApplicationForm
      programme={{ ...programme, year: intakeYear ?? programme.year }}
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
