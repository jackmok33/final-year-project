import type { ContentValue } from '../formatText'

export const applicationsPageContent = {
  noWorkspaceMessage: 'Create a programme workspace using New workspace in the navigation.',
  application: 'Application',
  candidate: 'Candidate',
  programme: 'Programme',
  state: 'State',
  overallScore: 'Overall score',
  recommendation: 'Recommendation',
  tutorDecision: 'Tutor decision',
  criteriaVersion: 'Criteria version',
  applications: 'Applications',
  subtitle: (programmeName: ContentValue) =>
    `${String(programmeName)} / Review your assigned applications and unresolved cases.`,
  newApplication: 'New application',
  exportFilteredResults: 'Export filtered results',
  applicationQueue: 'Application queue',
  noApplicationsMatchTheseFilters: 'No applications match these filters.',
  recommendationHint: 'Decision is the tutor’s recorded choice.',
  programmeFallback: 'Programme · TBC',
} as const
