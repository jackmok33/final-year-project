import { Stack, Typography } from '@mui/material'
import type { AssessmentRun, EnglishTestResult } from '../../domain/types'
import type { EvidenceGroup } from '../../services/applicantPresentation'
import { useContent } from '../../hooks/useContent'
import MainCard from '../../mantis/components/MainCard'
import { EvidenceSummary } from './EvidenceSummary'

export function RecommendationPanel({
  run,
  groups,
  englishResult,
}: {
  run?: AssessmentRun
  groups: EvidenceGroup[]
  englishResult?: EnglishTestResult
}) {
  const content = useContent('recommendationPanel')
  return (
    <Stack spacing={3} sx={{ p: { xs: 2, md: 3 } }}>
      {run ? (
        <MainCard title={content.why} darkTitle contentSX={{ p: { xs: 2.5, md: 3 } }}>
          <Typography sx={{ lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {run.justification.summary}
          </Typography>
        </MainCard>
      ) : (
        <Typography>{content.uploadDescription}</Typography>
      )}
      {(run || englishResult) && (
        <EvidenceSummary groups={run ? groups : []} englishResult={englishResult} />
      )}
    </Stack>
  )
}
