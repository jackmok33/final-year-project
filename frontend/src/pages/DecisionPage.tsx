import { Alert, Box } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApplicationQuery, useCommandMutation } from '../app/api'
import { DecisionForm } from '../components/assessment/DecisionForm'
import { ErrorNotice, Loading } from '../components/common'
import {
  isAssessmentReady,
  latestRun,
  type Application,
  type AssessmentRun,
  type TutorOutcome,
} from '../domain/types'
import { useContent } from '../hooks/useContent'

export function DecisionPage() {
  const content = useContent('decisionPage')
  const { id = '' } = useParams()
  const { currentData: data, error } = useApplicationQuery(id, { pollingInterval: 1000 })
  if (!data) return error ? <ErrorNotice error={error} /> : <Loading />
  const run = latestRun(data.application)
  if (!run || !isAssessmentReady(run))
    return (
      <Alert severity="info" sx={{ m: 3 }}>
        {content.assessmentRequired}
      </Alert>
    )
  return (
    <Box sx={{ p: 4 }}>
      <DecisionEditor key={`${data.application.id}:${run.id}`} app={data.application} run={run} />
    </Box>
  )
}
function DecisionEditor({ app, run }: { app: Application; run: AssessmentRun }) {
  const [outcome, setOutcome] = useState<TutorOutcome>('Conditional')
  const [reason, setReason] = useState('')
  const [command, mutation] = useCommandMutation()
  const navigate = useNavigate()
  const critical = run.flags.some((flag) => flag.critical)
  async function save() {
    try {
      await command({ op: 'decide', id: app.id, runId: run.id, outcome, reason }).unwrap()
      navigate(`/applications/${encodeURIComponent(app.id)}`)
    } catch {
      /* Keep the draft for retry. */
    }
  }
  return (
    <DecisionForm
      outcome={outcome}
      setOutcome={setOutcome}
      reason={reason}
      setReason={setReason}
      error={mutation.error}
      critical={critical}
      disabled={mutation.isLoading || critical}
      record={() => void save()}
    />
  )
}
