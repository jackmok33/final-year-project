import { useId } from 'react'
import {
  Stack,
  InputLabel,
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
  valid,
  saving,
  error,
  onNameChange,
  onClose,
  onSubmit,
}: {
  open: boolean
  name: string
  valid: boolean
  saving: boolean
  error: unknown
  onNameChange: (name: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const content = useContent('createWorkspaceDialog')
  const fieldId = useId()
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
          if (!saving && valid) onSubmit()
        }}
      >
        <DialogTitle id="create-workspace-title">{content.title}</DialogTitle>
        <DialogContent>
          <DialogContentText id="create-workspace-description" sx={{ mb: 2 }}>
            {content.description}
          </DialogContentText>
          <ErrorNotice error={error} />
          <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
            <InputLabel id={`${fieldId}-name-label`} htmlFor={`${fieldId}-name`} required>
              {content.name}
            </InputLabel>
            <TextField
              autoFocus
              fullWidth
              required
              id={`${fieldId}-name`}
              value={name}
              disabled={saving}
              onChange={(event) => onNameChange(event.target.value)}
              helperText={name.trim() && !valid ? content.invalidName : content.nameHint}
              error={!!name.trim() && !valid}
              sx={{ mt: 1 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            {content.cancel}
          </Button>
          <Button type="submit" variant="contained" disabled={saving || !valid}>
            {saving ? content.adding : content.addCourse}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
