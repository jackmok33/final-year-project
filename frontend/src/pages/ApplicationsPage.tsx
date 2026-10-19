import { useContent } from '../hooks/useContent'
import { Add, ArrowBackOutlined } from '@mui/icons-material'
import { Alert, Button, Typography } from '@mui/material'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApplicationsQuery, useBatchQuery } from '../app/api'
import { useWorkspace } from '../app/workspace'
import { ApplicationFilters } from '../components/applications/ApplicationFilters'
import { ApplicationTable } from '../components/applications/ApplicationTable'
import { QueueSummary } from '../components/applications/QueueSummary'
import { Card, ErrorNotice, Loading, Page } from '../components/common'
import { applicationState, latestRun } from '../domain/types'
import { applicationIntakeYear, normalizeIntakeYear } from '../domain/intakes'
import { batchApplications } from '../domain/batches'

export function ApplicationsPage() {
  const content = useContent('applicationsPage')
  const {
    programme: selectedProgramme,
    programmes,
    intakeYear,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace()
  const { batchId } = useParams()
  const batchQuery = useBatchQuery(batchId ?? '', { skip: !batchId })
  const batch = batchQuery.currentData
  const programme = batchId
    ? programmes.find((p) => p.id === batch?.programmeId)
    : selectedProgramme
  const {
    currentData: applications,
    error,
    isLoading,
  } = useApplicationsQuery(programme?.id ?? '', { skip: !programme, pollingInterval: 1000 })
  const [status, setStatus] = useState('all')
  const [recommendation, setRecommendation] = useState('all')
  const [search, setSearch] = useState('')
  if (isLoading || workspaceLoading || (batchId && batchQuery.isLoading)) return <Loading />
  if (batchId && (!batch || !programme))
    return <ErrorNotice error={batchQuery.error ?? content.batchUnavailable} />
  if (workspaceError) return <ErrorNotice error={workspaceError} />
  if (!programme) return <Alert severity="info">{content.noWorkspaceMessage}</Alert>
  const currentYear =
    batch?.intakeYear ??
    normalizeIntakeYear(intakeYear ?? programme.year) ??
    intakeYear ??
    programme.year
  const scopedApplications = batch ? batchApplications(batch, applications ?? []) : applications
  const intakeApplications = scopedApplications?.filter(
    (a) => applicationIntakeYear(a, programme) === currentYear,
  )
  const filtered =
    intakeApplications?.filter(
      (a) =>
        (status === 'all' || applicationState(a) === status) &&
        (recommendation === 'all' || latestRun(a)?.recommendation === recommendation) &&
        `${a.id} ${a.candidate}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? []
  return (
    <Page
      title={content.applications}
      subtitle={content.subtitle(programme.name, currentYear)}
      actions={
        <>
          {!batchId && (
            <Button variant="contained" startIcon={<Add />} component={Link} to="/applications/new">
              {content.newApplication}
            </Button>
          )}
          <Button component={Link} to="/batches" startIcon={<ArrowBackOutlined />}>
            {content.back}
          </Button>
        </>
      }
    >
      <ErrorNotice error={error ?? workspaceError} />
      {batch && (
        <Typography variant="h5" component="h2" sx={{ overflowWrap: 'anywhere' }}>
          {content.batchName(batch.sequence)}
        </Typography>
      )}
      {batch?.source === 'zip' && (
        <Typography variant="body2" color="text.secondary">
          {batch.filename}
        </Typography>
      )}
      <QueueSummary applications={intakeApplications} />
      <Card title={content.applicationQueue}>
        <ApplicationFilters
          search={search}
          status={status}
          recommendation={recommendation}
          setSearch={setSearch}
          setStatus={setStatus}
          setRecommendation={setRecommendation}
        />
        <ApplicationTable filtered={filtered} />
        {!filtered.length && (
          <Typography sx={{ py: 3 }}>{content.noApplicationsMatchTheseFilters}</Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          {content.recommendationHint}
        </Typography>
      </Card>
    </Page>
  )
}
