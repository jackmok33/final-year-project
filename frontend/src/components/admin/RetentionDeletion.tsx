import { useContent } from '../../hooks/useContent'
import { Button, Divider, TextField, Typography } from '@mui/material'
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
  return (
    <Card title={content.retentionDeletion}>
      <TextField
        label={content.retentionPolicy}
        value={content.retentionValue}
        slotProps={{ input: { readOnly: true } }}
      />
      <Typography>{content.retentionNotice}</Typography>
      <TextField
        label={content.applicationIdentifier}
        placeholder={content.applicationPlaceholder}
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
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
