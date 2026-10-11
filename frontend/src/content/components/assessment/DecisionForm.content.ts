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
  reasonForOverride: 'Reason for override',
  reviewNote: 'Review note',
  reviewConfirmation: 'I have reviewed the assessment and its flagged evidence.',
  recordAction: (outcome: string) => `Record ${outcome.toLowerCase()}`,
  backToAssessment: 'Back to assessment',
  confirmationTitle: (outcome: ContentValue) => `Record final ${String(outcome)} decision?`,
  confirmationBody: (outcome: ContentValue, id: ContentValue, version: ContentValue) =>
    `You are recording ${textValue(outcome)} for ${textValue(id)}, based on the latest run and criteria v${textValue(version)}. This action will be added to the review history.`,
  overrideReason: (reason: ContentValue) => `Override reason: ${textValue(reason)}`,
} as const
