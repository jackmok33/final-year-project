import { useContent } from '../../hooks/useContent'
import { Alert, Button, Typography } from '@mui/material'
import { type Rubric } from '../../domain/types'
import { Confirm, ErrorNotice, Page, Status, TwoColumns } from '../common'
import { CriteriaFields } from './CriteriaFields'
import { CriteriaHistory } from './CriteriaHistory'
import { CriteriaRouting } from './CriteriaRouting'

export function CriteriaForm({
  active,
  history,
  permitted,
  rubric,
  setRubric,
  open,
  setOpen,
  mutation,
  error,
  total,
  save,
  disabled,
}: {
  active: Rubric
  history: Rubric[]
  permitted: boolean
  rubric: Rubric
  setRubric: (rubric: Rubric) => void
  open: boolean
  setOpen: (open: boolean) => void
  mutation: { isLoading: boolean; error?: unknown }
  error: string | null
  total: number
  save: () => Promise<void>
  disabled: boolean
}) {
  const content = useContent('criteriaForm')
  return (
    <Page
      title={content.admissionCriteria}
      subtitle={content.subtitle}
      actions={
        <>
          <Status label={content.activeVersion(active.version)} />
          <Status label={content.draftVersion(history.length)} />
          <Button variant="contained" disabled={disabled} onClick={() => setOpen(true)}>
            {content.activateDraft}
          </Button>
        </>
      }
    >
      <Alert severity="info">{content.policyNotice}</Alert>
      {!permitted && <Alert severity="warning">{content.permissionNotice}</Alert>}
      <ErrorNotice error={mutation.error} />
      <TwoColumns>
        <CriteriaFields
          rubric={rubric}
          setRubric={setRubric}
          permitted={permitted}
          error={error}
          total={total}
        />
        <CriteriaRouting />
      </TwoColumns>
      <CriteriaHistory history={history} active={active} />
      <Confirm
        open={open}
        title={content.activateANewCriteriaVersion}
        onClose={() => setOpen(false)}
        onConfirm={() => void save()}
        busy={mutation.isLoading}
      >
        <Typography>{content.activationDescription(history.length, active.version)}</Typography>
      </Confirm>
    </Page>
  )
}
