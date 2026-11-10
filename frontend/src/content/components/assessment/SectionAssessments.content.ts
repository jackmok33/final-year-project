import { domainLabelsContent } from '../../domain/types.content'

export const sectionAssessmentsContent = {
  sectionNames: domainLabelsContent.sectionNames,
  notAssessed: 'This section was not assessed in this run.',
  sectionScore: (score: number | null) =>
    score === null ? 'Score unavailable' : `Score: ${score}/100`,
} as const
