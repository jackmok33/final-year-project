import { useContent } from '../../hooks/useContent'
import { Typography } from '@mui/material'
import type { Programme, User } from '../../domain/types'

export function UserPermissions({ form, programmes }: { form: User; programmes: Programme[] }) {
  const content = useContent('userPermissions')
  const owned = programmes.filter((p) => p.createdBy === form.id)
  return (
    <>
      <Typography sx={{ fontWeight: 600 }}>{content.ownedCourses}</Typography>
      <Typography>{owned.map((p) => p.name).join(', ') || content.empty}</Typography>
      <Typography variant="body2" color="text.secondary">
        {content.ownershipHint}
      </Typography>
    </>
  )
}
