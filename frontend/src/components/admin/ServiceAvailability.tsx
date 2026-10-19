import { useContent } from '../../hooks/useContent'
import { Divider, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import type { DemoHealth } from '../../domain/types'
import { Card, Status } from '../common'
export function ServiceAvailability({
  data,
  busy,
  onModelChange,
}: {
  data?: DemoHealth
  busy: boolean
  onModelChange: (available: boolean) => void
}) {
  const content = useContent('serviceAvailability')
  return (
    <Card title={content.serviceAvailability}>
      {[content.applicationApi, content.database, content.documentStorage, content.localModel].map(
        (label, i) => (
          <Stack
            key={label}
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
            <Status
              label={i === 3 && !data?.modelAvailable ? content.unavailable : content.available}
            />
          </Stack>
        ),
      )}
      <Divider />
      <FormControlLabel
        control={
          <Switch
            color="secondary"
            checked={!!data?.modelAvailable}
            disabled={busy || !data}
            onChange={(e) => onModelChange(e.target.checked)}
          />
        }
        label={content.simulateModelAvailability}
      />
    </Card>
  )
}
