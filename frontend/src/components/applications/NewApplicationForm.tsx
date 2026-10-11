import { useContent } from '../../hooks/useContent'
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { DocumentType, Programme } from '../../domain/types'
import { Card, ErrorNotice, Page, TwoColumns } from '../common'
import { DocumentUpload } from './DocumentUpload'
import { UploadGuidance } from './UploadGuidance'
export type SelectedDocuments = Partial<Record<DocumentType, { file: File; pages: number }>>

export function NewApplicationForm({
  programme,
  candidate,
  setCandidate,
  files,
  remove,
  validationError,
  checking,
  isLoading,
  error,
  select,
  total,
  submit,
  disabled,
}: {
  programme: Programme
  candidate: string
  setCandidate: (value: string) => void
  files: SelectedDocuments
  remove: (type: DocumentType) => void
  validationError: string
  checking: DocumentType | null
  isLoading: boolean
  error: unknown
  select: (type: DocumentType, file?: File) => Promise<void>
  total: number
  submit: () => Promise<void>
  disabled: boolean
}) {
  const content = useContent('newApplicationForm')
  return (
    <Page title={content.newApplication} subtitle={content.subtitle}>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <TwoColumns>
          <Card title={content.applicationDetails}>
            <TextField
              label={content.candidateReference}
              required
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
              helperText={content.candidateHint}
            />
            <TextField
              label={content.assignedProgramme}
              value={programme?.name ?? ''}
              slotProps={{ input: { readOnly: true } }}
            />
            <Typography variant="h6" component="h2">
              {content.applicationDocuments}
            </Typography>
            {(['transcript', 'cv', 'statement'] as const).map((type) => (
              <DocumentUpload
                key={type}
                type={type}
                document={files[type]}
                checking={checking === type}
                disabled={!!checking || isLoading}
                onSelect={(file) => void select(type, file)}
                onRemove={() => remove(type)}
              />
            ))}
            <Typography variant="body2">{content.pageTotal(total)}</Typography>
            {(validationError || total > 100) && (
              <Alert severity="error">{validationError || content.pageLimitError}</Alert>
            )}
            <ErrorNotice error={error} />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" type="submit" disabled={disabled}>
                {isLoading ? content.saving : content.createApplication}
              </Button>
              <Button component={Link} to="/applications">
                {content.cancel}
              </Button>
            </Stack>
          </Card>
          <UploadGuidance />
        </TwoColumns>
      </Box>
    </Page>
  )
}
