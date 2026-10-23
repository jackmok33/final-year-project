import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material'
import type { AssessmentRun, DocumentRecord } from '../../domain/types'
import { useContent } from '../../hooks/useContent'
import { EvidenceLink } from '../evidence/EvidenceLink'

export function SectionAssessments({
  run,
  documents,
  id,
}: {
  run: AssessmentRun
  documents: DocumentRecord[]
  id: string
}) {
  const content = useContent('sectionAssessments')
  return (
    <Stack>
      {run.sections.map((section, index) => (
        <Accordion key={section.key} defaultExpanded={index === 0}>
          <AccordionSummary
            id={`section-${section.key}-heading`}
            aria-controls={`section-${section.key}-details`}
          >
            <Stack
              direction="row"
              sx={{ justifyContent: 'space-between', width: 1, pr: 2, gap: 2 }}
            >
              <Typography component="span">{content.sectionNames[section.key]}</Typography>
              <Typography component="span">{content.sectionScore(section.score)}</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1.5}>
              <Typography>{section.explanation}</Typography>
              <Typography color="text.secondary">{section.uncertainty}</Typography>
              {section.citations.map((citation, index) => (
                <EvidenceLink
                  key={index}
                  applicationId={id}
                  citation={citation}
                  document={documents.find((doc) => doc.id === citation.documentId)}
                  runId={run.id}
                />
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}
    </Stack>
  )
}
