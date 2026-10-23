import FormActions from '../../mantis/components/FormActions'
import { useContent } from '../../hooks/useContent'
import { Box, Button, Stack, Typography } from '@mui/material'
import { type Rubric, type SectionKey } from '../../domain/types'
import { ErrorNotice } from '../common'
import { CriteriaFields } from './CriteriaFields'

export function CriteriaForm({
  draft,
  total,
  invalidWeights,
  canEdit,
  disabled,
  dirty,
  validationError,
  mutation,
  changeWeight,
  changeThreshold,
  submit,
  reset,
}: {
  draft: Rubric
  total: number
  invalidWeights: boolean
  canEdit: boolean
  disabled: boolean
  dirty: boolean
  validationError: string | null
  mutation: { isLoading: boolean; error?: unknown }
  changeWeight: (key: SectionKey, value: string) => void
  changeThreshold: (key: 'rejectBelow' | 'offerFrom' | 'margin', value: string) => void
  submit: () => Promise<void>
  reset: () => void
}) {
  const content = useContent('criteriaForm')
  return (
    <Box
      component="form"
      aria-label={content.admissionCriteria}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Stack spacing={2.5}>
        <CriteriaFields
          rubric={draft}
          total={total}
          invalidWeights={invalidWeights}
          disabled={disabled}
          changeWeight={changeWeight}
          changeThreshold={changeThreshold}
        />
        {canEdit && (
          <>
            <ErrorNotice error={mutation.error ?? (dirty ? validationError : undefined)} />
            <FormActions>
              <Button
                type="submit"
                variant="contained"
                sx={{ transition: 'none' }}
                disabled={disabled || !dirty || Boolean(validationError)}
              >
                {mutation.isLoading ? content.saving : content.saveCriteria}
              </Button>
              <Button onClick={reset} disabled={disabled || !dirty} sx={{ transition: 'none' }}>
                {content.discardChanges}
              </Button>
            </FormActions>
            <Typography variant="body2" color="text.secondary">
              {content.saveNotice}
            </Typography>
          </>
        )}
      </Stack>
    </Box>
  )
}
