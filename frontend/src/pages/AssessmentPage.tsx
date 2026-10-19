import { useContent } from '../hooks/useContent'
import { Alert, Box, Typography } from '@mui/material'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApplicationQuery, useCommandMutation } from '../app/api'
import { AssessmentActions } from '../components/assessment/AssessmentActions'
import { RecommendationSummary } from '../components/assessment/RecommendationSummary'
import { ReviewFlags } from '../components/assessment/ReviewFlags'
import { RunHistory } from '../components/assessment/RunHistory'
import { SectionAssessments } from '../components/assessment/SectionAssessments'
import { Card, ErrorNotice, Loading, Page, TwoColumns } from '../components/common'
import { displayTime } from '../components/files'
import { latestDecision, latestRun } from '../domain/types'

export function AssessmentPage() {
  const content = useContent('assessmentPage')
  const { id = '' } = useParams()
  const { data, error, isLoading } = useApplicationQuery(id, { pollingInterval: 1000 })
  const [command, mutation] = useCommandMutation()
  const [selectedRunId, setSelectedRunId] = useState('')
  if (isLoading) return <Loading />
  if (!data) return <ErrorNotice error={error} />
  const { application: app, documents, rubrics } = data
  const run = app.runs.find((r) => r.id === selectedRunId) ?? latestRun(app)
  const latest = latestRun(app)
  const decision = latestDecision(app)
  const rubric = rubrics.find((r) => r.id === run?.rubricId)
  const inProgress = ['queued', 'running'].includes(latest?.status ?? '')
  return (
    <Page
      title={app.id}
      subtitle={content.subtitle(app.candidate, displayTime(app.submittedAt))}
      actions={
        <AssessmentActions
          app={app}
          id={id}
          latest={latest}
          inProgress={inProgress}
          busy={mutation.isLoading}
          onEvaluate={() => void command({ op: 'evaluate', id })}
        />
      }
    >
      <ErrorNotice error={error || mutation.error} />
      {inProgress && (
        <Alert severity="info" role="status">
          {content.processingMessage(latest?.status)}
        </Alert>
      )}
      {!run ? (
        <Card title={content.readyForReview}>
          <Typography>{content.uploadDescription}</Typography>
        </Card>
      ) : (
        <>
          {run !== latest && <Alert severity="info">{content.historicRunNotice}</Alert>}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px, 1fr) minmax(0, 2fr)' },
              gap: 3,
              alignItems: 'start',
            }}
          >
            <RecommendationSummary
              run={run}
              rubric={rubric}
              documents={documents}
              id={id}
              decision={decision}
            />
            <SectionAssessments run={run} rubric={rubric} documents={documents} id={id} />
          </Box>
          <TwoColumns equal>
            <ReviewFlags run={run} id={id} inProgress={inProgress} latest={latest} />
            <RunHistory app={app} run={run} rubrics={rubrics} setSelectedRunId={setSelectedRunId} />
          </TwoColumns>
        </>
      )}
    </Page>
  )
}
