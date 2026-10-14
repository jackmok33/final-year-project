import { Alert } from '@mui/material'
import { useContent } from '../../hooks/useContent'
import type { BackendHealth } from '../../services/backend'

export function BackendConnection({
  health,
  pending,
  error,
  fromBackend,
}: {
  health?: BackendHealth
  pending: boolean
  error: boolean
  fromBackend: boolean
}) {
  const content = useContent('backendConnection')
  return (
    <Alert severity={error ? 'warning' : 'info'} role="status">
      {error
        ? content.unavailable
        : pending
          ? content.checking
          : health
            ? fromBackend
              ? content.assessed
              : content.connected
            : content.checking}
    </Alert>
  )
}
