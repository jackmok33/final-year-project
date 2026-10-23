import { domainLabelsContent } from '../../domain/types.content'
import { applicationTableContent } from './ApplicationTable.content'
export const applicationFiltersContent = {
  workflowLabels: domainLabelsContent.workflowLabels,
  search: 'Search applicant',
  allStatus: 'All status',
  sort: 'Sort by',
  newest: 'Newest first',
  highest: 'Highest score',
  lowest: 'Lowest score',
  nameSort: 'Name',
  sortColumns: {
    id: applicationTableContent.id,
    name: applicationTableContent.name,
    studentId: applicationTableContent.studentId,
    state: applicationTableContent.state,
    university: applicationTableContent.university,
    score: applicationTableContent.score,
    recommendation: applicationTableContent.ai,
    decision: applicationTableContent.decision,
    submittedAt: 'Submission date',
  },
  columnSort: (column: string, direction: 'asc' | 'desc') =>
    `${column} (${direction === 'asc' ? 'ascending' : 'descending'})`,
  addApplicant: 'Add applicant',
} as const
