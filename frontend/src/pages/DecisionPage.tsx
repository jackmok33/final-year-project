import { useContent } from '../hooks/useContent'
import { Alert, Button } from '@mui/material'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApplicationQuery, useCommandMutation, useMeQuery } from '../app/api'
import { DecisionForm } from '../components/assessment/DecisionForm'
import { ErrorNotice, Loading, Page } from '../components/common'
import {
  latestRun,
  type Application,
  type AssessmentRun,
  type DocumentRecord,
  type Outcome,
  type Rubric,
} from '../domain/types'

export function DecisionPage() {
  const content = useContent('decisionPage')
  const { id = '' } = useParams()
  const { currentData: data, error } = useApplicationQuery(id, { pollingInterval: 1000 })
  if (!data) return error ? <ErrorNotice error={error} /> : <Loading />
  const run = latestRun(data.application)
  if (!run || ['queued', 'running', 'failed'].includes(run.status))
    return (
      <Page title={content.recordTutorDecision} subtitle={id}>
        <Alert severity="info">{content.assessmentRequired}</Alert>
        <Button component={Link} to={`/applications/${id}`}>
          {content.backToAssessment}
        </Button>
      </Page>
    )
  return (
    <DecisionEditor
      key={`${data.application.id}:${run.id}`}
      app={data.application}
      run={run}
      rubric={data.rubrics.find((r) => r.id === run.rubricId)}
      documents={data.documents}
    />
  )
}

// Keep the draft tied to the selected record/version without moving page logic into UI components.
function DecisionEditor({
  app,
  run,
  rubric,
  documents,
}: {
  app: Application
  run: AssessmentRun
  rubric?: Rubric
  documents: DocumentRecord[]
}) {
  const { data: user } = useMeQuery()
  const [outcome, setOutcome] = useState<Outcome>('Further review')
  const [reason, setReason] = useState('')
  const [command, mutation] = useCommandMutation()
  const navigate = useNavigate()
  const critical = run.flags.some((f) => f.critical)
  async function save() {
    try {
      await command({
        op: 'decide',
        id: app.id,
        runId: run.id,
        outcome,
        reason,
      }).unwrap()
      navigate(`/applications/${app.id}`)
    } catch {
      /* Keep the draft and show the mutation error for retry. */
    }
  }
  const disabled = mutation.isLoading || (outcome !== 'Further review' && critical)
  const userName = user?.name

  return (
    <DecisionForm
      app={app}
      run={run}
      rubric={rubric}
      documents={documents}
      userName={userName}
      outcome={outcome}
      setOutcome={setOutcome}
      reason={reason}
      setReason={setReason}
      mutation={mutation}
      critical={critical}
      disabled={disabled}
      record={() => void save()}
    />
  )
}
