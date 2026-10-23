import { workspaceLabels } from '../domain/workspace.content'
import { batchListContent } from '../components/batches/BatchList.content'
import { applicationTableContent } from '../components/applications/ApplicationTable.content'

export const applicationsPageContent = {
  workflowLabels: applicationTableContent.workflowLabels,
  batchName: batchListContent.batchName,
  batchUnavailable: 'This upload batch is unavailable or you do not have access.',
  back: workspaceLabels.back,
  noWorkspaceMessage: 'Choose a course from All courses to review applications.',
  total: workspaceLabels.total,
  batchHint: 'Applications within this batch',
  offers: workspaceLabels.offers,
  offersHint: workspaceLabels.offersHint,
  pending: workspaceLabels.pending,
  pendingHint: workspaceLabels.pendingHint,
  noMatches: 'No applicants match your filters.',
  pagination: workspaceLabels.pagination,
  deleteTitle: 'Delete applicant?',
  deleteDescription:
    'This removes the application, original documents and assessment history from this browser.',
} as const
