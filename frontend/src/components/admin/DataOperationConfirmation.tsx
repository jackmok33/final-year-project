import { useContent } from '../../hooks/useContent'
import { Typography } from '@mui/material'
import { Confirm } from '../common'
import type { BackupPreview } from '../../services/browserBackups'
export type DataOperation = 'delete' | 'restore' | 'reset'
export function DataOperationConfirmation({
  action,
  cancel,
  confirm,
  busy,
  id,
  pending,
}: {
  action: DataOperation | null
  cancel: () => void
  confirm: () => Promise<void>
  busy: boolean
  id: string
  pending: BackupPreview | null
}) {
  const content = useContent('dataOperationConfirmation')
  return (
    <Confirm
      open={!!action}
      title={
        action === 'delete'
          ? content.deleteThisLocalApplication
          : action === 'restore'
            ? content.restoreBrowserDemoBackup
            : content.resetTheDemoDataset
      }
      onClose={cancel}
      onConfirm={() => void confirm()}
      busy={busy}
      destructive={action !== 'restore'}
    >
      {action === 'delete' ? (
        <Typography>{content.deletionDescription(id.trim())}</Typography>
      ) : action === 'restore' ? (
        <Typography>
          {content.restoreDescription(pending?.applications, pending?.documents)}
        </Typography>
      ) : (
        <Typography>{content.resetDescription}</Typography>
      )}
    </Confirm>
  )
}
