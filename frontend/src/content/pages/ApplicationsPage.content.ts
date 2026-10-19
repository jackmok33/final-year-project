import type { ContentValue } from '../formatText'
import { intakeContent } from '../domain/intakes.content'
import { batchListContent } from '../components/batches/BatchList.content'

export const applicationsPageContent = {
  batchName: batchListContent.batchName,
  batchUnavailable: 'This upload batch is unavailable or you do not have access.',
  back: 'Back',
  noWorkspaceMessage: 'Choose a course from All courses to review applications.',
  applications: 'Applications',
  subtitle: (moduleCode: ContentValue, year: string) =>
    `${String(moduleCode)} · ${intakeContent.yearLabel(year)} intake`,
  newApplication: 'New application',
  applicationQueue: 'Application queue',
  noApplicationsMatchTheseFilters: 'No applications match these filters.',
  recommendationHint: 'Decision is the tutor’s recorded choice.',
} as const
