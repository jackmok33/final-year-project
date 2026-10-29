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
  onCancel,
  saving = false,
}: {
  outcome: TutorOutcome
  setOutcome: (outcome: TutorOutcome) => void
  reason: string
  setReason: (reason: string) => void
  error?: unknown
  critical: boolean
  disabled: boolean
  record: () => void
  onCancel?: () => void
  saving?: boolean
}) {
  const content = useContent('decisionForm')
  return (
    <Box
      component="form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled && !saving) record()
      }}
      sx={{ maxWidth: 700 }}
    >
      <Stack spacing={2.5}>
        {critical && <Alert severity="warning">{content.criticalWarning}</Alert>}
        <OutcomeOptions
          outcome={outcome}
          setOutcome={setOutcome}
          critical={critical}
          disabled={saving}
        />
        <TextField
          placeholder={content.reviewNote}
          multiline
          minRows={3}
          value={reason}
          disabled={saving}
          onChange={(event) => setReason(event.target.value)}
          slotProps={{ htmlInput: { 'aria-label': content.reviewNote } }}
        />
        <ErrorNotice error={error} />
        <Stack
          direction="row"
          sx={{ gap: 1, justifyContent: onCancel ? 'flex-end' : 'flex-start' }}
        >
          {onCancel && (
            <Button type="button" onClick={onCancel} disabled={saving}>
              {content.cancel}
            </Button>
          )}
          <Button type="submit" variant="contained" disabled={disabled || saving}>
            {content.recordDecision}
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
