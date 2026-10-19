import { useContent } from '../hooks/useContent'
import { Alert, Typography } from '@mui/material'
import { useState } from 'react'
import { useCommandMutation, useHealthQuery } from '../app/api'
import { FailedAttempts } from '../components/admin/FailedAttempts'
import { HealthSummary } from '../components/admin/HealthSummary'
import { ServiceAvailability } from '../components/admin/ServiceAvailability'
import { Confirm, ErrorNotice, Loading, Page, TwoColumns } from '../components/common'

export function ServiceHealthPage() {
  const content = useContent('serviceHealthPage')
  const { data, isLoading, error } = useHealthQuery(undefined, { pollingInterval: 2000 })
  const [command, mutation] = useCommandMutation()
  const [log, setLog] = useState<{
    jobId: string
    category: string
  } | null>(null)
  if (isLoading) return <Loading />
  return (
    <Page title={content.serviceHealth} subtitle={content.subtitle}>
      <ErrorNotice error={error || mutation.error} />
      <HealthSummary data={data} />
      {!data?.modelAvailable && <Alert severity="warning">{content.modelUnavailableNotice}</Alert>}
      <TwoColumns>
        <ServiceAvailability
          data={data}
          busy={mutation.isLoading}
          onModelChange={(available) => void command({ op: 'model', available })}
        />
        <FailedAttempts data={data} setLog={setLog} />
      </TwoColumns>
      <Confirm
        open={!!log}
        title={content.redactedDemoLog}
        onClose={() => setLog(null)}
        onConfirm={() => setLog(null)}
      >
        <Typography component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
          {content.redactedLog(log?.jobId, log?.category)}
        </Typography>
      </Confirm>
    </Page>
  )
}
