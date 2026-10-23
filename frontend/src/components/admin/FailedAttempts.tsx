import { useContent } from '../../hooks/useContent'
import { Button, Stack, Typography } from '@mui/material'
import type { DemoHealth } from '../../domain/types'
import { Card, Status } from '../common'
import MainCard from '../../mantis/components/MainCard'
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
          <MainCard key={row.jobId} sx={{ bgcolor: 'action.hover' }} contentSX={{ p: 2 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>{row.jobId}</Typography>
              <Status label={content.failed} />
            </Stack>
            <Typography variant="body2" sx={{ my: 1 }}>
              {row.category}
            </Typography>
            <Button onClick={() => setLog(row)}>{content.viewRedactedLog}</Button>
          </MainCard>
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
