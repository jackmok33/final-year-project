import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material'
import { sectionKeys, type AssessmentRun } from '../../domain/types'
import { useContent } from '../../hooks/useContent'

export function SectionAssessments({ run }: { run: AssessmentRun }) {
  const content = useContent('sectionAssessments')
  return (
    <Stack>
      {sectionKeys.map((key, index) => {
        const section = run.sections.find((item) => item.key === key)
        return (
          <Accordion key={key} defaultExpanded={index === 0}>
            <AccordionSummary
              id={`section-${key}-heading`}
              aria-controls={`section-${key}-details`}
            >
              <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', width: 1, pr: 2, gap: 2 }}
              >
                <Typography component="span">{content.sectionNames[key]}</Typography>
                <Typography component="span">
                  {content.sectionScore(section?.score ?? null)}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1.5}>
                <Typography sx={{ lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                  {section?.explanation ?? content.notAssessed}
                </Typography>
                {section && <Typography color="text.secondary">{section.uncertainty}</Typography>}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )
      })}
    </Stack>
  )
}
