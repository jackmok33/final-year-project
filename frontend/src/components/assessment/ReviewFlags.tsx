import { useContent } from '../../hooks/useContent'
import { Alert, Button } from '@mui/material'
import { Link } from 'react-router-dom'
import { type AssessmentRun } from '../../domain/types'
import { Card } from '../common'

export function ReviewFlags({
  run,
  id,
  canCorrect,
}: {
  run: AssessmentRun
  id: string
  canCorrect: boolean
}) {
  const content = useContent('reviewFlags')
  const flags = run.flags.filter((flag) => flag.code !== 'BACKEND_UNAVAILABLE')
  if (!flags.length) return null
  return (
    <Card title={content.reviewFlags}>
      {flags.map((flag) => (
        <Alert key={flag.code} severity={flag.critical ? 'warning' : 'info'}>
          {flag.message}
        </Alert>
      ))}
      {canCorrect && (
        <Button component={Link} to={`/applications/${encodeURIComponent(id)}/correct`}>
          {content.inspectCorrectFact}
        </Button>
      )}
    </Card>
  )
}
