import { useContent } from '../hooks/useContent'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import type { ReactNode } from 'react'
import { errorMessage } from '../app/api'
import {
  hasUnavailableAssessment,
  type AssessmentRun,
  type DocumentRecord,
  type Rubric,
} from '../domain/types'
import { EvidenceLink } from './evidence/EvidenceLink'
export function Card({
  title,
  children,
  ...props
}: {
  title?: string
  children: ReactNode
  sx?: object
}) {
  return (
    <Paper variant="outlined" sx={{ minWidth: 0, overflow: 'hidden', ...props.sx }}>
      {title && (
        <Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle1" component="h2">
            {title}
          </Typography>
        </Box>
      )}
      <Stack spacing={2.5} sx={{ p: 2.5 }}>
        {children}
      </Stack>
    </Paper>
  )
}
export function Page({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h3" component="h1">
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            {subtitle}
          </Typography>
        </Box>
        {actions && (
          <Stack
            direction="row"
            sx={{ flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1, flexShrink: 0 }}
          >
            {actions}
          </Stack>
        )}
      </Box>
      {children}
    </Stack>
  )
}
export function Status({ label }: { label: string }) {
  const content = useContent('common')
  const labels = content.statusLabels
  const displayLabel = Object.hasOwn(labels, label) ? labels[label as keyof typeof labels] : label
  const color =
    /Offer|completed|Available|Active|Valid/i.test(label) &&
    !/Unavailable|Inactive|Invalid/i.test(label)
      ? 'success'
      : /Reject|failed|Unavailable|Critical|Invalid/i.test(label)
        ? 'error'
        : /review|running|queued|Missing/i.test(label)
          ? 'warning'
          : 'default'
  return (
    <Chip
      label={displayLabel}
      color={color}
      variant="outlined"
      sx={(theme) => ({
        alignSelf: 'flex-start',
        bgcolor: color === 'default' ? 'action.hover' : theme.palette[color].light,
        borderColor: color === 'default' ? 'divider' : `${theme.palette[color].main}40`,
      })}
    />
  )
}
export function Loading() {
  const content = useContent('common')
  return (
    <Stack sx={{ p: 5, alignItems: 'center' }}>
      <CircularProgress size={28} aria-label={content.loadingLabel} />
      <Typography sx={{ mt: 2 }}>{content.loadingMessage}</Typography>
    </Stack>
  )
}
export function ErrorNotice({ error }: { error: unknown }) {
  return error ? <Alert severity="error">{errorMessage(error)}</Alert> : null
}
export function TwoColumns({ children, equal = false }: { children: ReactNode; equal?: boolean }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          lg: equal ? '1fr 1fr' : 'minmax(0, 1.85fr) minmax(280px, 1fr)',
        },
        gap: 3,
        alignItems: 'start',
      }}
    >
      {children}
    </Box>
  )
}
export function Confirm({
  open,
  title,
  children,
  onClose,
  onConfirm,
  busy,
  destructive,
  disabled,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  onConfirm: () => void
  busy?: boolean
  destructive?: boolean
  disabled?: boolean
}) {
  const content = useContent('common')
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      aria-labelledby="confirm-title"
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id="confirm-title">{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>{children}</Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {content.cancel}
        </Button>
        <Button
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          onClick={onConfirm}
          disabled={busy || disabled}
        >
          {busy ? content.saving : content.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
export function Rationale({
  run,
  rubric,
  documents,
  applicationId,
  compact = false,
}: {
  run: AssessmentRun
  rubric?: Rubric
  documents: DocumentRecord[]
  applicationId: string
  compact?: boolean
}) {
  const content = useContent('common')
  const unavailable = hasUnavailableAssessment(run)
  const rules =
    !unavailable &&
    run.justification.rules.map((rule) => (
      <Typography key={rule} variant="body2">
        {rule}
      </Typography>
    ))
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle1" component={compact ? 'h2' : 'h3'} sx={{ fontWeight: 600 }}>
        {unavailable ? content.assessmentStatus : content.whyThisRecommendation}
      </Typography>
      <Typography>
        {unavailable ? content.assessmentUnavailable : run.justification.summary}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {content.criteriaContext(rubric?.version)}
      </Typography>
      {compact && !unavailable && run.justification.rules.length > 0 ? (
        <Box component="details">
          <Box component="summary" sx={{ cursor: 'pointer', typography: 'body2', py: 0.5 }}>
            {content.scoringRules}
          </Box>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {rules}
          </Stack>
        </Box>
      ) : (
        rules
      )}
      <Stack direction={compact ? 'row' : 'column'} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {!unavailable &&
          run.justification.citations.map((citation, i) => (
            <EvidenceLink
              key={i}
              applicationId={applicationId}
              citation={citation}
              document={documents.find((d) => d.id === citation.documentId)}
              runId={run.id}
              sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
            />
          ))}
      </Stack>
    </Stack>
  )
}
