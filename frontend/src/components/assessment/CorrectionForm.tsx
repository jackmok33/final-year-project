import FormActions from '../../mantis/components/FormActions'
import { useId } from 'react'
import { useContent } from '../../hooks/useContent'
import { InputLabel, Alert, Box, Button, Stack, TextField } from '@mui/material'
import { type AssessmentRun, type DocumentRecord } from '../../domain/types'
import { ErrorNotice } from '../common'

export function CorrectionForm({
  run,
  transcript,
  value,
  setValue,
  page,
  setPage,
  reason,
  setReason,
  saving,
  error,
  submit,
  cancel,
  disabled,
}: {
  run: AssessmentRun
  transcript: DocumentRecord | undefined
  value: string
  setValue: (value: string) => void
  page: string
  setPage: (page: string) => void
  reason: string
  setReason: (reason: string) => void
  saving: boolean
  error?: unknown
  submit: () => Promise<void>
  cancel: () => void
  disabled: boolean
}) {
  const content = useContent('correctionForm')
  const fieldId = useId()
  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!disabled && !saving) void submit()
      }}
    >
      <Stack spacing={2.5}>
        <Alert severity="info">{content.correctionNotice}</Alert>
        <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
          <InputLabel id={`${fieldId}-fact-label`} htmlFor={`${fieldId}-fact`}>
            {content.fact}
          </InputLabel>
          <TextField
            id={`${fieldId}-fact`}
            value={content.finalWeightedAverage}
            slotProps={{ input: { readOnly: true } }}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
          <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
            <InputLabel
              id={`${fieldId}-originalExtraction-label`}
              htmlFor={`${fieldId}-originalExtraction`}
            >
              {content.originalExtraction}
            </InputLabel>
            <TextField
              id={`${fieldId}-originalExtraction`}
              value={run.extractedGrade ?? ''}
              slotProps={{ input: { readOnly: true } }}
            />
          </Stack>
          <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
            <InputLabel
              id={`${fieldId}-correctedValue-label`}
              htmlFor={`${fieldId}-correctedValue`}
              required
            >
              {content.correctedValue}
            </InputLabel>
            <TextField
              id={`${fieldId}-correctedValue`}
              disabled={saving}
              type="number"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              slotProps={{ htmlInput: { min: 0, max: 100, step: 0.1 } }}
            />
          </Stack>
        </Stack>
        <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
          <InputLabel id={`${fieldId}-sourceDocument-label`} htmlFor={`${fieldId}-sourceDocument`}>
            {content.sourceDocument}
          </InputLabel>
          <TextField
            id={`${fieldId}-sourceDocument`}
            value={transcript?.name ?? ''}
            slotProps={{ input: { readOnly: true } }}
          />
        </Stack>
        <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
          <InputLabel id={`${fieldId}-sourcePage-label`} htmlFor={`${fieldId}-sourcePage`} required>
            {content.sourcePage}
          </InputLabel>
          <TextField
            id={`${fieldId}-sourcePage`}
            disabled={saving}
            type="number"
            required
            value={page}
            onChange={(e) => setPage(e.target.value)}
            slotProps={{ htmlInput: { min: 1, max: transcript?.pages ?? 1, step: 1 } }}
          />
        </Stack>
        <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
          <InputLabel
            id={`${fieldId}-reasonForCorrection-label`}
            htmlFor={`${fieldId}-reasonForCorrection`}
            required
          >
            {content.reasonForCorrection}
          </InputLabel>
          <TextField
            id={`${fieldId}-reasonForCorrection`}
            required
            disabled={saving}
            multiline
            minRows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Stack>
        <ErrorNotice error={error} />
        <FormActions>
          <Button type="submit" variant="contained" disabled={disabled}>
            {content.saveReEvaluate}
          </Button>
          <Button type="button" onClick={cancel} disabled={saving}>
            {content.cancel}
          </Button>
        </FormActions>
      </Stack>
    </Box>
  )
}
