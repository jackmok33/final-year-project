import FormActions from '../../mantis/components/FormActions'
import { useId } from 'react'
import { useContent } from '../../hooks/useContent'
import { InputLabel, Alert, Box, Button, Stack, TextField } from '@mui/material'
import { Link } from 'react-router-dom'
import { type AssessmentRun, type DocumentRecord } from '../../domain/types'
import { Card, ErrorNotice, Page, TwoColumns } from '../common'
import { CorrectionGuidance } from './CorrectionGuidance'

export function CorrectionForm({
  id,
  run,
  transcript,
  value,
  setValue,
  page,
  setPage,
  reason,
  setReason,
  mutation,
  submit,
  disabled,
}: {
  id: string
  run: AssessmentRun
  transcript: DocumentRecord | undefined
  value: string
  setValue: (value: string) => void
  page: string
  setPage: (page: string) => void
  reason: string
  setReason: (reason: string) => void
  mutation: { isLoading: boolean; error?: unknown }
  submit: () => Promise<void>
  disabled: boolean
}) {
  const content = useContent('correctionForm')
  const fieldId = useId()
  return (
    <Page
      title={content.correctExtractedFact}
      subtitle={content.subtitle(id, transcript?.name ?? content.transcriptFallback)}
    >
      <TwoColumns>
        <Card title={content.factCorrection}>
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
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
                    type="number"
                    required
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    slotProps={{ htmlInput: { min: 0, max: 100, step: 0.1 } }}
                  />
                </Stack>
              </Stack>
              <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
                <InputLabel
                  id={`${fieldId}-sourceDocument-label`}
                  htmlFor={`${fieldId}-sourceDocument`}
                >
                  {content.sourceDocument}
                </InputLabel>
                <TextField
                  id={`${fieldId}-sourceDocument`}
                  value={transcript?.name ?? ''}
                  slotProps={{ input: { readOnly: true } }}
                />
              </Stack>
              <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
                <InputLabel
                  id={`${fieldId}-sourcePage-label`}
                  htmlFor={`${fieldId}-sourcePage`}
                  required
                >
                  {content.sourcePage}
                </InputLabel>
                <TextField
                  id={`${fieldId}-sourcePage`}
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
                  multiline
                  minRows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Stack>
              <ErrorNotice error={mutation.error} />
              <FormActions>
                <Button type="submit" variant="contained" disabled={disabled}>
                  {content.saveReEvaluate}
                </Button>
                <Button component={Link} to={`/applications/${id}/evidence`}>
                  {content.cancel}
                </Button>
              </FormActions>
            </Stack>
          </Box>
        </Card>
        <CorrectionGuidance id={id} transcript={transcript} />
      </TwoColumns>
    </Page>
  )
}
