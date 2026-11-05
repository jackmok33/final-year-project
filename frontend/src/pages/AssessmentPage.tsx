import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  useApplicationQuery,
  useApplicationsQuery,
  useBatchQuery,
  useCommandMutation,
} from '../app/api'
import {
  applicationPath,
  batchPath,
  intakePath,
  matchesRouteScope,
  PROGRAMMES_PATH,
} from '../app/paths'
import { useWorkspace } from '../hooks/useWorkspace'
import { RecommendationSummary } from '../components/assessment/RecommendationSummary'
import { ReviewFlags } from '../components/assessment/ReviewFlags'
import { SectionAssessments } from '../components/assessment/SectionAssessments'
import { RecommendationPanel } from '../components/assessment/RecommendationPanel'
import { ErrorNotice, Loading, Page } from '../components/common'
import TabsCard from '../mantis/components/TabsCard'
import MainCard from '../mantis/components/MainCard'
import { applicantEvidence, applicantProfile } from '../services/applicantPresentation'
import { presentAssessment } from '../services/assessmentNarrative'
import { programmeIntakeLabel } from '../domain/programmeDisplay'
import { applicationIntakeYear, normalizeIntakeYear } from '../domain/intakes'
import {
  isAssessmentReady,
  latestDecision,
  latestRun,
  type Application,
  type Rubric,
} from '../domain/types'
import { useContent } from '../hooks/useContent'
import { EvidencePage } from './EvidencePage'
import { DecisionPage } from './DecisionPage'
import { CorrectionPage } from './CorrectionPage'

export function AssessmentPage() {
  const { id = '' } = useParams()
  const { currentData: data, error } = useApplicationQuery(id, { pollingInterval: 1000 })
  if (!data) return error ? <ErrorNotice error={error} /> : <Loading />
  return (
    <AssessmentReview
      key={data.application.id}
      app={data.application}
      rubrics={data.rubrics}
      queryError={error}
    />
  )
}

