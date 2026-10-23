import { workspaceLabels } from '../../domain/workspace.content'
export const batchListContent = {
  empty: 'No batches yet. Upload a ZIP to add applicants to this intake.',
  pagination: workspaceLabels.pagination,
  batchName: (sequence: number) => `Batch ${sequence}`,
  batch: 'Batch',
  date: 'Date',
  applicants: workspaceLabels.applicants,
  batches: workspaceLabels.batches,
  unconditional: workspaceLabels.unconditional,
  conditional: workspaceLabels.conditional,
  reject: workspaceLabels.reject,
  pendingDecision: workspaceLabels.pendingDecision,
} as const
