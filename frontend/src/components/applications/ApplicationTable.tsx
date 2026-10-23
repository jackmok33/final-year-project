import EyeOutlined from '@ant-design/icons/EyeOutlined'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import {
  Link as MuiLink,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
} from '@mui/material'
import { Link, useNavigate } from 'react-router-dom'
import type { Application } from '../../domain/types'
import {
  applicationState,
  aiRecommendation,
  currentDecision,
  decisionOutcome,
  isAssessmentReady,
  latestRun,
} from '../../domain/types'
import type { applicantProfile } from '../../services/applicantPresentation'
import { useContent } from '../../hooks/useContent'
import IconButton from '../../mantis/components/IconButton'
import { Status } from '../common'

export interface ApplicantRow {
  application: Application
  profile: ReturnType<typeof applicantProfile>
  index: number
}

export type ApplicantSortColumn =
  'id' | 'name' | 'studentId' | 'state' | 'university' | 'score' | 'recommendation' | 'decision'

export interface ApplicantSort {
  column: ApplicantSortColumn | 'submittedAt'
  direction: 'asc' | 'desc'
}

export function ApplicationTable({
  rows,
  sort,
  onSort,
  onDelete,
}: {
  rows: ApplicantRow[]
  sort: ApplicantSort
  onSort: (column: ApplicantSortColumn) => void
  onDelete: (application: Application) => void
}) {
  const navigate = useNavigate()
  const content = useContent('applicationTable')
  const columns: { column: ApplicantSortColumn; label: string }[] = [
    { column: 'id', label: content.id },
    { column: 'name', label: content.name },
    { column: 'studentId', label: content.studentId },
    { column: 'state', label: content.state },
    { column: 'university', label: content.university },
    { column: 'score', label: content.score },
    { column: 'recommendation', label: content.ai },
    { column: 'decision', label: content.decision },
  ]
  return (
    <TableContainer>
      <Table
        aria-label={content.applicants}
        sx={{
          minWidth: 1000,
          '& .MuiTableCell-head': { textTransform: 'none', fontSize: '0.875rem', fontWeight: 500 },
        }}
      >
        <TableHead>
          <TableRow>
            {columns.map(({ column, label }) => (
              <TableCell
                key={column}
                sortDirection={sort.column === column ? sort.direction : false}
              >
                <TableSortLabel
                  active={sort.column === column}
                  direction={sort.column === column ? sort.direction : 'asc'}
                  onClick={() => onSort(column)}
                >
                  {label}
                </TableSortLabel>
              </TableCell>
            ))}
            <TableCell align="center">{content.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ application: app, profile, index }) => {
            const run = latestRun(app)
            const ready = run && isAssessmentReady(run)
            const decision = currentDecision(app)
            const recommendation = aiRecommendation(run)
            const state = applicationState(app)
            const path = `/applications/${encodeURIComponent(app.id)}`
            return (
              <TableRow key={app.id} hover>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <MuiLink
                    component={Link}
                    to={path}
                    aria-label={content.openApplicant(profile.name)}
                  >
                    {profile.name}
                  </MuiLink>
                </TableCell>
                <TableCell>{profile.studentId}</TableCell>
                <TableCell>{content.workflowLabels[state]}</TableCell>
                <TableCell>{profile.university || content.notAvailable}</TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {ready ? (run.overall ?? content.notAvailable) : content.notAvailable}
                </TableCell>
                <TableCell>
                  {recommendation ? <Status label={recommendation} /> : content.notAvailable}
                </TableCell>
                <TableCell>
                  <Status label={decisionOutcome(decision?.outcome)} />
                </TableCell>
                <TableCell>
                  <Stack direction="row" sx={{ justifyContent: 'center', gap: 1 }}>
                    <Tooltip title={content.openApplicant(profile.name)}>
                      <IconButton
                        aria-label={content.openApplicant(profile.name)}
                        onClick={() => navigate(path)}
                        color="secondary"
                      >
                        <EyeOutlined aria-hidden="true" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={content.deleteApplicant(profile.name)}>
                      <IconButton
                        aria-label={content.deleteApplicant(profile.name)}
                        onClick={() => onDelete(app)}
                        color="error"
                      >
                        <DeleteOutlined aria-hidden="true" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
