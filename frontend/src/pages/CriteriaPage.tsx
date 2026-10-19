import { useContent } from '../hooks/useContent'
import { Alert } from '@mui/material'
import { useRef, useState } from 'react'
import { useCommandMutation, useRubricsQuery } from '../app/api'
import { useWorkspace } from '../app/workspace'
import { ErrorNotice, Loading } from '../components/common'
import { CriteriaForm } from '../components/criteria/CriteriaForm'
import { criteriaChanged, validateRubric } from '../domain/rules'
import type { Rubric, SectionKey } from '../domain/types'

export function CriteriaPage() {
  const content = useContent('criteriaPage')
  const { user, programme, isLoading: workspaceLoading, error: workspaceError } = useWorkspace()
  const {
    currentData: data,
    isLoading,
    error,
  } = useRubricsQuery(programme?.id ?? '', { skip: !programme })
  if (isLoading || workspaceLoading) return <Loading />
  if (workspaceError) return <ErrorNotice error={workspaceError} />
  if (!programme) return <Alert severity="info">{content.noWorkspaceMessage}</Alert>
  const active = data?.rubrics.find((r) => r.id === data.activeId)
  if (!data || !active) return <ErrorNotice error={error ?? content.criteriaUnavailable} />
  const canEdit = Boolean(
    user?.active && user.roles.includes('tutor') && programme.createdBy === user.id,
  )
  return (
    <CriteriaEditor
      key={`${programme.id}:${active.id}`}
      active={active}
      history={data.rubrics}
      canEdit={canEdit}
      queryError={error}
    />
  )
}

// Drafts belong to this page and reset when the course or active version changes.
function CriteriaEditor({
  active,
  history,
  canEdit,
  queryError,
}: {
  active: Rubric
  history: Rubric[]
  canEdit: boolean
  queryError?: unknown
}) {
  const [draft, setDraft] = useState(() => structuredClone(active))
  const [selectedVersionId, setSelectedVersionId] = useState(active.id)
  const formRef = useRef<HTMLFormElement>(null)
  const [command, mutation] = useCommandMutation()
  const [saved, setSaved] = useState(false)
  const total = Object.values(draft.weights).reduce((a, b) => a + b, 0)
  const validationError = validateRubric(draft)
  const invalidWeights = Boolean(validateRubric({ ...active, weights: draft.weights }))
  const dirty = criteriaChanged(draft, active)
  const disabled = !canEdit || mutation.isLoading || saved
  const loadedVersion =
    selectedVersionId === active.id
      ? undefined
      : history.find((version) => version.id === selectedVersionId)?.version
  function loadVersion(id: string) {
    if (disabled) return
    const selected = history.find(
      (version) => version.id === id && version.programmeId === active.programmeId,
    )
    if (!selected) return
    // Copy supported settings while retaining the current version as the save base.
    setDraft({
      ...structuredClone(active),
      weights: { ...selected.weights },
      rejectBelow: selected.rejectBelow,
      offerFrom: selected.offerFrom,
      margin: selected.margin,
    })
    setSelectedVersionId(selected.id)
    formRef.current?.focus({ preventScroll: true })
    formRef.current?.scrollIntoView?.({ behavior: 'auto', block: 'start' })
  }
  function reset() {
    setDraft(structuredClone(active))
    setSelectedVersionId(active.id)
  }
  function changeWeight(key: SectionKey, value: string) {
    setDraft((current) => ({
      ...current,
      weights: { ...current.weights, [key]: value.trim() ? Number(value) : NaN },
    }))
  }
  function changeThreshold(key: 'rejectBelow' | 'offerFrom' | 'margin', value: string) {
    setDraft((current) => ({ ...current, [key]: value.trim() ? Number(value) : NaN }))
  }
  async function submit() {
    if (disabled || !dirty || validationError) return
    try {
      await command({ op: 'rubric', rubric: draft }).unwrap()
      setSaved(true)
    } catch {
      /* Keep the draft and show the mutation error for retry. */
    }
  }
  return (
    <CriteriaForm
      active={active}
      formRef={formRef}
      draft={draft}
      history={history}
      selectedVersionId={selectedVersionId}
      loadedVersion={loadedVersion}
      loadVersion={loadVersion}
      total={total}
      invalidWeights={invalidWeights}
      canEdit={canEdit}
      disabled={disabled}
      dirty={dirty}
      validationError={validationError}
      mutation={{ isLoading: mutation.isLoading, error: mutation.error ?? queryError }}
      changeWeight={changeWeight}
      changeThreshold={changeThreshold}
      submit={submit}
      reset={reset}
    />
  )
}
