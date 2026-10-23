import { Box, Stack, Typography } from '@mui/material'
import {
  aiRecommendation,
  isAssessmentReady,
  decisionOutcome,
  type AssessmentRun,
  type Decision,
} from '../../domain/types'
import { useContent } from '../../hooks/useContent'
import MainCard from '../../mantis/components/MainCard'
import { Status } from '../common'

export function RecommendationSummary({
  run,
  decision,
}: {
  run: AssessmentRun
  decision?: Decision
}) {
  const content = useContent('recommendationSummary')
  const ready = isAssessmentReady(run)
  const recommendation = aiRecommendation(run)
  return (
    <MainCard>
      <Box
        component="section"
        aria-label={content.reviewTabs}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Stack spacing={1}>
          <Typography>{content.overall}</Typography>
          <Typography variant="h2" component="p">
            {ready ? content.scoreValue(run.overall) : content.notAvailable}
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography>{content.ai}</Typography>
          {recommendation ? (
            <Status label={recommendation} />
          ) : (
            <Typography>{content.notAvailable}</Typography>
          )}
        </Stack>
        <Stack spacing={1}>
          <Typography>{content.decision}</Typography>
          <Status
            label={decisionOutcome(decision?.runId === run.id ? decision.outcome : undefined)}
          />
        </Stack>
      </Box>
    </MainCard>
  )
}
