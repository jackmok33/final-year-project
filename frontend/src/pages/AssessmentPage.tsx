import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import ArrowLeftOutlined from '@ant-design/icons/ArrowLeftOutlined'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useApplicationQuery, useApplicationsQuery, useCommandMutation } from '../app/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { RecommendationSummary } from '../components/assessment/RecommendationSummary'
import { ReviewFlags } from '../components/assessment/ReviewFlags'
import { SectionAssessments } from '../components/assessment/SectionAssessments'
import { RecommendationPanel } from '../components/assessment/RecommendationPanel'
import { ErrorNotice, Loading, Page } from '../components/common'
import TabsCard from '../mantis/components/TabsCard'
import MainCard from '../mantis/components/MainCard'
import { applicantEvidence, applicantProfile } from '../services/applicantPresentation'
import { programmeIntakeLabel } from '../domain/programmeDisplay'
import {
  isAssessmentReady,
  latestDecision,
  latestRun,
  type Application,
  type DocumentRecord,
} from '../domain/types'
import { useContent } from '../hooks/useContent'
import { EvidencePage } from './EvidencePage'
import { DecisionPage } from './DecisionPage'

export function AssessmentPage() {
  const { id = '' } = useParams()
  const { currentData: data, error } = useApplicationQuery(id, { pollingInterval: 1000 })
  if (!data) return error ? <ErrorNotice error={error} /> : <Loading />
  return (
    <AssessmentReview
      key={data.application.id}
      app={data.application}
      documents={data.documents}
      queryError={error}
    />
  )
}

function AssessmentReview({
  app,
  documents,
  queryError,
}: {
  app: Application
  documents: DocumentRecord[]
  queryError?: unknown
}) {
  const content = useContent('assessmentPage')
  const { programmes } = useWorkspace()
  const programme = programmes.find((p) => p.id === app.programmeId)
  const applications = useApplicationsQuery(app.programmeId)
  const [command, mutation] = useCommandMutation()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const latest = latestRun(app)
  const run = app.runs.find((r) => r.id === params.get('run')) ?? latest
  const historic = run !== latest
  const busy = ['queued', 'running'].includes(latest?.status ?? '')
  const assessed = isAssessmentReady(run)
  const canCorrect = Boolean(assessed && !historic && !busy && run?.extractedGrade !== null)
  const decisionOpen =
    location.pathname.endsWith('/decision') ||
    params.get('tab') === 'decision' ||
    params.get('decision') === 'record'
  const tab = location.pathname.endsWith('/evidence')
    ? 'documents'
    : (params.get('tab') ?? 'recommendation')
  const validTab = ['recommendation', 'flags', 'scores', 'documents'].includes(tab)
    ? tab
    : 'recommendation'
  const profile = applicantProfile(app)
  const ordinal = Math.max(
    1,
    (applications.currentData
      ?.filter((a) => a.batchId === app.batchId)
      .findIndex((a) => a.id === app.id) ?? 0) + 1,
  )
  function selectTab(next: string) {
    const query = new URLSearchParams()
    if (historic && run) query.set('run', run.id)
    if (next === 'documents')
      navigate(
        `/applications/${encodeURIComponent(app.id)}/evidence${query.size ? `?${query}` : ''}`,
      )
    else {
      query.set('tab', next)
      navigate(`/applications/${encodeURIComponent(app.id)}?${query}`)
    }
  }
  function openDecision() {
    const query = new URLSearchParams(params)
    query.set('decision', 'record')
    navigate(`${location.pathname}?${query}`)
  }
  function closeDecision() {
    const query = new URLSearchParams(params)
    query.delete('decision')
    if (query.get('tab') === 'decision') query.delete('tab')
    const path = location.pathname.endsWith('/decision')
      ? `/applications/${encodeURIComponent(app.id)}`
      : location.pathname
    navigate(`${path}${query.size ? `?${query}` : ''}`, { replace: true })
  }
  function evaluate() {
    if (mutation.isLoading || busy || historic) return
    if (params.has('run')) {
      const query = new URLSearchParams(params)
      query.delete('run')
      navigate(`${location.pathname}${query.size ? `?${query}` : ''}`, { replace: true })
    }
    void command({ op: 'evaluate', id: app.id })
  }
  const back = app.batchId ? `/batches/${encodeURIComponent(app.batchId)}` : '/applications'
  return (
    <Page
      title={
        programme
          ? programmeIntakeLabel(programme, app.intakeYear ?? programme.year)
          : content.programme
      }
      actions={
        <Button component={Link} to={back} startIcon={<ArrowLeftOutlined aria-hidden="true" />}>
          {content.back}
        </Button>
      }
    >
      <ErrorNotice error={queryError ?? mutation.error} />
      <Typography variant="h2" component="h2" color="text.secondary">
        {content.applicantHeading(ordinal, profile.name, profile.studentId)}
      </Typography>
      {busy && (
        <Alert severity="info" role="status">
          {content.processingMessage(latest?.status)}
        </Alert>
      )}
      {historic && (
        <Alert
          severity="info"
          action={
            <Button
              onClick={() => {
                navigate(`/applications/${encodeURIComponent(app.id)}`)
              }}
            >
              {content.showLatest}
            </Button>
          }
        >
          {content.historicRunNotice}
        </Alert>
      )}
      {run ? (
        <RecommendationSummary
          run={run}
          decision={
            historic ? app.decisions.findLast((d) => d.runId === run.id) : latestDecision(app)
          }
          actions={
            <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={evaluate}
                disabled={mutation.isLoading || busy || historic}
              >
                {content.reEvaluate}
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={openDecision}
                disabled={!assessed || busy || historic || mutation.isLoading}
              >
                {content.decision}
              </Button>
            </Stack>
          }
        />
      ) : (
        <MainCard>
          <Typography>{content.readyForReview}</Typography>
          <Button onClick={evaluate} disabled={mutation.isLoading}>
            {content.requestEvaluation}
          </Button>
        </MainCard>
      )}
      <TabsCard
        value={validTab}
        onChange={selectTab}
        label={content.reviewTabs}
        minHeight={560}
        tabs={[
          {
            value: 'recommendation',
            label: content.aiRecommendation,
            content: (
              <RecommendationPanel
                applicationId={app.id}
                run={assessed ? run : undefined}
                documents={documents}
                groups={run ? applicantEvidence(app, run) : []}
              />
            ),
          },
          {
            value: 'flags',
            label: content.reviewFlags,
            content: run ? (
              <Box sx={{ p: 2.5 }}>
                <ReviewFlags run={run} id={app.id} canCorrect={canCorrect} />
              </Box>
            ) : (
              <Box sx={{ p: 4 }}>{content.noFlags}</Box>
            ),
          },
          {
            value: 'scores',
            label: content.scoreBreakdown,
            content:
              assessed && run ? (
                <Box sx={{ p: 3 }}>
                  <SectionAssessments run={run} documents={documents} id={app.id} />
                </Box>
              ) : (
                <Box sx={{ p: 4 }}>{content.noEvidence}</Box>
              ),
          },
          { value: 'documents', label: content.documents, content: <EvidencePage /> },
        ]}
      />
      {decisionOpen && <DecisionPage onClose={closeDecision} readOnly={historic} />}
    </Page>
  )
}
