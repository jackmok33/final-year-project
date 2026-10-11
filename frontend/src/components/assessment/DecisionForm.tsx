import { useContent } from '../../hooks/useContent'
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Link } from 'react-router-dom'
import {
  type Application,
  type AssessmentRun,
  type DocumentRecord,
  type Outcome,
  type Rubric,
} from '../../domain/types'
import { Card, Confirm, ErrorNotice, Page, Rationale, TwoColumns } from '../common'
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
  confirmed,
  setConfirmed,
  open,
  setOpen,
  mutation,
  critical,
  override,
  disabled,
  save,
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
  confirmed: boolean
  setConfirmed: (confirmed: boolean) => void
  open: boolean
  setOpen: (open: boolean) => void
  mutation: { isLoading: boolean; error?: unknown }
  critical: boolean
  override: boolean
  disabled: boolean
  save: () => Promise<void>
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
            label={override ? content.reasonForOverride : content.reviewNote}
            required={override}
            multiline
            minRows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                color="secondary"
              />
            }
            label={content.reviewConfirmation}
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
      <Confirm
        open={open}
        title={content.confirmationTitle(outcome)}
        onClose={() => setOpen(false)}
        onConfirm={() => void save()}
        busy={mutation.isLoading}
      >
        <Typography>{content.confirmationBody(outcome, app.id, rubric?.version)}</Typography>
        {override && <Typography sx={{ mt: 2 }}>{content.overrideReason(reason)}</Typography>}
      </Confirm>
    </Page>
  )
}
