import { Box, Divider, Stack, Typography } from '@mui/material'
import type { AssessmentRun, DocumentRecord } from '../../domain/types'
import type { EvidenceGroup } from '../../services/applicantPresentation'
import { useContent } from '../../hooks/useContent'
import { EvidenceLink } from '../evidence/EvidenceLink'
import { EvidenceSummary } from './EvidenceSummary'

export function RecommendationPanel({
  applicationId,
  run,
  documents,
  groups,
}: {
  applicationId: string
  run?: AssessmentRun
  documents: DocumentRecord[]
  groups: EvidenceGroup[]
}) {
  const content = useContent('recommendationPanel')
  return (
    <Box sx={{ p: 4 }}>
      {run ? (
        <>
          <Typography variant="subtitle1" component="h2">
            {content.why}
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Typography>{run.justification.summary}</Typography>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 2 }}>
            {run.justification.citations.map((citation, index) => (
              <EvidenceLink
                key={index}
                applicationId={applicationId}
                citation={citation}
                document={documents.find((document) => document.id === citation.documentId)}
                runId={run.id}
              />
            ))}
          </Stack>
          <EvidenceSummary groups={groups} />
        </>
      ) : (
        <Typography>{content.uploadDescription}</Typography>
      )}
    </Box>
  )
}
