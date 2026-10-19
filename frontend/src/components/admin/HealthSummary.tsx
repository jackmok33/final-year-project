import type { DemoHealth } from '../../domain/types'
import { useContent } from '../../hooks/useContent'
import { SummaryCards } from '../SummaryCards'

export function HealthSummary({ data }: { data?: DemoHealth }) {
  const content = useContent('healthSummary')
  return (
    <SummaryCards
      items={[
        {
          label: content.availableServices,
          value: data?.modelAvailable ? content.allServicesAvailable : content.modelUnavailable,
        },
        { label: content.failedJobs, value: data?.failed ?? 0 },
        {
          label: content.queuedEvaluations,
          value: data?.queued ?? 0,
        },
        { label: content.storage, value: content.browserStorage },
      ]}
    />
  )
}
