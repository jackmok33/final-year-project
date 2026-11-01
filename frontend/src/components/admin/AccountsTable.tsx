import MainCard from '../../mantis/components/MainCard'
import { useContent } from '../../hooks/useContent'
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { User } from '../../domain/types'
import { Status } from '../common'

export function AccountsTable({ users, onEdit }: { users: User[]; onEdit: (user: User) => void }) {
  const content = useContent('accountsTable')
  return (
    <MainCard title={content.accounts} content={false}>
      <TableContainer>
        <Table
          aria-label={content.tableLabel}
          sx={{
            minWidth: 560,
            '& th:first-of-type, & td:first-of-type': { pl: 3 },
            '& th:last-of-type, & td:last-of-type': { pr: 3 },
          }}
        >
          <TableHead>
            <TableRow>
              {[content.user, content.role, content.state, content.actions].map((label, i) => (
                <TableCell key={i}>{label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>
                  <Typography sx={{ fontWeight: 600 }}>{u.name}</Typography>
                  <Typography variant="body2">{u.email}</Typography>
                </TableCell>
                <TableCell>{content.roleLabel(u.roles)}</TableCell>
                <TableCell>
                  <Status label={u.active ? content.active : content.inactive} />
                </TableCell>
                <TableCell>
                  <Button onClick={() => onEdit(u)} aria-label={content.editLabel(u.name)}>
                    {content.edit}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!users.length && (
              <TableRow>
                <TableCell colSpan={4}>{content.empty}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </MainCard>
  )
}
