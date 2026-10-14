import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material'
import { useContent } from '../../hooks/useContent'
import { ErrorNotice } from '../common'

export function CreateWorkspaceDialog({
  open,
  name,
  saving,
  error,
  onNameChange,
  onClose,
  onSubmit,
}: {
  open: boolean
  name: string
  saving: boolean
  error: unknown
  onNameChange: (name: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const content = useContent('createWorkspaceDialog')
  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="create-workspace-title"
      aria-describedby="create-workspace-description"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!saving && name.trim() && name.trim().length <= 100) onSubmit()
        }}
      >
        <DialogTitle id="create-workspace-title">{content.title}</DialogTitle>
        <DialogContent>
          <DialogContentText id="create-workspace-description" sx={{ mb: 2 }}>
            {content.description}
          </DialogContentText>
          <ErrorNotice error={error} />
          <TextField
            autoFocus
            fullWidth
            required
            label={content.name}
            value={name}
            disabled={saving}
            onChange={(event) => onNameChange(event.target.value)}
            helperText={content.nameHint}
            error={name.trim().length > 100}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            {content.cancel}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving || !name.trim() || name.trim().length > 100}
          >
            {saving ? content.creating : content.create}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
