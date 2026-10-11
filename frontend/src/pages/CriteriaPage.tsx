import { useContent } from '../hooks/useContent'
import { Alert } from '@mui/material'
import { useState } from 'react'
import { useCommandMutation, useMeQuery, useRubricsQuery } from '../app/api'
import { useWorkspace } from '../app/workspace'
import { ErrorNotice, Loading } from '../components/common'
import { CriteriaForm } from '../components/criteria/CriteriaForm'
import { validateRubric } from '../domain/rules'
import { type Rubric } from '../domain/types'

export function CriteriaPage() {
  const content = useContent('criteriaPage')
  const { programme, isLoading: workspaceLoading, error: workspaceError } = useWorkspace()
  const {
    currentData: data,
    isLoading,
    error,
  } = useRubricsQuery(programme?.id ?? '', { skip: !programme })
  const { data: user } = useMeQuery()
  if (isLoading || workspaceLoading) return <Loading />
  if (workspaceError) return <ErrorNotice error={workspaceError} />
  if (!programme) return <Alert severity="info">{content.noWorkspaceMessage}</Alert>
  if (!data) return <ErrorNotice error={error ?? workspaceError} />
  const active = data.rubrics.find((r) => r.id === data.activeId)!
  return (
    <CriteriaDraft
      key={active.id}
      active={active}
      history={data.rubrics}
      permitted={!!user?.canPublishCriteria}
    />
  )
}

// Keep the draft tied to the selected record/version without moving page logic into UI components.
function CriteriaDraft({
  active,
  history,
  permitted,
}: {
  active: Rubric
  history: Rubric[]
  permitted: boolean
}) {
  const [rubric, setRubric] = useState<Rubric>(structuredClone(active))
  const [open, setOpen] = useState(false)
  const [command, mutation] = useCommandMutation()
  const error = validateRubric(rubric)
  const total = Object.values(rubric.weights).reduce((a, b) => a + b, 0)
  async function save() {
    try {
      await command({ op: 'rubric', rubric }).unwrap()
      setOpen(false)
    } catch {
      setOpen(false)
    }
  }
  const disabled = !permitted || !!error || mutation.isLoading

  return (
    <CriteriaForm
      active={active}
      history={history}
      permitted={permitted}
      rubric={rubric}
      setRubric={setRubric}
      open={open}
      setOpen={setOpen}
      mutation={mutation}
      error={error}
      total={total}
      save={save}
      disabled={disabled}
    />
  )
}
