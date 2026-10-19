import { useContent } from '../hooks/useContent'
import { Alert, Button } from '@mui/material'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApplicationQuery, useCommandMutation } from '../app/api'
import { CorrectionForm } from '../components/assessment/CorrectionForm'
import { ErrorNotice, Loading, Page } from '../components/common'
import { latestRun, type AssessmentRun, type DocumentRecord } from '../domain/types'

export function CorrectionPage() {
  const content = useContent('correctionPage')
  const { id = '' } = useParams()
  const { currentData: data, error } = useApplicationQuery(id, { pollingInterval: 1000 })
  if (!data) return error ? <ErrorNotice error={error} /> : <Loading />
  const run = latestRun(data.application)
  if (!run || run.extractedGrade === null || ['queued', 'running', 'failed'].includes(run.status))
    return (
      <Page title={content.correctExtractedFact} subtitle={id}>
        <Alert severity="info">{content.extractionRequired}</Alert>
        <Button component={Link} to={`/applications/${id}`}>
          {content.backToAssessment}
        </Button>
      </Page>
    )
  return <CorrectionEditor key={`${id}:${run.id}`} id={id} run={run} documents={data.documents} />
}

// Keep the draft tied to the selected record/version without moving page logic into UI components.
function CorrectionEditor({
  id,
  run,
  documents,
}: {
  id: string
  run: AssessmentRun
  documents: DocumentRecord[]
}) {
  const transcript = documents.find((d) => d.type === 'transcript')
  const [value, setValue] = useState(String(run.extractedGrade))
  const [page, setPage] = useState(String(Math.min(2, transcript?.pages ?? 1)))
  const [reason, setReason] = useState('')
  const [command, mutation] = useCommandMutation()
  const navigate = useNavigate()
  async function submit() {
    try {
      await command({
        op: 'correct',
        id,
        runId: run.id,
        value: Number(value),
        reason,
        documentId: transcript?.id ?? '',
        page: Number(page),
      }).unwrap()
      navigate(`/applications/${id}`)
    } catch {
      /* The mutation error stays visible. */
    }
  }
  const disabled = mutation.isLoading || !reason.trim() || !value.trim() || !transcript

  return (
    <CorrectionForm
      id={id}
      run={run}
      transcript={transcript}
      value={value}
      setValue={setValue}
      page={page}
      setPage={setPage}
      reason={reason}
      setReason={setReason}
      mutation={mutation}
      submit={submit}
      disabled={disabled}
    />
  )
}
