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
import type { AssessmentRun, DocumentRecord, Rubric } from '../domain/types'
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
    <Paper variant="outlined" sx={{ p: 3, minWidth: 0, ...props.sx }}>
      <Stack spacing={2}>
        {title && (
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
        )}
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
      <Box>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {subtitle}
        </Typography>
        {actions && (
          <Stack direction="row" sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
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
  return <Chip label={displayLabel} color={color} variant="outlined" />
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
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  onConfirm: () => void
  busy?: boolean
  destructive?: boolean
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
          disabled={busy}
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
}: {
  run: AssessmentRun
  rubric?: Rubric
  documents: DocumentRecord[]
  applicationId: string
}) {
  const content = useContent('common')
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
        {content.whyThisRecommendation}
      </Typography>
      <Typography>{run.justification.summary}</Typography>
      <Typography variant="body2" color="text.secondary">
        {content.criteriaContext(rubric?.version)}
      </Typography>
      {run.justification.rules.map((rule) => (
        <Typography key={rule} variant="body2">
          {rule}
        </Typography>
      ))}
      <Stack spacing={0.5}>
        {run.justification.citations.map((citation, i) => (
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
