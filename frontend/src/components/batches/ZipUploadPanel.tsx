import { Button, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { useContent } from '../../hooks/useContent'
import { ErrorNotice } from '../common'
import MainCard from '../../mantis/components/MainCard'
import SingleFileUpload from '../../mantis/components/SingleFileUpload'
import CircularWithPath from '../../mantis/components/CircularWithPath'

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
  const [rejected, setRejected] = useState(false)
  return (
    <MainCard title={content.uploadTitle}>
      <SingleFileUpload
        disabled={busy}
        labels={content.upload}
        onSelect={(next) => {
          setRejected(false)
          onSelect(next)
        }}
        onReject={() => {
          setRejected(true)
          onSelect(undefined)
        }}
      />
      <ErrorNotice error={rejected ? content.invalidZip : error} />
      {file && (
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'flex-end', gap: 2, mt: 2 }}
        >
          <Typography variant="body2">{file.name}</Typography>
          {busy && <CircularWithPath size={20} aria-label={content.uploading} />}
          <Button variant="contained" onClick={onImport} disabled={busy}>
            {busy ? content.uploading : content.uploadBatch}
          </Button>
        </Stack>
      )}
    </MainCard>
  )
}
