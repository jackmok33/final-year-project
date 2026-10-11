import { useContent } from '../../hooks/useContent'
import { Alert, Button, Divider, TextField, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { AssessmentRun, Citation } from '../../domain/types'
import { type DocumentRecord } from '../../domain/types'
import { Card, Status } from '../common'
export function EvidenceClaim({
  citation,
  run,
  doc,
  page,
  id,
}: {
  citation?: Citation
  run?: AssessmentRun
  doc: DocumentRecord
  page: number
  id: string
}) {
  const content = useContent('evidenceClaim')
  return (
    <Card title={content.assessmentClaim}>
      {citation ? (
        <>
          <Status
            label={
              run?.flags.some((f) => f.code === 'GRADE_MISMATCH') && doc.type === 'transcript'
                ? content.needsVerification
                : content.citedSource
            }
          />
          <Typography variant="h6" component="h2">
            {content.quotedClaim(citation.claim)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {content.sourceContext(doc.name, page)}
          </Typography>
        </>
      ) : (
        <Typography>{content.noClaimMessage}</Typography>
      )}
      {doc.type === 'transcript' && run && (
        <>
          <Divider />
          <TextField
            label={content.extractedFinalGrade}
            value={
              run.extractedGrade === null
                ? content.notExtracted
                : content.gradeValue(run.extractedGrade)
            }
            slotProps={{ input: { readOnly: true } }}
          />
          {run.flags.some((f) => f.code === 'GRADE_MISMATCH') && (
            <Alert severity="warning">{content.mismatchWarning}</Alert>
          )}
          <Button
            component={Link}
            to={`/applications/${id}/correct`}
            variant="contained"
            disabled={
              run.extractedGrade === null || ['queued', 'running', 'failed'].includes(run.status)
            }
          >
            {content.correctExtractedFact}
          </Button>
        </>
      )}
      <Typography variant="body2" color="text.secondary">
        {content.citationHint}
      </Typography>
      <Button component={Link} to={`/applications/${id}`}>
        {content.returnToAssessment}
      </Button>
    </Card>
  )
}
