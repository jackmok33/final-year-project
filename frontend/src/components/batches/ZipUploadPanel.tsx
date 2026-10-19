import { UploadFileOutlined } from '@mui/icons-material'
import { Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useContent } from '../../hooks/useContent'
import { FilePicker } from '../FilePicker'
import { Card, ErrorNotice } from '../common'

export function ZipUploadPanel({
  file,
  busy,
  error,
  onSelect,
  onImport,
}: {
  file?: File
  busy: boolean
  error: unknown
  onSelect: (file?: File) => void
  onImport: () => void
}) {
  const content = useContent('zipUploadPanel')
  return (
    <Card title={content.title}>
      <Stack spacing={2}>
        <Typography>{content.description}</Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <FilePicker
            label={content.choose}
            inputLabel={content.inputLabel}
            accept=".zip,application/zip,application/x-zip-compressed"
            disabled={busy}
            icon={<UploadFileOutlined />}
            onSelect={onSelect}
          />
          {file && (
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {file.name}
            </Typography>
          )}
          <Button variant="contained" disabled={!file || busy} onClick={onImport}>
            {busy ? content.uploading : content.upload}
          </Button>
        </Stack>
        {busy && (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }} role="status">
            <CircularProgress size={20} />
            <Typography variant="body2">{content.progress}</Typography>
          </Stack>
        )}
        <ErrorNotice error={error} />
      </Stack>
    </Card>
  )
}
