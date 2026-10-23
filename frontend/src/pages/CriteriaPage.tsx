import { useContent } from '../hooks/useContent'
import { Alert } from '@mui/material'
import { useState } from 'react'
import { useCommandMutation, useRubricsQuery } from '../app/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { ErrorNotice, Loading } from '../components/common'
import { CriteriaForm } from '../components/criteria/CriteriaForm'
import { criteriaChanged, validateRubric } from '../domain/rules'
import type { Rubric, SectionKey } from '../domain/types'

export function CriteriaPage({ programmeId }: { programmeId?: string } = {}) {
  const content = useContent('criteriaPage')
  const {
    user,
    programmes,
    programme: selected,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace()
  const programme = programmeId ? programmes.find((item) => item.id === programmeId) : selected
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
      canEdit={canEdit}
      queryError={error}
    />
  )
}

// Drafts belong to this page and reset when the course or active version changes.
function CriteriaEditor({
  active,
  canEdit,
  queryError,
}: {
  active: Rubric
  canEdit: boolean
  queryError?: unknown
}) {
  const [draft, setDraft] = useState(() => structuredClone(active))
  const [command, mutation] = useCommandMutation()
  const [saved, setSaved] = useState(false)
  const total = Object.values(draft.weights).reduce((a, b) => a + b, 0)
  const validationError = validateRubric(draft)
  const invalidWeights = Boolean(validateRubric({ ...active, weights: draft.weights }))
  const dirty = criteriaChanged(draft, active)
  const disabled = !canEdit || mutation.isLoading || saved
  function reset() {
    setDraft(structuredClone(active))
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
      draft={draft}
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
