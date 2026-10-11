import { useContent } from '../../hooks/useContent'
import { Button } from '@mui/material'
import { Link } from 'react-router-dom'
import { applicationState, type Application, type AssessmentRun } from '../../domain/types'
import { Status } from '../common'

export function AssessmentActions({
  app,
  id,
  latest,
  inProgress,
  busy,
  onEvaluate,
}: {
  app: Application
  id: string
  latest?: AssessmentRun
  inProgress: boolean
  busy: boolean
  onEvaluate: () => void
}) {
  const content = useContent('assessmentActions')
  return (
    <>
      <Status label={applicationState(app)} />
      <Button variant="outlined" component={Link} to={`/applications/${id}/evidence`}>
        {content.viewDocuments}
      </Button>
      <Button
        variant="contained"
        component={Link}
        to={`/applications/${id}/decision`}
        disabled={!latest || inProgress || latest.status === 'failed'}
      >
        {content.recordDecision}
      </Button>
      <Button variant="outlined" onClick={onEvaluate} disabled={busy || inProgress}>
        {app.runs.length ? content.reEvaluateDemoCase : content.requestEvaluation}
      </Button>
    </>
  )
}
