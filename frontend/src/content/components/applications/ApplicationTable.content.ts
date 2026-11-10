import { domainLabelsContent } from '../../domain/types.content'
import { workspaceLabels } from '../../domain/workspace.content'
export const applicationTableContent = {
  readinessLabels: domainLabelsContent.readinessLabels,
  applicants: workspaceLabels.applicants,
  id: 'Id',
  name: 'Name',
  studentId: 'Student ID',
  state: 'State',
  university: 'University',
  score: 'Score',
  ai: workspaceLabels.ai,
  decision: workspaceLabels.decision,
  actions: 'Actions',
  openApplicant: (name: string) => `View ${name}`,
  notAvailable: workspaceLabels.notAvailable,
  deleteApplicant: (name: string) => `Delete ${name}`,
} as const
