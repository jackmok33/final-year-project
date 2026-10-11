import { domainLabelsContent } from '../domain/types.content'

export const commonContent = {
  loadingLabel: 'Loading workspace',
  loadingMessage: 'Loading workspace…',
  cancel: 'Cancel',
  saving: 'Saving…',
  confirm: 'Confirm',
  whyThisRecommendation: 'Why this recommendation',
  criteriaContext: (version?: string) =>
    `Simulated AI justification · Criteria v${version ?? 'unknown'}`,
  statusLabels: { ...domainLabelsContent.outcomeLabels, ...domainLabelsContent.workflowLabels },
} as const
