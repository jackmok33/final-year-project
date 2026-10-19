import { useContent } from '../../hooks/useContent'
import { ArrowBackOutlined } from '@mui/icons-material'
import { Box, Button, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { RefObject } from 'react'
import { headerHeight } from '../../app/theme'
import { type Rubric, type SectionKey } from '../../domain/types'
import { ErrorNotice, Page, Status } from '../common'
import { CriteriaFields } from './CriteriaFields'
import { CriteriaHistory } from './CriteriaHistory'

export function CriteriaForm({
  active,
  formRef,
  draft,
  history,
  selectedVersionId,
  loadedVersion,
  loadVersion,
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
  active: Rubric
  formRef: RefObject<HTMLFormElement | null>
  draft: Rubric
  history: Rubric[]
  selectedVersionId: string
  loadedVersion?: string
  loadVersion: (id: string) => void
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
    <Page
      title={content.admissionCriteria}
      subtitle={content.subtitle}
      actions={
        <>
          <Status label={content.activeVersion(active.version)} />
          <Button component={Link} to="/batches" startIcon={<ArrowBackOutlined />}>
            {content.back}
          </Button>
        </>
      }
    >
      <Box
        component="form"
        ref={formRef}
        tabIndex={-1}
        aria-label={content.admissionCriteria}
        sx={{ scrollMarginTop: headerHeight + 24 }}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <Stack spacing={2.5}>
          {loadedVersion && (
            <Typography role="status" variant="body2" color="primary.main">
              {content.loadedVersion(loadedVersion)}
            </Typography>
          )}
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
              <Stack direction="row" spacing={1}>
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
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {content.saveNotice}
              </Typography>
            </>
          )}
        </Stack>
      </Box>
      <CriteriaHistory
        history={history}
        active={active}
        selectedVersionId={selectedVersionId}
        disabled={disabled}
        loadVersion={loadVersion}
      />
    </Page>
  )
}
