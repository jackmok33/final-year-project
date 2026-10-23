import { useContent } from '../hooks/useContent'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import type { ReactNode } from 'react'
import { errorMessage } from '../app/api'
import MainCard, { type MainCardProps } from '../mantis/components/MainCard'
import CircularWithPath from '../mantis/components/CircularWithPath'
export function Card({
  title,
  children,
  sx,
}: {
  title?: string
  children: ReactNode
  sx?: MainCardProps['sx']
}) {
  return (
    <MainCard title={title} sx={[{ minWidth: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      <Stack spacing={2.5}>{children}</Stack>
    </MainCard>
  )
}
export function Page({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
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
          <Typography variant="h1" component="h1">
            {title}
          </Typography>
          {subtitle && (
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {subtitle}
            </Typography>
          )}
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
    /Offer|Unconditional|completed|Available|Active|Valid/i.test(label) &&
    !/Unavailable|Inactive|Invalid/i.test(label)
      ? 'success'
      : /Reject|failed|Unavailable|Critical|Invalid/i.test(label)
        ? 'error'
        : /review|running|queued|Missing/i.test(label)
          ? 'warning'
          : /Conditional/i.test(label)
            ? 'info'
            : 'default'
  return (
    <Chip label={displayLabel} color={color} variant="combined" sx={{ alignSelf: 'flex-start' }} />
  )
}
export function Loading() {
  const content = useContent('common')
  return (
    <Stack sx={{ p: 5, alignItems: 'center' }}>
      <CircularWithPath size={28} aria-label={content.loadingLabel} />
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
