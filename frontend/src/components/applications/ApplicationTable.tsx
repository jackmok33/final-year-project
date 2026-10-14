import { useContent } from '../../hooks/useContent'
import {
  Link as MuiLink,
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
import { latestDecision, latestRun } from '../../domain/types'
import { Status } from '../common'
export function ApplicationTable({ filtered }: { filtered: Application[] }) {
  const content = useContent('applicationTable')
  return (
    <TableContainer>
      <Table
        aria-label={content.applicationQueue}
        sx={{ '& .MuiTableCell-root': { px: { xs: 1, sm: 2 } } }}
      >
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
            const assessed = run?.status === 'awaiting review' || run?.status === 'completed'
            const decision = latestDecision(a)
            return (
              <TableRow key={a.id} hover>
                <TableCell>
                  <MuiLink
                    component={Link}
                    to={`/applications/${encodeURIComponent(a.id)}`}
                    aria-label={content.openLabel(a.id)}
                    sx={{ fontWeight: 600 }}
                  >
                    {a.id}
                  </MuiLink>
                  <Typography variant="body2" color="text.secondary">
                    {a.candidate}
                  </Typography>
                </TableCell>
                <TableCell>
                  {assessed ? (run?.overall ?? content.unavailableScore) : content.unavailableScore}
                </TableCell>
                <TableCell>
                  {run ? (
                    <Status label={assessed ? run.recommendation : run.status} />
                  ) : (
                    content.notEvaluated
                  )}
                </TableCell>
                <TableCell>
                  {decision ? <Status label={decision.outcome} /> : content.notRecorded}
                  {decision && decision.runId !== run?.id && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {content.previousAssessment}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
