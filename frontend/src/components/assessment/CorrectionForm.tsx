import { useContent } from '../../hooks/useContent'
import { Alert, Box, Button, Stack, TextField } from '@mui/material'
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
              <TextField
                label={content.fact}
                value={content.finalWeightedAverage}
                slotProps={{ input: { readOnly: true } }}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
                <TextField
                  label={content.originalExtraction}
                  value={run.extractedGrade ?? ''}
                  slotProps={{ input: { readOnly: true } }}
                />
                <TextField
                  label={content.correctedValue}
                  type="number"
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  slotProps={{ htmlInput: { min: 0, max: 100, step: 0.1 } }}
                />
              </Stack>
              <TextField
                label={content.sourceDocument}
                value={transcript?.name ?? ''}
                slotProps={{ input: { readOnly: true } }}
              />
              <TextField
                label={content.sourcePage}
                type="number"
                required
                value={page}
                onChange={(e) => setPage(e.target.value)}
                slotProps={{ htmlInput: { min: 1, max: transcript?.pages ?? 1, step: 1 } }}
              />
              <TextField
                label={content.reasonForCorrection}
                required
                multiline
                minRows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <ErrorNotice error={mutation.error} />
              <Stack direction="row" spacing={1}>
                <Button type="submit" variant="contained" disabled={disabled}>
                  {content.saveReEvaluate}
                </Button>
                <Button component={Link} to={`/applications/${id}/evidence`}>
                  {content.cancel}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Card>
        <CorrectionGuidance id={id} transcript={transcript} />
      </TwoColumns>
    </Page>
  )
}
