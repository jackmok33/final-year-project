import { useContent } from '../../hooks/useContent'
import { Divider, Typography } from '@mui/material'
import type { Decision } from '../../domain/types'
import {
  hasUnavailableAssessment,
  type AssessmentRun,
  type DocumentRecord,
  type Rubric,
} from '../../domain/types'
import { Card, Rationale, Status } from '../common'
import { displayTime } from '../files'
export function RecommendationSummary({
  run,
  rubric,
  documents,
  id,
  decision,
}: {
  run: AssessmentRun
  rubric?: Rubric
  documents: DocumentRecord[]
  id: string
  decision?: Decision
}) {
  const content = useContent('recommendationSummary')
  return (
    <Card title={content.recommendation}>
      <Status label={hasUnavailableAssessment(run) ? content.notAssessed : run.recommendation} />
      <Typography
        variant="h3"
        component="p"
        sx={{ fontSize: 32, fontVariantNumeric: 'tabular-nums' }}
      >
        {run.overall ?? content.unavailableScore}
      </Typography>
      <Typography color="text.secondary">{content.overallScore100}</Typography>
      <Rationale run={run} rubric={rubric} documents={documents} applicationId={id} />
      <Divider />
      <Typography sx={{ fontWeight: 600 }}>{content.tutorDecision}</Typography>
      <Typography>{decision?.outcome ?? content.notRecorded}</Typography>
      {decision && (
        <Typography variant="body2" color="text.secondary">
          {displayTime(decision.at)}
          {decision.runId !== run.id ? content.historicDecisionHint : ''}
        </Typography>
      )}
    </Card>
  )
}
