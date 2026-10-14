import { useContent } from '../hooks/useContent'
import { Alert } from '@mui/material'
import { useRubricsQuery } from '../app/api'
import { useWorkspace } from '../app/workspace'
import { ErrorNotice, Loading } from '../components/common'
import { CriteriaForm } from '../components/criteria/CriteriaForm'

export function CriteriaPage() {
  const content = useContent('criteriaPage')
  const { programme, isLoading: workspaceLoading, error: workspaceError } = useWorkspace()
  const {
    currentData: data,
    isLoading,
    error,
  } = useRubricsQuery(programme?.id ?? '', { skip: !programme })
  if (isLoading || workspaceLoading) return <Loading />
  if (workspaceError) return <ErrorNotice error={workspaceError} />
  if (!programme) return <Alert severity="info">{content.noWorkspaceMessage}</Alert>
  if (!data) return <ErrorNotice error={error ?? workspaceError} />
  const active = data.rubrics.find((r) => r.id === data.activeId)!
  const total = Object.values(active.weights).reduce((a, b) => a + b, 0)
  return <CriteriaForm active={active} history={data.rubrics} total={total} />
}
