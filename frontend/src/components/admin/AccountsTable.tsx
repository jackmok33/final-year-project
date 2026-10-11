import { useContent } from '../../hooks/useContent'
import {
  Alert,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { Programme, User } from '../../domain/types'
import { Card, Status } from '../common'

export function AccountsTable({
  users,
  programmes,
  setEditing,
}: {
  users?: User[]
  programmes?: Programme[]
  setEditing: (id: string) => void
}) {
  const content = useContent('accountsTable')
  return (
    <Card title={content.accounts}>
      <TableContainer>
        <Table aria-label={content.demoAccounts}>
          <TableHead>
            <TableRow>
              {[content.user, content.role, content.programmeAccess, content.state, ''].map(
                (label, i) => (
                  <TableCell key={i}>{label}</TableCell>
                ),
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {users?.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Typography sx={{ fontWeight: 600 }}>{u.name}</Typography>
                  <Typography variant="body2">{u.email}</Typography>
                </TableCell>
                <TableCell>
                  {u.roles.join(' + ')}
                  {u.canPublishCriteria ? content.criteria : ''}
                </TableCell>
                <TableCell>
                  {u.programmeIds.length
                    ? programmes
                        ?.filter((p) => u.programmeIds.includes(p.id))
                        .map((p) => p.name)
                        .join(', ')
                    : content.noTutorAccess}
                </TableCell>
                <TableCell>
                  <Status label={u.active ? content.active : content.inactive} />
                </TableCell>
                <TableCell>
                  <Button onClick={() => setEditing(u.id)} aria-label={content.editLabel(u.name)}>
                    {content.edit}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Alert severity="info">{content.permissionNotice}</Alert>
    </Card>
  )
}
