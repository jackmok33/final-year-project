import { useContent } from '../hooks/useContent'
import { Alert, Button, Typography } from '@mui/material'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApplicationQuery, useCommandMutation } from '../app/api'
import { AssessmentActions } from '../components/assessment/AssessmentActions'
import { RecommendationSummary } from '../components/assessment/RecommendationSummary'
import { ReviewFlags } from '../components/assessment/ReviewFlags'
import { RunHistory } from '../components/assessment/RunHistory'
import { SectionAssessments } from '../components/assessment/SectionAssessments'
import { Card, ErrorNotice, Loading, Page, Rationale, TwoColumns } from '../components/common'
import { displayTime } from '../components/files'
import {
  hasUnavailableAssessment,
  latestDecision,
  latestRun,
  type Application,
  type DocumentRecord,
  type Rubric,
} from '../domain/types'

export function AssessmentPage() {
  const { id = '' } = useParams()
  const { currentData: data, error } = useApplicationQuery(id, { pollingInterval: 1000 })
  if (!data) return error ? <ErrorNotice error={error} /> : <Loading />
  return (
    <AssessmentReview
      key={data.application.id}
      app={data.application}
      documents={data.documents}
      rubrics={data.rubrics}
      queryError={error}
    />
  )
}

// Keep review state in the page and reset it when navigating to another application.
function AssessmentReview({
  app,
  documents,
  rubrics,
  queryError,
}: {
  app: Application
  documents: DocumentRecord[]
  rubrics: Rubric[]
  queryError?: unknown
}) {
  const content = useContent('assessmentPage')
  const id = app.id
  const [command, mutation] = useCommandMutation()
  const [selectedRunId, setSelectedRunId] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const latest = latestRun(app)
  const run = app.runs.find((r) => r.id === selectedRunId) ?? latest
  const rubric = rubrics.find((r) => r.id === run?.rubricId)
  const inProgress = ['queued', 'running'].includes(latest?.status ?? '')
  const historic = run !== latest
  const assessed = Boolean(
    run && !['queued', 'running', 'failed'].includes(run.status) && !hasUnavailableAssessment(run),
  )
  const canCorrect = Boolean(assessed && !historic && !inProgress && run?.extractedGrade !== null)
  const hasConcerns = run?.flags.some((flag) => flag.code !== 'BACKEND_UNAVAILABLE') ?? false
  const rationale = run && (
    <Card>
      <Rationale run={run} rubric={rubric} documents={documents} applicationId={id} compact />
    </Card>
  )
  function evaluate() {
    setSelectedRunId('')
    void command({ op: 'evaluate', id })
  }
  return (
    <Page
      title={app.id}
      subtitle={content.subtitle(app.candidate, displayTime(app.submittedAt))}
      actions={<AssessmentActions app={app} id={id} />}
    >
      <ErrorNotice error={queryError || mutation.error} />
      {inProgress && (
        <Alert severity="info" role="status">
          {content.processingMessage(latest?.status)}
        </Alert>
      )}
      {historic && (
        <Alert
          severity="info"
          action={<Button onClick={() => setSelectedRunId('')}>{content.showLatest}</Button>}
        >
          {content.historicRunNotice}
        </Alert>
      )}
      {!run ? (
        <Card title={content.readyForReview}>
          <Typography>{content.uploadDescription}</Typography>
          <Button
            variant="contained"
            onClick={evaluate}
            disabled={mutation.isLoading}
            sx={{ alignSelf: 'flex-start' }}
          >
            {content.requestEvaluation}
          </Button>
        </Card>
      ) : (
        <>
          <RecommendationSummary
            run={run}
            id={id}
            decision={
              historic ? app.decisions.findLast((d) => d.runId === run.id) : latestDecision(app)
            }
            canDecide={assessed && !historic && !inProgress}
          />
          <ReviewFlags run={run} id={id} canCorrect={canCorrect} />
          {assessed ? (
            <TwoColumns>
              {rationale}
              <SectionAssessments
                run={run}
                rubric={rubric}
                documents={documents}
                id={id}
                canCorrect={canCorrect && !hasConcerns}
              />
            </TwoColumns>
          ) : !inProgress ? (
            rationale
          ) : null}
          <RunHistory
            app={app}
            run={run}
            rubrics={rubrics}
            setSelectedRunId={setSelectedRunId}
            expanded={historyOpen}
            onExpandedChange={setHistoryOpen}
            onEvaluate={evaluate}
            evaluationDisabled={mutation.isLoading || inProgress || historic}
          />
        </>
      )}
    </Page>
  )
}
