import { Alert, Stack, Typography } from '@mui/material'
import type { Programme, WorkspaceDeletionImpact } from '../../domain/types'
import { useContent } from '../../hooks/useContent'
import { Confirm, ErrorNotice } from '../common'

export function DeleteWorkspaceDialog({
  programme,
  impact,
  loading,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  programme?: Programme
  impact?: WorkspaceDeletionImpact
  loading: boolean
  busy: boolean
  error: unknown
  onClose: () => void
  onConfirm: () => void
}) {
  const content = useContent('deleteWorkspaceDialog')
  return (
    <Confirm
      open={!!programme}
      title={content.title(programme?.name ?? '')}
      onClose={onClose}
      onConfirm={onConfirm}
      busy={busy}
      disabled={loading || !impact}
      destructive
    >
      <Stack spacing={2}>
        <ErrorNotice error={error} />
        {loading && <Typography role="status">{content.loading}</Typography>}
        {impact && (
          <>
            <Typography>
              {content.impact(impact.applications, impact.documents, impact.criteriaVersions)}
            </Typography>
            {impact.otherTutors > 0 && (
              <Typography>{content.shared(impact.otherTutors)}</Typography>
            )}
          </>
        )}
        <Alert severity="warning">{content.warning}</Alert>
      </Stack>
    </Confirm>
  )
}
