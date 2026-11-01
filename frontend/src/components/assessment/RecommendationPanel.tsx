import { Stack, Typography } from '@mui/material'
import type { AssessmentRun } from '../../domain/types'
import type { EvidenceGroup } from '../../services/applicantPresentation'
import { useContent } from '../../hooks/useContent'
import MainCard from '../../mantis/components/MainCard'
import { EvidenceSummary } from './EvidenceSummary'

export function RecommendationPanel({
  run,
  groups,
}: {
  run?: AssessmentRun
  groups: EvidenceGroup[]
}) {
  const content = useContent('recommendationPanel')
  return (
    <Stack spacing={3} sx={{ p: { xs: 2, md: 3 } }}>
      {run ? (
        <>
          <MainCard title={content.why} darkTitle contentSX={{ p: { xs: 2.5, md: 3 } }}>
            <Typography sx={{ lineHeight: 1.8, whiteSpace: 'pre-line' }}>
              {run.justification.summary}
            </Typography>
          </MainCard>
          <EvidenceSummary groups={groups} />
        </>
      ) : (
        <Typography>{content.uploadDescription}</Typography>
      )}
    </Stack>
  )
}