function AssessmentReview({
  app,
  rubrics,
  queryError,
}: {
  app: Application
  rubrics: Rubric[]
  queryError?: unknown
}) {
  const content = useContent('assessmentPage')
  const { programmes, isLoading: workspaceLoading, error: workspaceError } = useWorkspace()
  const routeParams = useParams()
  const programme = programmes.find((p) => p.id === app.programmeId)
  const applications = useApplicationsQuery(app.programmeId)
  const batchQuery = useBatchQuery(app.batchId ?? '', { skip: !app.batchId })
  const batch = app.batchId && !batchQuery.error ? batchQuery.currentData : undefined
  const [command, mutation] = useCommandMutation()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const latest = latestRun(app)
  const run = app.runs.find((r) => r.id === params.get('run')) ?? latest
  const historic = run !== latest
  const displayRun =
    run && !historic
      ? presentAssessment(
          app,
          run,
          rubrics.find((rubric) => rubric.id === run.rubricId),
        )
      : run
  const busy = ['queued', 'running'].includes(latest?.status ?? '')
  const assessed = isAssessmentReady(run)
  const canCorrect = Boolean(assessed && !historic && !busy && run?.extractedGrade !== null)
  const correctionOpen =
    location.pathname.endsWith('/correct') || params.get('correction') === 'edit'
  const decisionOpen =
    location.pathname.endsWith('/decision') ||
    params.get('tab') === 'decision' ||
    params.get('decision') === 'record'
  const tab = location.pathname.endsWith('/evidence')
    ? 'documents'
    : (params.get('tab') ?? (location.pathname.endsWith('/correct') ? 'flags' : 'recommendation'))
  const validTab = ['recommendation', 'flags', 'scores', 'documents'].includes(tab)
    ? tab
    : 'recommendation'
  const profile = applicantProfile(app)
  const intakeYear = programme ? applicationIntakeYear(app, programme) : (app.intakeYear ?? '')
  const scope = { programmeId: app.programmeId, intakeYear, batchId: app.batchId }
  const basePath = applicationPath({ ...scope, applicationId: app.id })
  const contextPath = location.pathname.endsWith('/evidence') ? `${basePath}/evidence` : basePath
  const ordinal = Math.max(
    1,
    (applications.currentData
      ?.filter(
        (a) =>
          a.batchId === app.batchId &&
          (!programme || applicationIntakeYear(a, programme) === intakeYear),
      )
      .findIndex((a) => a.id === app.id) ?? 0) + 1,
  )
  const heading = content.applicantHeading(ordinal, profile.name, profile.studentId)
  if (routeParams.programmeId && (workspaceLoading || (app.batchId && batchQuery.isLoading)))
    return <Loading />
  if (
    !matchesRouteScope(routeParams, scope) ||
    (routeParams.id !== undefined && routeParams.id !== app.id) ||
    (routeParams.programmeId && (!programme || workspaceError || (app.batchId && !batch))) ||
    (batch &&
      (batch.id !== app.batchId ||
        batch.programmeId !== app.programmeId ||
        (normalizeIntakeYear(batch.intakeYear) ?? batch.intakeYear) !== intakeYear))
  )
    return <ErrorNotice error={content.applicationUnavailable} />
  const breadcrumbs = [
    { title: content.programme, to: PROGRAMMES_PATH },
    ...(programme
      ? [{ title: programmeIntakeLabel(programme, intakeYear), to: intakePath(scope) }]
      : []),
    ...(batch?.sequence
      ? [
          {
            title: content.batchName(batch.sequence),
            to: batchPath({ ...scope, batchId: batch.id }),
          },
        ]
      : []),
    { title: heading, to: basePath },
  ]
  function selectTab(next: string) {
    const query = new URLSearchParams(params)
    query.delete('correction')
    query.delete('decision')
    if (historic && run) query.set('run', run.id)
    if (next === 'documents') {
      query.delete('tab')
      navigate(`${basePath}/evidence${query.size ? `?${query}` : ''}`)
    } else {
      query.set('tab', next)
      navigate(`${basePath}?${query}`)
    }
  }
  function openCorrection() {
    const query = new URLSearchParams(params)
    query.set('correction', 'edit')
    navigate(`${contextPath}?${query}`)
  }
  function closeCorrection(saved = false) {
    const query = new URLSearchParams(params)
    query.delete('correction')
    if (saved) query.delete('run')
    const legacyPath = location.pathname.endsWith('/correct')
    if (legacyPath && !query.has('tab')) query.set('tab', 'flags')
    navigate(`${contextPath}${query.size ? `?${query}` : ''}`, { replace: true })
  }
  function openDecision() {
    const query = new URLSearchParams(params)
    query.set('decision', 'record')
    navigate(`${contextPath}?${query}`)
  }
  function closeDecision() {
    const query = new URLSearchParams(params)
    query.delete('decision')
    if (query.get('tab') === 'decision') query.delete('tab')
    navigate(`${contextPath}${query.size ? `?${query}` : ''}`, { replace: true })
  }
  function evaluate() {
    if (mutation.isLoading || busy || historic) return
    if (params.has('run')) {
      const query = new URLSearchParams(params)
      query.delete('run')
      navigate(`${contextPath}${query.size ? `?${query}` : ''}`, { replace: true })
    }
    void command({ op: 'evaluate', id: app.id })
  }
  return (
    <Page title={heading} breadcrumbs={breadcrumbs}>
      <ErrorNotice error={queryError ?? mutation.error} />
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
                navigate(basePath)
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
                run={assessed ? displayRun : undefined}
                groups={run ? applicantEvidence(app, run) : []}
              />
            ),
          },
          {
            value: 'flags',
            label: content.reviewFlags,
            content: run ? (
              <Box sx={{ p: 2.5 }}>
                <ReviewFlags run={run} canCorrect={canCorrect} onCorrect={openCorrection} />
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
                  <SectionAssessments run={displayRun ?? run} />
                </Box>
              ) : (
                <Box sx={{ p: 4 }}>{content.noEvidence}</Box>
              ),
          },
          { value: 'documents', label: content.documents, content: <EvidencePage /> },
        ]}
      />
      {correctionOpen && (
        <CorrectionPage
          onClose={() => closeCorrection()}
          onSaved={() => closeCorrection(true)}
          readOnly={historic}
        />
      )}
      {decisionOpen && <DecisionPage onClose={closeDecision} readOnly={historic} />}
    </Page>
  )
}
