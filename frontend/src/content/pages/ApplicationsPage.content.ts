import type { ContentValue } from '../formatText'

export const applicationsPageContent = {
  noWorkspaceMessage:
    'No course workspace is assigned. Ask an administrator to grant programme access.',
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
  recommendationHint:
    'Recommendations support review. Only a tutor can record a final admissions decision.',
  programmeFallback: 'Programme · TBC',
} as const
