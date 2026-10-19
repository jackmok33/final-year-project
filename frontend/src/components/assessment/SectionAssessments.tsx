import { useContent } from '../../hooks/useContent'
import { Divider, Stack, Typography } from '@mui/material'
import { type AssessmentRun, type DocumentRecord, type Rubric } from '../../domain/types'
import { hasUnavailableAssessment } from '../../domain/types'
import { Card } from '../common'
import { EvidenceLink } from '../evidence/EvidenceLink'

export function SectionAssessments({
  run,
  rubric,
  documents,
  id,
}: {
  run: AssessmentRun
  rubric?: Rubric
  documents: DocumentRecord[]
  id: string
}) {
  const content = useContent('sectionAssessments')
  return (
    <Card title={content.sectionAssessments}>
      {run.sections.map((section) => (
        <Stack key={section.key} spacing={1}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>{content.sectionNames[section.key]}</Typography>
            <Typography sx={{ fontWeight: 600 }}>
              {content.scoreSummary(section.score, rubric?.weights[section.key])}
            </Typography>
          </Stack>
          <Typography color="text.secondary">
            {hasUnavailableAssessment(run) ? content.noAssessment : section.explanation}
          </Typography>
          <Stack direction="row" sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2">{section.uncertainty}</Typography>
            {section.citations.map((citation, index) => (
              <EvidenceLink
                key={`${citation.documentId}:${citation.page}:${index}`}
                applicationId={id}
                citation={citation}
                document={documents.find((d) => d.id === citation.documentId)}
                runId={run.id}
              />
            ))}
          </Stack>
          <Divider />
        </Stack>
      ))}
      <Typography variant="body2" color="text.secondary">
        {content.uncertaintyHint}
      </Typography>
    </Card>
  )
}
