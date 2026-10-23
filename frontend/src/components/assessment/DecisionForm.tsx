import { Alert, Box, Button, Stack, TextField } from '@mui/material'
import type { TutorOutcome } from '../../domain/types'
import { useContent } from '../../hooks/useContent'
import { ErrorNotice } from '../common'
import { OutcomeOptions } from './OutcomeOptions'

export function DecisionForm({
  outcome,
  setOutcome,
  reason,
  setReason,
  error,
  critical,
  disabled,
  record,
}: {
  outcome: TutorOutcome
  setOutcome: (outcome: TutorOutcome) => void
  reason: string
  setReason: (reason: string) => void
  error?: unknown
  critical: boolean
  disabled: boolean
  record: () => void
}) {
  const content = useContent('decisionForm')
  return (
    <Box
      component="form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled) record()
      }}
      sx={{ maxWidth: 700 }}
    >
      <Stack spacing={2.5}>
        {critical && <Alert severity="warning">{content.criticalWarning}</Alert>}
        <OutcomeOptions outcome={outcome} setOutcome={setOutcome} critical={critical} />
        <TextField
          placeholder={content.reviewNote}
          multiline
          minRows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          slotProps={{ htmlInput: { 'aria-label': content.reviewNote } }}
        />
        <ErrorNotice error={error} />
        <Button
          type="submit"
          variant="contained"
          disabled={disabled}
          sx={{ alignSelf: 'flex-start' }}
        >
          {content.recordDecision}
        </Button>
      </Stack>
    </Box>
  )
}
