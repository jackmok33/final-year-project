import { useContent } from '../../hooks/useContent'
import { Button, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { latestDecision, type Application, type AssessmentRun } from '../../domain/types'
import { Card, Status } from '../common'

export function DecisionRecord({
  app,
  run,
  userName,
}: {
  app: Application
  run: AssessmentRun
  userName?: string
}) {
  const content = useContent('decisionRecord')
  return (
    <Card title={content.decisionRecord}>
      <Typography variant="body2" color="text.secondary">
        {content.tutor}
      </Typography>
      <Typography sx={{ fontWeight: 600 }}>{userName}</Typography>
      <Typography variant="body2" color="text.secondary">
        {content.recommendation}
      </Typography>
      <Status label={run.recommendation} />
      <Typography variant="body2" color="text.secondary">
        {content.recordedTutorOutcome}
      </Typography>
      <Typography>{latestDecision(app)?.outcome ?? content.notRecorded}</Typography>
      <Typography>{content.decisionExplanation}</Typography>
      <Button component={Link} to={`/applications/${app.id}/evidence`}>
        {content.inspectSourceEvidence}
      </Button>
    </Card>
  )
}
