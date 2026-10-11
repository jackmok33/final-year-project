import { useContent } from '../../hooks/useContent'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { AuditEvent } from '../../domain/types'
import { Card } from '../common'
import { displayTime } from '../files'
export function MaintenanceActivity({ events }: { events?: AuditEvent[] }) {
  const content = useContent('maintenanceActivity')
  return (
    <Card title={content.recentMaintenanceActivity}>
      {events?.length ? (
        <TableContainer>
          <Table aria-label={content.maintenanceAuditEvents}>
            <TableHead>
              <TableRow>
                <TableCell>{content.time}</TableCell>
                <TableCell>{content.action}</TableCell>
                <TableCell>{content.target}</TableCell>
                <TableCell>{content.actor}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events
                .toReversed()
                .slice(0, 15)
                .map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{displayTime(e.at)}</TableCell>
                    <TableCell>{e.action}</TableCell>
                    <TableCell>{e.target}</TableCell>
                    <TableCell>{e.actor}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography>{content.noDemoMaintenanceActionsRecordedYet}</Typography>
      )}
    </Card>
  )
}
