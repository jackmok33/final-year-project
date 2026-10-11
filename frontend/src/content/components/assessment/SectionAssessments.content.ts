import { domainLabelsContent } from '../../domain/types.content'

export const sectionAssessmentsContent = {
  sectionAssessments: 'Section assessments',
  sectionNames: domainLabelsContent.sectionNames,
  scoreSummary: (score: number | null, weight?: number) =>
    `${score ?? '—'} / 100 · Weight ${weight ?? ''}%`,
  uncertaintyHint:
    'Uncertainty describes model support and is separate from score. Demo section scores are fixed fixtures, not an assessment of new documents.',
} as const
