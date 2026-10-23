import ArrowLeftOutlined from '@ant-design/icons/ArrowLeftOutlined'
import { Alert, Box, Button, Typography } from '@mui/material'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApplicationsQuery, useBatchQuery, useCommandMutation } from '../app/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { ApplicationFilters } from '../components/applications/ApplicationFilters'
import {
  ApplicationTable,
  type ApplicantRow,
  type ApplicantSort,
  type ApplicantSortColumn,
} from '../components/applications/ApplicationTable'
import { SummaryCards } from '../components/SummaryCards'
import { Confirm, ErrorNotice, Loading, Page } from '../components/common'
import MainCard from '../mantis/components/MainCard'
import TablePagination from '../mantis/components/TablePagination'
import { applicantProfile } from '../services/applicantPresentation'
import { programmeIntakeLabel } from '../domain/programmeDisplay'
import {
  applicationState,
  aiRecommendation,
  assessmentScore,
  currentDecision,
  decisionOutcome,
  finalDecision,
  isOffer,
  latestRun,
  type Application,
} from '../domain/types'
import { applicationIntakeYear, normalizeIntakeYear } from '../domain/intakes'
import { batchApplications } from '../domain/batches'
import { useContent } from '../hooks/useContent'
import { usePagination } from '../hooks/usePagination'

export function ApplicationsPage() {
  const content = useContent('applicationsPage')
  const workspace = useWorkspace()
  const { batchId } = useParams()
  const batchQuery = useBatchQuery(batchId ?? '', { skip: !batchId })
  const batch = batchQuery.currentData
  const programme = batchId
    ? workspace.programmes.find((p) => p.id === batch?.programmeId)
    : workspace.programme
  const applications = useApplicationsQuery(programme?.id ?? '', {
    skip: !programme,
    pollingInterval: 1000,
  })
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<ApplicantSort>({ column: 'submittedAt', direction: 'desc' })
  const [deleting, setDeleting] = useState<Application>()
  const [command, mutation] = useCommandMutation()
  const year =
    batch?.intakeYear ??
    normalizeIntakeYear(workspace.intakeYear ?? programme?.year ?? '') ??
    workspace.intakeYear ??
    programme?.year ??
    ''
  const scoped = (
    batch
      ? batchApplications(batch, applications.currentData ?? [])
      : (applications.currentData ?? [])
  ).filter((a) => programme && applicationIntakeYear(a, programme) === year)
  function sortValue({ application, profile, index }: ApplicantRow): string | number | null {
    switch (sort.column) {
      case 'id':
        return index + 1
      case 'name':
        return profile.name
      case 'studentId':
        return profile.studentId
      case 'state':
        return content.workflowLabels[applicationState(application)]
      case 'university':
        return profile.university || null
      case 'score':
        return assessmentScore(application)
      case 'recommendation':
        return aiRecommendation(latestRun(application)) ?? null
      case 'decision':
        return decisionOutcome(currentDecision(application)?.outcome)
      case 'submittedAt':
        return Date.parse(application.submittedAt)
    }
  }
  const rows = scoped
    .map((application, index) => ({ application, index, profile: applicantProfile(application) }))
    .filter(
      (row) =>
        (status === 'all' || applicationState(row.application) === status) &&
        `${row.profile.name} ${row.profile.studentId} ${row.application.id}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const left = sortValue(a)
      const right = sortValue(b)
      // Missing values stay last in either direction; zero is still a real score.
      if (left === null) return right === null ? a.index - b.index : 1
      if (right === null) return -1
      const comparison =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right), 'en', { numeric: true, sensitivity: 'base' })
      return (sort.direction === 'asc' ? comparison : -comparison) || a.index - b.index
    })
  const pagination = usePagination(rows.length, 5)

  if (workspace.isLoading || applications.isLoading || (batchId && batchQuery.isLoading))
    return <Loading />
  if (workspace.error) return <ErrorNotice error={workspace.error} />
  if (batchId && (!batch || !programme))
    return <ErrorNotice error={batchQuery.error ?? content.batchUnavailable} />
  if (!programme) return <Alert severity="info">{content.noWorkspaceMessage}</Alert>
  const offers = scoped.filter((a) => isOffer(finalDecision(a)?.outcome)).length
  const pending = scoped.filter((a) => !finalDecision(a)).length
  function filter(change: () => void) {
    pagination.resetPage()
    change()
  }
  function toggleSort(column: ApplicantSortColumn) {
    filter(() =>
      setSort((current) => ({
        column,
        direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc',
      })),
    )
  }
  async function deleteApplicant() {
    if (!deleting || mutation.isLoading) return
    try {
      await command({ op: 'deleteApplicant', id: deleting.id, confirmed: true }).unwrap()
      setDeleting(undefined)
    } catch {
      /* Show the failed mutation in the dialog. */
    }
  }
  return (
    <Page
      title={programmeIntakeLabel(programme, year)}
      actions={
        <Button component={Link} to="/batches" startIcon={<ArrowLeftOutlined aria-hidden="true" />}>
          {content.back}
        </Button>
      }
    >
      {batch && (
        <Typography variant="h2" component="h2" color="text.secondary">
          {content.batchName(batch.sequence)}
        </Typography>
      )}
      <ErrorNotice error={applications.error} />
      {applications.currentData && (
        <SummaryCards
          items={[
            { label: content.total, value: scoped.length, hint: content.batchHint },
            { label: content.offers, value: offers, hint: content.offersHint },
            { label: content.pending, value: pending, hint: content.pendingHint },
          ]}
        />
      )}
      <MainCard content={false}>
        <Box sx={{ p: 2.5 }}>
          <ApplicationFilters
            search={search}
            status={status}
            sort={sort}
            setSearch={(value) => filter(() => setSearch(value))}
            setStatus={(value) => filter(() => setStatus(value))}
            setSort={(value) => filter(() => setSort(value))}
            addPath={
              batchId
                ? `/applications/new?${new URLSearchParams({ batch: batchId })}`
                : '/applications/new'
            }
          />
        </Box>
        <ApplicationTable
          rows={rows.slice(pagination.startIndex, pagination.endIndex)}
          sort={sort}
          onSort={toggleSort}
          onDelete={setDeleting}
        />
        {!rows.length && <Typography sx={{ p: 3 }}>{content.noMatches}</Typography>}
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={rows.length}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          labels={content.pagination}
        />
      </MainCard>
      <Confirm
        open={!!deleting}
        title={content.deleteTitle}
        destructive
        onClose={() => setDeleting(undefined)}
        onConfirm={() => void deleteApplicant()}
        busy={mutation.isLoading}
      >
        <Typography>{deleting ? applicantProfile(deleting).name : ''}</Typography>
        <Typography>{content.deleteDescription}</Typography>
        <ErrorNotice error={mutation.error} />
      </Confirm>
    </Page>
  )
}
