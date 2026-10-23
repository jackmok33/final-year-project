import { workspaceLabels } from '../../domain/workspace.content'
export const reviewFlagsContent = {
  noFlags: workspaceLabels.noFlags,
  updateDetail: 'Update detail',
  academicMismatch: 'Academic detail mismatch',
  reviewConcern: 'Evidence needs review',
} as const
