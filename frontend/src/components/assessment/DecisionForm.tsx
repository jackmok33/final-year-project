import { useContent } from '../../hooks/useContent'
import { Alert, Button, Divider, Stack, TextField, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import {
  type Application,
  type AssessmentRun,
  type DocumentRecord,
  type Outcome,
  type Rubric,
} from '../../domain/types'
import { Card, ErrorNotice, Page, Rationale, TwoColumns } from '../common'
import { DecisionRecord } from './DecisionRecord'
import { OutcomeOptions } from './OutcomeOptions'

export function DecisionForm({
  app,
  run,
  rubric,
  documents,
  userName,
  outcome,
  setOutcome,
  reason,
  setReason,
  mutation,
  critical,
  disabled,
  record,
}: {
  app: Application
  run: AssessmentRun
  rubric: Rubric | undefined
  documents: DocumentRecord[]
  userName: string | undefined
  outcome: Outcome
  setOutcome: (outcome: Outcome) => void
  reason: string
  setReason: (reason: string) => void
  mutation: { isLoading: boolean; error?: unknown }
  critical: boolean
  disabled: boolean
  record: () => void
}) {
  const content = useContent('decisionForm')
  return (
    <Page title={content.recordTutorDecision} subtitle={content.subtitle(app.id, rubric?.version)}>
      <TwoColumns>
        <Card title={content.reviewOutcome}>
          {critical && <Alert severity="warning">{content.criticalWarning}</Alert>}
          <Typography sx={{ fontWeight: 600 }}>
            {content.aiRecommendation(run.recommendation)}
          </Typography>
          <Typography>{content.overallScore(run.overall)}</Typography>
          <Rationale run={run} rubric={rubric} documents={documents} applicationId={app.id} />
          <Divider />
          <OutcomeOptions outcome={outcome} setOutcome={setOutcome} critical={critical} />
          <TextField
            label={content.reviewNote}
            multiline
            minRows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <ErrorNotice error={mutation.error} />
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button variant="contained" disabled={disabled} onClick={record}>
              {content.recordAction(outcome)}
            </Button>
            <Button component={Link} to={`/applications/${app.id}`}>
              {content.backToAssessment}
            </Button>
          </Stack>
        </Card>
        <DecisionRecord app={app} run={run} userName={userName} />
      </TwoColumns>
    </Page>
  )
}
