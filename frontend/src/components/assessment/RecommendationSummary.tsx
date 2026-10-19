import { useContent } from '../../hooks/useContent'
import { Box, Button, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { hasUnavailableAssessment, type AssessmentRun, type Decision } from '../../domain/types'
import { Card, Status } from '../common'
import { displayTime } from '../files'

export function RecommendationSummary({
  run,
  id,
  decision,
  canDecide,
}: {
  run: AssessmentRun
  id: string
  decision?: Decision
  canDecide: boolean
}) {
  const content = useContent('recommendationSummary')
  const hasResult = !['queued', 'running', 'failed'].includes(run.status)
  const unavailable = hasUnavailableAssessment(run)
  const recommendationLabel = unavailable
    ? content.notAssessed
    : hasResult
      ? run.recommendation
      : run.status
  return (
    <Card>
      <Box
        component="section"
        aria-label={content.reviewOverview}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr 1.3fr auto' },
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Stack spacing={1}>
          <Typography color="text.secondary">{content.overallScore100}</Typography>
          <Typography component="p" sx={{ fontSize: 32, fontWeight: 600, lineHeight: 1.2 }}>
            {hasResult && !unavailable
              ? (run.overall ?? content.unavailableScore)
              : content.unavailableScore}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography color="text.secondary">{content.recommendation}</Typography>
          <Status label={recommendationLabel} />
        </Stack>
        <Stack spacing={1} role="group" aria-label={content.tutorDecision}>
          <Typography color="text.secondary">{content.tutorDecision}</Typography>
          {decision ? (
            <Status label={decision.outcome} />
          ) : (
            <Typography>{content.notRecorded}</Typography>
          )}
          {decision && (
            <Typography variant="body2" color="text.secondary">
              {decision.runId === run.id ? displayTime(decision.at) : content.historicDecisionHint}
            </Typography>
          )}
        </Stack>
        <Button
          variant="contained"
          component={Link}
          to={`/applications/${encodeURIComponent(id)}/decision`}
          disabled={!canDecide}
          sx={{ justifySelf: { xs: 'stretch', md: 'end' } }}
        >
          {content.recordDecision}
        </Button>
      </Box>
    </Card>
  )
}
