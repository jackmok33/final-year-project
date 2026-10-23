import { workspaceLabels } from '../../domain/workspace.content'
export const courseAnalyticsContent = {
  unconditional: workspaceLabels.unconditional,
  conditional: workspaceLabels.conditional,
  reject: workspaceLabels.reject,
  pendingDecision: workspaceLabels.pendingDecision,
  analyticsTitle: 'Decision overview',
  analyticsDescription: 'Tutor decisions for the current assessment in this intake.',
  noData: 'No applications in this intake yet.',
} as const
