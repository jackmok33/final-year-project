import { workspaceLabels } from '../../domain/workspace.content'
export const recommendationSummaryContent = {
  reviewTabs: workspaceLabels.reviewTabs,
  overall: 'Overall score / 100',
  scoreValue: (score: number | null) => (score === null ? '—' : score.toFixed(1)),
  notAvailable: workspaceLabels.notAvailable,
  ai: workspaceLabels.ai,
  decision: workspaceLabels.decision,
} as const
