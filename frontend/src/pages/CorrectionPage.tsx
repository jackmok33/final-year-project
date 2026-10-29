import { Alert } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useApplicationQuery, useCommandMutation } from '../app/api'
import { CorrectionForm } from '../components/assessment/CorrectionForm'
import { ErrorNotice, Loading } from '../components/common'
import {
  isAssessmentReady,
  latestRun,
  type AssessmentRun,
  type DocumentRecord,
} from '../domain/types'
import { useContent } from '../hooks/useContent'
import { useIsMounted } from '../hooks/useIsMounted'
import { useWorkspace } from '../hooks/useWorkspace'
import CustomizedDialog from '../mantis/components/CustomizedDialog'

export function CorrectionPage({
  onClose,
  onSaved,
  readOnly = false,
}: {
  onClose?: () => void
  onSaved?: () => void
  readOnly?: boolean
} = {}) {
  const content = useContent('correctionPage')
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { user } = useWorkspace()
  const { currentData: data, error } = useApplicationQuery(id, { pollingInterval: 1000 })
  const [command, mutation] = useCommandMutation()
  const navigate = useNavigate()
  const run = data && latestRun(data.application)
  const selectedRun = data?.application.runs.find((candidate) => candidate.id === params.get('run'))
  const historic = readOnly || Boolean(selectedRun && selectedRun !== run)
  const canCorrect = Boolean(run && isAssessmentReady(run) && run.extractedGrade !== null)
  function close() {
    if (mutation.isLoading) return
    if (onClose) onClose()
    else navigate(`/applications/${encodeURIComponent(id)}?tab=flags`)
  }
  async function save(value: number, page: number, reason: string, documentId: string) {
    if (!run || !canCorrect || historic || mutation.isLoading) return false
    try {
      await command({ op: 'correct', id, runId: run.id, value, reason, documentId, page }).unwrap()
      return true
    } catch {
      return false
    }
  }
  return (
    <CustomizedDialog
      open
      title={content.correctExtractedFact}
      closeLabel={content.close}
      onClose={close}
      busy={mutation.isLoading}
    >
      {!data ? (
        error ? (
          <ErrorNotice error={error} />
        ) : (
          <Loading />
        )
      ) : historic ? (
        <Alert severity="info">{content.readOnly}</Alert>
      ) : !run || !canCorrect ? (
        <Alert severity="info">{content.extractionRequired}</Alert>
      ) : (
        <CorrectionEditor
          key={`${user?.id}:${data.application.id}:${run.id}`}
          run={run}
          documents={data.documents}
          saving={mutation.isLoading}
          error={mutation.error ?? error}
          save={save}
          onSaved={() => {
            if (onSaved) onSaved()
            else if (onClose) onClose()
            else navigate(`/applications/${encodeURIComponent(id)}?tab=flags`)
          }}
          cancel={close}
        />
      )}
    </CustomizedDialog>
  )
}

// Keep the draft tied to the account, record and run in the page that owns it.
function CorrectionEditor({
  run,
  documents,
  saving,
  error,
  save,
  onSaved,
  cancel,
}: {
  run: AssessmentRun
  documents: DocumentRecord[]
  saving: boolean
  error?: unknown
  save: (value: number, page: number, reason: string, documentId: string) => Promise<boolean>
  onSaved: () => void
  cancel: () => void
}) {
  const isMounted = useIsMounted()
  const transcript = documents.find((document) => document.type === 'transcript')
  const [value, setValue] = useState(String(run.extractedGrade))
  const [page, setPage] = useState(String(Math.min(2, transcript?.pages ?? 1)))
  const [reason, setReason] = useState('')
  const grade = Number(value)
  const sourcePage = Number(page)
  const valid = Boolean(
    transcript &&
    value.trim() &&
    Number.isFinite(grade) &&
    grade >= 0 &&
    grade <= 100 &&
    Number.isInteger(sourcePage) &&
    sourcePage >= 1 &&
    sourcePage <= transcript.pages &&
    reason.trim(),
  )
  return (
    <CorrectionForm
      run={run}
      transcript={transcript}
      value={value}
      setValue={setValue}
      page={page}
      setPage={setPage}
      reason={reason}
      setReason={setReason}
      saving={saving}
      error={error}
      submit={async () => {
        if (!valid || saving || !transcript) return
        const saved = await save(grade, sourcePage, reason, transcript.id)
        if (saved && isMounted()) onSaved()
      }}
      cancel={cancel}
      disabled={saving || !valid}
    />
  )
}
