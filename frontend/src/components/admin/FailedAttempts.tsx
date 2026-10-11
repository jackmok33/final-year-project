import { useContent } from '../../hooks/useContent'
import { Box, Button, Stack, Typography } from '@mui/material'
import type { DemoHealth } from '../../domain/types'
import { Card, Status } from '../common'
export function FailedAttempts({
  data,
  setLog,
}: {
  data?: DemoHealth
  setLog: (log: DemoHealth['logs'][number]) => void
}) {
  const content = useContent('failedAttempts')
  return (
    <Card title={content.failedEvaluationAttempts}>
      {data?.logs.length ? (
        data.logs.map((row) => (
          <Box key={row.jobId} sx={{ bgcolor: '#FAFAFA', borderRadius: 1, p: 2 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>{row.jobId}</Typography>
              <Status label={content.failed} />
            </Stack>
            <Typography variant="body2" sx={{ my: 1 }}>
              {row.category}
            </Typography>
            <Button onClick={() => setLog(row)}>{content.viewRedactedLog}</Button>
          </Box>
        ))
      ) : (
        <Typography>{content.noFailedAttemptsRecorded}</Typography>
      )}
      <Typography variant="body2" color="text.secondary">
        {content.logPrivacyNotice}
      </Typography>
    </Card>
  )
}
