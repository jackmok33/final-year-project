import { useContent } from '../../hooks/useContent'
import { Box, MenuItem, TextField, Typography } from '@mui/material'
import { type Application, type AssessmentRun, type Rubric } from '../../domain/types'
import { Card } from '../common'
import { displayTime } from '../files'

export function RunHistory({
  app,
  run,
  rubrics,
  setSelectedRunId,
}: {
  app: Application
  run: AssessmentRun
  rubrics: Rubric[]
  setSelectedRunId: (id: string) => void
}) {
  const content = useContent('runHistory')
  return (
    <Card title={content.runHistory}>
      <TextField
        select
        label={content.assessmentRun}
        value={run.id}
        onChange={(e) => setSelectedRunId(e.target.value)}
      >
        {app.runs.map((r, i) => (
          <MenuItem key={r.id} value={r.id}>
            {content.runOption(i + 1, rubrics.find((k) => k.id === r.rubricId)?.version, r.status)}
          </MenuItem>
        ))}
      </TextField>
      <Typography variant="body2">{content.assessmentTime(displayTime(run.startedAt))}</Typography>
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
    </Card>
  )
}
