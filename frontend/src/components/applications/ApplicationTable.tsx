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
import { Link } from 'react-router-dom'
import type { Application } from '../../domain/types'
import { applicationState, latestDecision, latestRun } from '../../domain/types'
import { Status } from '../common'
export function ApplicationTable({ filtered }: { filtered: Application[] }) {
  const content = useContent('applicationTable')
  return (
    <TableContainer>
      <Table aria-label={content.applicationQueue}>
        <TableHead>
          <TableRow>
            {content.headers.map((h, i) => (
              <TableCell key={i}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((a) => {
            const run = latestRun(a)
            return (
              <TableRow key={a.id} hover>
                <TableCell>
                  <Typography sx={{ fontWeight: 600 }}>{a.id}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {a.candidate}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Status label={applicationState(a)} />
                </TableCell>
                <TableCell>{run?.overall ?? content.unavailableScore}</TableCell>
                <TableCell>
                  {run ? <Status label={run.recommendation} /> : content.notEvaluated}
                </TableCell>
                <TableCell>
                  {run?.flags.length ? (
                    <Typography variant="body2">
                      {content.flagSummary(
                        run.flags.length,
                        run.flags.some((f) => f.critical),
                      )}
                    </Typography>
                  ) : (
                    content.none
                  )}
                </TableCell>
                <TableCell>{latestDecision(a)?.outcome ?? content.notRecorded}</TableCell>
                <TableCell>
                  <Button
                    component={Link}
                    to={`/applications/${a.id}`}
                    aria-label={content.openLabel(a.id)}
                  >
                    {content.open}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
