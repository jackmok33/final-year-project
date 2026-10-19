import { domainLabelsContent } from '../../domain/types.content'

export const sectionAssessmentsContent = {
  sectionAssessments: 'Score breakdown',
  correctFact: 'Inspect & correct fact',
  sectionNames: domainLabelsContent.sectionNames,
  scoreSummary: (score: number | null, weight?: number) =>
    `${score ?? '—'} / 100 · Weight ${weight ?? ''}%`,
} as const
