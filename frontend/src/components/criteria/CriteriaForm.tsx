import { useContent } from '../../hooks/useContent'
import { Alert } from '@mui/material'
import { type Rubric } from '../../domain/types'
import { Page, Status, TwoColumns } from '../common'
import { CriteriaFields } from './CriteriaFields'
import { CriteriaHistory } from './CriteriaHistory'
import { CriteriaRouting } from './CriteriaRouting'

export function CriteriaForm({
  active,
  history,
  total,
}: {
  active: Rubric
  history: Rubric[]
  total: number
}) {
  const content = useContent('criteriaForm')
  return (
    <Page
      title={content.admissionCriteria}
      subtitle={content.subtitle}
      actions={<Status label={content.activeVersion(active.version)} />}
    >
      <Alert severity="info">{content.policyNotice}</Alert>
      <TwoColumns>
        <CriteriaFields rubric={active} total={total} />
        <CriteriaRouting />
      </TwoColumns>
      <CriteriaHistory history={history} active={active} />
    </Page>
  )
}
