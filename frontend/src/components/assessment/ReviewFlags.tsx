import { useContent } from '../../hooks/useContent'
import { Alert, Button, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { type AssessmentRun } from '../../domain/types'
import { Card } from '../common'

export function ReviewFlags({
  run,
  id,
  inProgress,
  latest,
}: {
  run: AssessmentRun
  id: string
  inProgress: boolean
  latest?: AssessmentRun
}) {
  const content = useContent('reviewFlags')
  return (
    <Card title={content.reviewFlags}>
      {!run.flags.length && <Alert severity="success">{content.noFlagsMessage}</Alert>}
      {run.flags.map((flag) => (
        <Alert key={flag.code} severity={flag.critical ? 'warning' : 'info'}>
          <Typography sx={{ fontWeight: 600 }}>{flag.code.replaceAll('_', ' ')}</Typography>
          {flag.message}
        </Alert>
      ))}
      {run.extractedGrade !== null && (
        <Button
          component={Link}
          to={`/applications/${id}/correct`}
          disabled={inProgress || latest?.status === 'failed'}
        >
          {content.inspectCorrectFact}
        </Button>
      )}
      {run.error && <Typography variant="body2">{content.failureCategory(run.error)}</Typography>}
    </Card>
  )
}
