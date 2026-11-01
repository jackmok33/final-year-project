import FormActions from '../../mantis/components/FormActions'
import { useId } from 'react'
import { useContent } from '../../hooks/useContent'
import {
  InputLabel,
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material'
import type { User } from '../../domain/types'
import { ErrorNotice } from '../common'

export function UserForm({
  form,
  setForm,
  saving,
  error,
  role,
  setRole,
  save,
  cancel,
}: {
  form: User
  setForm: (user: User) => void
  saving: boolean
  error?: unknown
  role: 'both' | 'tutor' | 'admin'
  setRole: (role: 'both' | 'tutor' | 'admin') => void
  save: () => Promise<void>
  cancel: () => void
}) {
  const content = useContent('userForm')
  const fieldId = useId()
  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!saving) void save()
      }}
    >
      <Stack spacing={2}>
        <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
          <InputLabel id={`${fieldId}-name-label`} htmlFor={`${fieldId}-name`} required>
            {content.name}
          </InputLabel>
          <TextField
            id={`${fieldId}-name`}
            required
            disabled={saving}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Stack>
        <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
          <InputLabel id={`${fieldId}-email-label`} htmlFor={`${fieldId}-email`} required>
            {content.email}
          </InputLabel>
          <TextField
            id={`${fieldId}-email`}
            required
            disabled={saving}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Stack>
        <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
          <InputLabel id={`${fieldId}-role-label`} htmlFor={`${fieldId}-role`}>
            {content.role}
          </InputLabel>
          <TextField
            slotProps={{ select: { labelId: `${fieldId}-role-label` } }}
            select
            disabled={saving}
            id={`${fieldId}-role`}
            value={role}
            onChange={(e) => setRole(e.target.value as 'both' | 'tutor' | 'admin')}
          >
            <MenuItem value="tutor">{content.admissionsTutor}</MenuItem>
            <MenuItem value="admin">{content.administrator}</MenuItem>
            <MenuItem value="both">{content.tutorAdministrator}</MenuItem>
          </TextField>
        </Stack>
        <FormControlLabel
          control={
            <Switch
              color="secondary"
              disabled={saving}
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
          }
          label={content.accountActive}
        />
        <ErrorNotice error={error} />
        <FormActions>
          <Button type="button" onClick={cancel} disabled={saving}>
            {content.cancel}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving || !form.name.trim() || !form.email.trim()}
          >
            {form.id ? content.saveAccount : content.createAccount}
          </Button>
        </FormActions>
      </Stack>
    </Box>
  )
}
