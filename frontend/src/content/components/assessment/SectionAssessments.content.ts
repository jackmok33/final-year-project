import { domainLabelsContent } from '../../domain/types.content'

export const sectionAssessmentsContent = {
  sectionAssessments: 'Section assessments',
  noAssessment: 'No assessment available.',
  sectionNames: domainLabelsContent.sectionNames,
  scoreSummary: (score: number | null, weight?: number) =>
    `${score ?? '—'} / 100 · Weight ${weight ?? ''}%`,
  uncertaintyHint: 'Uncertainty describes model support and is separate from score.',
} as const
