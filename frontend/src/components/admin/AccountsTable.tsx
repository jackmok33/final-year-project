import MainCard from '../../mantis/components/MainCard'
import { useContent } from '../../hooks/useContent'
import {
  Alert,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { Programme, User } from '../../domain/types'
import { Status } from '../common'

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
    <MainCard title={content.accounts} content={false}>
      <TableContainer>
        <Table
          aria-label={content.demoAccounts}
          sx={{
            minWidth: 650,
            '& th:first-of-type, & td:first-of-type': { pl: 3 },
            '& th:last-of-type, & td:last-of-type': { pr: 3 },
          }}
        >
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
              <TableRow key={u.id} hover>
                <TableCell>
                  <Typography sx={{ fontWeight: 600 }}>{u.name}</Typography>
                  <Typography variant="body2">{u.email}</Typography>
                </TableCell>
                <TableCell>{u.roles.join(' + ')}</TableCell>
                <TableCell>
                  {programmes
                    ?.filter((p) => p.createdBy === u.id)
                    .map((p) => p.name)
                    .join(', ') || content.noTutorAccess}
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
      <Box sx={{ p: 2.5 }}>
        <Alert severity="info">{content.permissionNotice}</Alert>
      </Box>
    </MainCard>
  )
}
