import { Alert } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApplicationQuery, useCommandMutation } from '../app/api'
import { DecisionForm } from '../components/assessment/DecisionForm'
import CustomizedDialog from '../mantis/components/CustomizedDialog'
import { ErrorNotice, Loading } from '../components/common'
import { isAssessmentReady, latestRun, type TutorOutcome } from '../domain/types'
import { useContent } from '../hooks/useContent'

export function DecisionPage({
  onClose,
  readOnly = false,
}: {
  onClose?: () => void
  readOnly?: boolean
} = {}) {
  const content = useContent('decisionPage')
  const { id = '' } = useParams()
  const { currentData: data, error } = useApplicationQuery(id, { pollingInterval: 1000 })
  const [command, mutation] = useCommandMutation()
  const navigate = useNavigate()
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const run = data && latestRun(data.application)
  const critical = run?.flags.some((flag) => flag.critical) ?? false
  function close() {
    if (onClose) onClose()
    else navigate(`/applications/${encodeURIComponent(id)}`)
  }
  async function save(outcome: TutorOutcome, reason: string) {
    if (!run || !isAssessmentReady(run) || readOnly || critical || mutation.isLoading) return
    try {
      await command({ op: 'decide', id, runId: run.id, outcome, reason }).unwrap()
      if (active.current) close()
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
      {!data ? (
        error ? (
          <ErrorNotice error={error} />
        ) : (
          <Loading />
        )
      ) : readOnly ? (
        <Alert severity="info">{content.readOnly}</Alert>
      ) : !run || !isAssessmentReady(run) ? (
        <Alert severity="info">{content.assessmentRequired}</Alert>
      ) : (
        <DecisionEditor
          key={`${data.application.id}:${run.id}`}
          critical={critical}
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
  critical,
  saving,
  error,
  save,
  cancel,
}: {
  critical: boolean
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
      critical={critical}
      disabled={saving || critical}
      saving={saving}
      onCancel={cancel}
      record={() => save(outcome, reason)}
    />
  )
}
