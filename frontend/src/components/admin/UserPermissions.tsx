import { useContent } from '../../hooks/useContent'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'
import type { Programme, User } from '../../domain/types'

export function UserPermissions({
  form,
  programmes,
  setForm,
}: {
  form: User
  programmes: Programme[]
  setForm: (user: User) => void
}) {
  const content = useContent('userPermissions')
  return (
    <>
      <Typography sx={{ fontWeight: 600 }}>{content.assignedCourseWorkspaces}</Typography>
      {programmes.map((programme) => (
        <FormControlLabel
          key={programme.id}
          control={
            <Checkbox
              color="secondary"
              checked={form.programmeIds.includes(programme.id)}
              onChange={(e) =>
                setForm({
                  ...form,
                  programmeIds: e.target.checked
                    ? [...form.programmeIds, programme.id]
                    : form.programmeIds.filter((id) => id !== programme.id),
                })
              }
            />
          }
          label={content.programmeAccessLabel(programme.name)}
        />
      ))}
    </>
  )
}
