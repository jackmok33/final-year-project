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
          hint: content.simulationHint,
        },
        { label: content.failedJobs, value: data?.failed ?? 0, hint: content.simulationHint },
        {
          label: content.queuedEvaluations,
          value: data?.queued ?? 0,
          hint: content.simulationHint,
        },
        { label: content.storage, value: content.browserStorage, hint: content.simulationHint },
      ]}
    />
  )
}
