import {
  Alert,
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
import TablePagination from '../../mantis/components/TablePagination'
import { ErrorNotice, Loading } from '../common'
import { displayTime } from '../files'

export function BatchList({
  batches,
  isLoading,
  error,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  batches?: BatchSummary[]
  isLoading: boolean
  error?: unknown
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  const content = useContent('batchList')
  return (
    <>
      <ErrorNotice error={error} />
      {isLoading ? (
        <Loading />
      ) : (
        batches && (
          <>
            <TableContainer>
              <Table aria-label={content.batches} sx={{ minWidth: 850 }}>
                <TableHead>
                  <TableRow>
                    {[
                      content.batch,
                      content.date,
                      content.applicants,
                      content.unconditional,
                      content.conditional,
                      content.reject,
                      content.pendingDecision,
                    ].map((label, i) => (
                      <TableCell key={label} align={i > 1 ? 'center' : 'left'}>
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.id} hover>
                      <TableCell>
                        <MuiLink component={Link} to={`/batches/${encodeURIComponent(batch.id)}`}>
                          {content.batchName(batch.sequence)}
                        </MuiLink>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {displayTime(batch.uploadedAt)}
                      </TableCell>
                      <TableCell align="center">{batch.applicantCount}</TableCell>
                      <TableCell align="center">{batch.unconditionalCount ?? 0}</TableCell>
                      <TableCell align="center">{batch.conditionalCount ?? 0}</TableCell>
                      <TableCell align="center">{batch.rejectCount ?? 0}</TableCell>
                      <TableCell align="center">{batch.pendingReviewCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {!batches.length && (
              <Alert severity="info" sx={{ m: 2.5 }}>
                {content.empty}
              </Alert>
            )}
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              labels={content.pagination}
            />
          </>
        )
      )}
    </>
  )
}
