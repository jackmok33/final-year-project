import { domainLabelsContent } from '../domain/types.content'

export const commonContent = {
  loadingLabel: 'Loading workspace',
  loadingMessage: 'Loading workspace…',
  cancel: 'Cancel',
  saving: 'Saving…',
  confirm: 'Confirm',
  whyThisRecommendation: 'Why this recommendation',
  scoringRules: 'Scoring rules',
  assessmentStatus: 'Assessment status',
  assessmentUnavailable: 'No assessment available for these documents.',
  criteriaContext: (version?: string) => `Criteria v${version ?? 'unknown'}`,
  statusLabels: { ...domainLabelsContent.outcomeLabels, ...domainLabelsContent.workflowLabels },
} as const
