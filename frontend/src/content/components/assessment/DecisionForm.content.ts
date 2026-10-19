import { textValue, type ContentValue } from '../../formatText'

export const decisionFormContent = {
  recordTutorDecision: 'Record tutor decision',
  subtitle: (id: ContentValue, version: ContentValue) =>
    `${String(id)} / Latest assessment / Criteria v${String(version)}`,
  reviewOutcome: 'Review outcome',
  criticalWarning:
    'Critical review flags remain unresolved. Resolve them before recording Offer or Reject.',
  aiRecommendation: (recommendation: ContentValue) =>
    `AI recommendation: ${textValue(recommendation)}`,
  overallScore: (score: number | null) => `Overall score: ${score ?? 'Not available'} / 100`,
  reviewNote: 'Review note (optional)',
  recordAction: (outcome: string) => `Record ${outcome.toLowerCase()}`,
  backToAssessment: 'Back to assessment',
} as const
