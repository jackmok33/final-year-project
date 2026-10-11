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
  const { data, isLoading, error } = useApplicationQuery(id, { pollingInterval: 1000 })
  if (isLoading) return <Loading />
  if (!data) return <ErrorNotice error={error} />
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
      key={run.id}
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
  const [confirmed, setConfirmed] = useState(false)
  const [open, setOpen] = useState(false)
  const [command, mutation] = useCommandMutation()
  const navigate = useNavigate()
  const critical = run.flags.some((f) => f.critical)
  const override = outcome !== run.recommendation
  async function save() {
    try {
      await command({
        op: 'decide',
        id: app.id,
        runId: run.id,
        outcome,
        reason,
        confirmed,
      }).unwrap()
      setOpen(false)
      navigate(`/applications/${app.id}`)
    } catch {
      setOpen(false)
    }
  }
  const disabled =
    mutation.isLoading ||
    (override && !reason.trim()) ||
    (outcome !== 'Further review' && (!confirmed || critical))
  const userName = user?.name
  function record() {
    if (outcome === 'Further review') void save()
    else setOpen(true)
  }

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
      confirmed={confirmed}
      setConfirmed={setConfirmed}
      open={open}
      setOpen={setOpen}
      mutation={mutation}
      critical={critical}
      override={override}
      disabled={disabled}
      save={save}
      record={record}
    />
  )
}
