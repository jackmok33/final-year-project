import { useContent } from '../../hooks/useContent'
import { ExpandMoreOutlined } from '@mui/icons-material'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { type Application, type AssessmentRun, type Rubric } from '../../domain/types'
import { displayTime } from '../files'

export function RunHistory({
  app,
  run,
  rubrics,
  setSelectedRunId,
  expanded,
  onExpandedChange,
  onEvaluate,
  evaluationDisabled,
}: {
  app: Application
  run: AssessmentRun
  rubrics: Rubric[]
  setSelectedRunId: (id: string) => void
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onEvaluate: () => void
  evaluationDisabled: boolean
}) {
  const content = useContent('runHistory')
  return (
    <Accordion
      expanded={expanded}
      onChange={(_, open) => onExpandedChange(open)}
      disableGutters
      elevation={0}
      slotProps={{ transition: { unmountOnExit: true } }}
      sx={{ border: 1, borderColor: 'divider', '&:before': { display: 'none' } }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreOutlined />}
        id="history-heading"
        aria-controls="history-details"
        sx={{ px: 2.5 }}
      >
        <Typography component="span" sx={{ fontWeight: 600 }}>
          {content.runHistory}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 2.5, pt: 1 }}>
        <Stack spacing={2.5}>
          <TextField
            select
            label={content.assessmentRun}
            value={run.id}
            onChange={(e) => setSelectedRunId(e.target.value)}
          >
            {app.runs.map((r, i) => (
              <MenuItem key={r.id} value={r.id}>
                {content.runOption(
                  i + 1,
                  rubrics.find((k) => k.id === r.rubricId)?.version,
                  r.status,
                )}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2">
            {content.assessmentTime(displayTime(run.startedAt))}
          </Typography>
          {app.corrections.map((c) => (
            <Box key={c.id}>
              <Typography sx={{ fontWeight: 600 }}>
                {content.gradeCorrection(c.original, c.value)}
              </Typography>
              <Typography variant="body2">
                {content.correctionDetails(c.reason, displayTime(c.at))}
              </Typography>
            </Box>
          ))}
          {app.decisions.map((d) => (
            <Box key={d.id}>
              <Typography sx={{ fontWeight: 600 }}>{content.tutorRecorded(d.outcome)}</Typography>
              <Typography variant="body2">
                {content.decisionDetails(d.reason, displayTime(d.at))}
              </Typography>
            </Box>
          ))}
          <Typography variant="body2" color="text.secondary">
            {content.historyHint}
          </Typography>
          <Button
            variant="outlined"
            onClick={onEvaluate}
            disabled={evaluationDisabled}
            sx={{ alignSelf: 'flex-start' }}
          >
            {content.reEvaluate}
          </Button>
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}
