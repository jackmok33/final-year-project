import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material'
import type { AssessmentRun } from '../../domain/types'
import { useContent } from '../../hooks/useContent'

export function SectionAssessments({ run }: { run: AssessmentRun }) {
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
              <Typography sx={{ lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                {section.explanation}
              </Typography>
              <Typography color="text.secondary">{section.uncertainty}</Typography>
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}
    </Stack>
  )
}
