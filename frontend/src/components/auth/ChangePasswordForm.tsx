import { Alert, Box, Button, InputLabel, Stack, TextField } from '@mui/material'
import { useId } from 'react'
import { useContent } from '../../hooks/useContent'

export interface PasswordDraft {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function ChangePasswordForm({
  values,
  message,
  onChange,
  onSubmit,
  onCancel,
}: {
  values: PasswordDraft
  message: string
  onChange: (field: keyof PasswordDraft, value: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const content = useContent('changePasswordForm')
  const fieldId = useId()
  const fields = ['currentPassword', 'newPassword', 'confirmPassword'] as const
  return (
    <Box
      component="form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <Stack spacing={2.5}>
        {fields.map((field) => (
          <Stack key={field} spacing={1}>
            <InputLabel htmlFor={`${fieldId}-${field}`} required>
              {content[field]}
            </InputLabel>
            <TextField
              id={`${fieldId}-${field}`}
              type="password"
              autoComplete={field === 'currentPassword' ? 'current-password' : 'new-password'}
              required
              value={values[field]}
              onChange={(event) => onChange(field, event.target.value)}
              autoFocus={field === 'currentPassword'}
            />
          </Stack>
        ))}
        {message && <Alert severity="info">{message}</Alert>}
        <Stack direction="row" sx={{ gap: 1, justifyContent: 'flex-end' }}>
          <Button type="button" onClick={onCancel}>
            {content.cancel}
          </Button>
          <Button type="submit" variant="contained">
            {content.save}
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
