import {
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { Link } from 'react-router-dom'
import type { BatchSummary } from '../../domain/types'
import { useContent } from '../../hooks/useContent'

export function BatchList({ batches }: { batches: BatchSummary[] }) {
  const content = useContent('batchList')
  return (
    <TableContainer>
      <Table
        aria-label={content.previousBatches}
        sx={{ minWidth: 700, '& .MuiTableCell-root': { px: { xs: 1.5, sm: 2 } } }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{content.batch}</TableCell>
            <TableCell>{content.date}</TableCell>
            <TableCell align="right">{content.applicants}</TableCell>
            <TableCell align="right">{content.pendingHumanReview}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {batches.map((batch) => {
            const name = content.batchName(batch.sequence)
            const dateId = `batch-date-${encodeURIComponent(batch.id)}`
            const date = new Intl.DateTimeFormat('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(batch.uploadedAt))
            return (
              <TableRow key={batch.id} hover>
                <TableCell>
                  <MuiLink
                    component={Link}
                    to={`/batches/${encodeURIComponent(batch.id)}`}
                    aria-label={content.open(batch.sequence)}
                    aria-describedby={dateId}
                    sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                  >
                    {name}
                  </MuiLink>
                </TableCell>
                <TableCell id={dateId} sx={{ whiteSpace: 'nowrap' }}>
                  {date}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {batch.applicantCount}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: batch.pendingReviewCount > 0 ? 600 : 400,
                  }}
                >
                  {batch.pendingReviewCount}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
