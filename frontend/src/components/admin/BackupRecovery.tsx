import { useContent } from '../../hooks/useContent'
import { Alert, Button, Divider, Stack, Typography } from '@mui/material'
import { Card } from '../common'
import { FilePicker } from '../FilePicker'

export function BackupRecovery({
  busy,
  reading,
  backup,
  selectBackup,
}: {
  busy: boolean
  reading: boolean
  backup: () => Promise<void>
  selectBackup: (file?: File) => Promise<void>
}) {
  const content = useContent('backupRecovery')
  return (
    <Card title={content.backupRecovery}>
      <Typography>{content.backupDescription}</Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button variant="contained" onClick={() => void backup()} disabled={busy || reading}>
          {content.createBackup}
        </Button>
        <FilePicker
          label={reading ? content.verifying : content.restoreBackup}
          inputLabel={content.importDemoBackup}
          accept=".json,application/json"
          disabled={busy || reading}
          onSelect={(file) => void selectBackup(file)}
        />
      </Stack>
      <Divider />
      <Typography sx={{ fontWeight: 600 }}>{content.recoveryChecks}</Typography>
      <Typography>{content.recoveryDescription}</Typography>
      <Alert severity="warning">{content.restoreWarning}</Alert>
    </Card>
  )
}
