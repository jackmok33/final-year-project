import { useId } from 'react'
import { useContent } from '../../hooks/useContent'
import { Stack, InputLabel, Button, Divider, TextField, Typography } from '@mui/material'
import { Card } from '../common'
import type { DataOperation } from './DataOperationConfirmation'
export function RetentionDeletion({
  id,
  setId,
  setAction,
  busy,
}: {
  id: string
  setId: (id: string) => void
  setAction: (action: DataOperation) => void
  busy: boolean
}) {
  const content = useContent('retentionDeletion')
  const fieldId = useId()
  return (
    <Card title={content.retentionDeletion}>
      <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
        <InputLabel id={`${fieldId}-retentionPolicy-label`} htmlFor={`${fieldId}-retentionPolicy`}>
          {content.retentionPolicy}
        </InputLabel>
        <TextField
          id={`${fieldId}-retentionPolicy`}
          value={content.retentionValue}
          slotProps={{ input: { readOnly: true } }}
        />
      </Stack>
      <Typography>{content.retentionNotice}</Typography>
      <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
        <InputLabel
          id={`${fieldId}-applicationIdentifier-label`}
          htmlFor={`${fieldId}-applicationIdentifier`}
        >
          {content.applicationIdentifier}
        </InputLabel>
        <TextField
          id={`${fieldId}-applicationIdentifier`}
          placeholder={content.applicationPlaceholder}
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
      </Stack>
      <Button variant="outlined" onClick={() => setAction('delete')} disabled={!id.trim() || busy}>
        {content.reviewDeletionImpact}
      </Button>
      <Typography variant="body2">{content.deletionDescription}</Typography>
      <Divider />
      <Button color="error" onClick={() => setAction('reset')} disabled={busy}>
        {content.resetDemoDataset}
      </Button>
    </Card>
  )
}
