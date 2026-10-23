import FormActions from '../../mantis/components/FormActions'
import { useId } from 'react'
import { useContent } from '../../hooks/useContent'
import {
  InputLabel,
  Alert,
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material'
import type { Programme, User } from '../../domain/types'
import { Card, ErrorNotice } from '../common'
import { UserPermissions } from './UserPermissions'

export function UserForm({
  form,
  programmes,
  setForm,
  mutation,
  message,
  role,
  setRole,
  save,
}: {
  form: User
  programmes: Programme[]
  setForm: (user: User) => void
  mutation: { isLoading: boolean; error?: unknown }
  message: string
  role: 'both' | 'tutor' | 'admin'
  setRole: (role: 'both' | 'tutor' | 'admin') => void
  save: () => Promise<void>
}) {
  const content = useContent('userForm')
  const fieldId = useId()
  return (
    <Card title={form.id ? content.editAccount : content.createAccount}>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
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
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Stack>
          <Stack sx={{ gap: 1, minWidth: 0, flex: 1 }}>
            <InputLabel id={`${fieldId}-demoEmail-label`} htmlFor={`${fieldId}-demoEmail`} required>
              {content.demoEmail}
            </InputLabel>
            <TextField
              id={`${fieldId}-demoEmail`}
              required
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
              id={`${fieldId}-role`}
              value={role}
              onChange={(e) => setRole(e.target.value as 'both' | 'tutor' | 'admin')}
            >
              <MenuItem value="tutor">{content.admissionsTutor}</MenuItem>
              <MenuItem value="admin">{content.administrator}</MenuItem>
              <MenuItem value="both">{content.tutorAdministrator}</MenuItem>
            </TextField>
          </Stack>
          {form.roles.includes('tutor') && <UserPermissions form={form} programmes={programmes} />}
          <FormControlLabel
            control={
              <Switch
                color="secondary"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
            }
            label={content.accountActive}
          />
          <ErrorNotice error={mutation.error} />
          {message && <Alert severity="success">{message}</Alert>}
          <FormActions>
            <Button type="submit" variant="contained" disabled={mutation.isLoading}>
              {form.id ? content.saveAccount : content.createAccount}
            </Button>
          </FormActions>
        </Stack>
      </Box>
    </Card>
  )
}
