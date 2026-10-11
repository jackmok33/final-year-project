import { useContent } from '../../hooks/useContent'
import { Typography } from '@mui/material'
import { type DocumentRecord } from '../../domain/types'
import { Card } from '../common'
import { EvidenceLink } from '../evidence/EvidenceLink'

export function CorrectionGuidance({
  id,
  transcript,
}: {
  id: string
  transcript?: DocumentRecord
}) {
  const content = useContent('correctionGuidance')
  return (
    <Card title={content.whatHappensNext}>
      <Typography sx={{ fontWeight: 600 }}>{content.saveStep}</Typography>
      <Typography>{content.saveDescription}</Typography>
      <Typography sx={{ fontWeight: 600 }}>{content.evaluationStep}</Typography>
      <Typography>{content.evaluationDescription}</Typography>
      <Typography sx={{ fontWeight: 600 }}>{content.reviewStep}</Typography>
      <Typography>{content.reviewDescription}</Typography>
      <EvidenceLink
        applicationId={id}
        citation={{ documentId: transcript?.id ?? '', page: Math.min(2, transcript?.pages ?? 1) }}
        document={transcript}
        size="medium"
      >
        {content.inspectOriginalTranscript}
      </EvidenceLink>
    </Card>
  )
}
