import { useContent } from '../hooks/useContent'
import { Add, DownloadOutlined } from '@mui/icons-material'
import { Alert, Button, Typography } from '@mui/material'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApplicationsQuery, useRubricsQuery } from '../app/api'
import { useWorkspace } from '../app/workspace'
import { ApplicationFilters } from '../components/applications/ApplicationFilters'
import { ApplicationTable } from '../components/applications/ApplicationTable'
import { QueueSummary } from '../components/applications/QueueSummary'
import { Card, ErrorNotice, Loading, Page } from '../components/common'
import { downloadBlob } from '../components/files'
import { csvCell } from '../domain/rules'
import { applicationState, latestDecision, latestRun } from '../domain/types'

export function ApplicationsPage() {
  const content = useContent('applicationsPage')
  const { programme, isLoading: workspaceLoading, error: workspaceError } = useWorkspace()
  const {
    currentData: applications,
    error,
    isLoading,
  } = useApplicationsQuery(programme?.id ?? '', { skip: !programme, pollingInterval: 1000 })
  const { currentData: criteria } = useRubricsQuery(programme?.id ?? '', { skip: !programme })
  const [status, setStatus] = useState('all')
  const [recommendation, setRecommendation] = useState('all')
  const [search, setSearch] = useState('')
  if (isLoading || workspaceLoading) return <Loading />
  if (workspaceError) return <ErrorNotice error={workspaceError} />
  if (!programme) return <Alert severity="info">{content.noWorkspaceMessage}</Alert>
  const filtered =
    applications?.filter(
      (a) =>
        (status === 'all' || applicationState(a) === status) &&
        (recommendation === 'all' || latestRun(a)?.recommendation === recommendation) &&
        `${a.id} ${a.candidate}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? []
  function exportCsv() {
    const rows: unknown[][] = [
      [
        content.application,
        content.candidate,
        content.programme,
        content.state,
        content.overallScore,
        content.recommendation,
        content.tutorDecision,
        content.criteriaVersion,
      ],
    ]
    filtered.forEach((a) => {
      const run = latestRun(a)
      rows.push([
        a.id,
        a.candidate,
        programme?.name,
        applicationState(a),
        run?.overall,
        run?.recommendation,
        latestDecision(a)?.outcome,
        criteria?.rubrics.find((r) => r.id === run?.rubricId)?.version,
      ])
    })
    downloadBlob(
      new Blob(['\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
      'admissions-demo-results.csv',
    )
  }
  return (
    <Page
      title={content.applications}
      subtitle={content.subtitle(programme?.name ?? content.programmeFallback)}
      actions={
        <>
          <Button variant="contained" startIcon={<Add />} component={Link} to="/applications/new">
            {content.newApplication}
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadOutlined />}
            onClick={exportCsv}
            disabled={!filtered.length}
          >
            {content.exportFilteredResults}
          </Button>
        </>
      }
    >
      <ErrorNotice error={error ?? workspaceError} />
      <QueueSummary applications={applications} />
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
