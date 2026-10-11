import type { Application } from '../../domain/types'
import { applicationState } from '../../domain/types'
import { useContent } from '../../hooks/useContent'
import { SummaryCards } from '../SummaryCards'

export function QueueSummary({ applications }: { applications?: Application[] }) {
  const content = useContent('queueSummary')
  return (
    <SummaryCards
      items={[
        { ...content.applications, value: applications?.length ?? 0 },
        {
          ...content.awaitingReview,
          value: applications?.filter((a) => applicationState(a) === 'awaiting review').length ?? 0,
        },
        {
          ...content.finalDecisions,
          value: applications?.filter((a) => applicationState(a) === 'completed').length ?? 0,
        },
        {
          ...content.failedRuns,
          value: applications?.filter((a) => applicationState(a) === 'failed').length ?? 0,
        },
      ]}
    />
  )
}
