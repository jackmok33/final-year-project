import { domainLabelsContent } from '../domain/types.content'
import { workspaceLabels } from '../domain/workspace.content'

export const commonContent = {
  loadingLabel: 'Loading workspace',
  loadingMessage: 'Loading workspace…',
  cancel: 'Cancel',
  saving: 'Saving…',
  confirm: 'Confirm',
  statusLabels: {
    ...domainLabelsContent.outcomeLabels,
    ...domainLabelsContent.workflowLabels,
    Pending: workspaceLabels.pendingDecision,
  },
} as const
