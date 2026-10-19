import { useContent } from '../../hooks/useContent'
import { ExpandMoreOutlined } from '@mui/icons-material'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Stack,
  Typography,
} from '@mui/material'
import { Link } from 'react-router-dom'
import { type AssessmentRun, type DocumentRecord, type Rubric } from '../../domain/types'
import { Card } from '../common'
import { EvidenceLink } from '../evidence/EvidenceLink'

export function SectionAssessments({
  run,
  rubric,
  documents,
  id,
  canCorrect = false,
}: {
  run: AssessmentRun
  rubric?: Rubric
  documents: DocumentRecord[]
  id: string
  canCorrect?: boolean
}) {
  const content = useContent('sectionAssessments')
  return (
    <Card title={content.sectionAssessments}>
      <Stack>
        {run.sections.map((section) => (
          <Accordion
            key={section.key}
            disableGutters
            elevation={0}
            slotProps={{ transition: { unmountOnExit: true } }}
            sx={{ '&:before': { display: 'none' }, borderBottom: 1, borderColor: 'divider' }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreOutlined />}
              id={`section-${section.key}-heading`}
              aria-controls={`section-${section.key}-details`}
              sx={{ px: 0, '& .MuiAccordionSummary-content': { my: 1.5 } }}
            >
              <Stack spacing={0.5}>
                <Typography component="span" sx={{ fontWeight: 600 }}>
                  {content.sectionNames[section.key]}
                </Typography>
                <Typography component="span" variant="body2" color="text.secondary">
                  {content.scoreSummary(section.score, rubric?.weights[section.key])}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0 }}>
              <Stack spacing={1.5}>
                <Typography>{section.explanation}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {section.uncertainty}
                </Typography>
                {section.citations.map((citation, index) => (
                  <EvidenceLink
                    key={`${citation.documentId}:${citation.page}:${index}`}
                    applicationId={id}
                    citation={citation}
                    document={documents.find((d) => d.id === citation.documentId)}
                    runId={run.id}
                  />
                ))}
                {section.key === 'academic' && canCorrect && (
                  <Button component={Link} to={`/applications/${encodeURIComponent(id)}/correct`}>
                    {content.correctFact}
                  </Button>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>
    </Card>
  )
}
