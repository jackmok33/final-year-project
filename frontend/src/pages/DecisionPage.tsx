import { Alert } from '@mui/material'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApplicationQuery, useCommandMutation } from '../app/api'
import { applicationPath, matchesRouteScope } from '../app/paths'
import { applicationIntakeYear } from '../domain/intakes'
import { DecisionForm } from '../components/assessment/DecisionForm'
import CustomizedDialog from '../mantis/components/CustomizedDialog'
import { ErrorNotice, Loading } from '../components/common'
import { isAssessmentReady, latestRun, type TutorOutcome } from '../domain/types'
import { useContent } from '../hooks/useContent'
import { useIsMounted } from '../hooks/useIsMounted'
import { useWorkspace } from '../hooks/useWorkspace'

export function DecisionPage({
  onClose,
  readOnly = false,
}: {
  onClose?: () => void
  readOnly?: boolean
} = {}) {
  const content = useContent('decisionPage')
  const routeParams = useParams()
  const { id = '' } = routeParams
  const { programmes, isLoading: workspaceLoading } = useWorkspace()
  const { currentData: data, error } = useApplicationQuery(id, { pollingInterval: 1000 })
  const [command, mutation] = useCommandMutation()
  const navigate = useNavigate()
  const isMounted = useIsMounted()
  const run = data && latestRun(data.application)
  const app = data?.application
  const programme = programmes.find((candidate) => candidate.id === app?.programmeId)
  const scope = {
    programmeId: app?.programmeId ?? '',
    intakeYear: app && programme ? applicationIntakeYear(app, programme) : (app?.intakeYear ?? ''),
    batchId: app?.batchId,
  }
  const validScope = Boolean(
    app &&
    matchesRouteScope(routeParams, scope) &&
    (!routeParams.programmeId || programme) &&
    (routeParams.id === undefined || routeParams.id === app.id),
  )
  const basePath = applicationPath({ ...scope, applicationId: app?.id ?? id })
  function close() {
    if (onClose) onClose()
    else if (validScope) navigate(basePath)
  }
  async function save(outcome: TutorOutcome, reason: string) {
    if (!app || !validScope || !run || !isAssessmentReady(run) || readOnly || mutation.isLoading)
      return
    try {
      await command({ op: 'decide', id: app.id, runId: run.id, outcome, reason }).unwrap()
      if (isMounted()) close()
    } catch {
      /* Keep the draft for retry. */
    }
  }
  return (
    <CustomizedDialog
      open
      title={content.title}
      closeLabel={content.close}
      onClose={close}
      busy={mutation.isLoading}
    >
      {!data || (routeParams.programmeId && workspaceLoading) ? (
        error ? (
          <ErrorNotice error={error} />
        ) : (
          <Loading />
        )
      ) : !validScope ? (
        <ErrorNotice error={content.applicationUnavailable} />
      ) : readOnly ? (
        <Alert severity="info">{content.readOnly}</Alert>
      ) : !run || !isAssessmentReady(run) ? (
        <Alert severity="info">{content.assessmentRequired}</Alert>
      ) : (
        <DecisionEditor
          key={`${data.application.id}:${run.id}`}
          saving={mutation.isLoading}
          error={mutation.error ?? error}
          save={(outcome, reason) => void save(outcome, reason)}
          cancel={close}
        />
      )}
    </CustomizedDialog>
  )
}

function DecisionEditor({
  saving,
  error,
  save,
  cancel,
}: {
  saving: boolean
  error?: unknown
  save: (outcome: TutorOutcome, reason: string) => void
  cancel: () => void
}) {
  const [outcome, setOutcome] = useState<TutorOutcome>('Conditional')
  const [reason, setReason] = useState('')
  return (
    <DecisionForm
      outcome={outcome}
      setOutcome={setOutcome}
      reason={reason}
      setReason={setReason}
      error={error}
      disabled={saving}
      saving={saving}
      onCancel={cancel}
      record={() => save(outcome, reason)}
    />
  )
}
