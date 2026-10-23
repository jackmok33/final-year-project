import { domainLabelsContent } from '../../domain/types.content'
export const outcomeOptionsContent = {
  hints: {
    Conditional: 'Offer subject to stated conditions.',
    Unconditional: 'Offer with no outstanding conditions.',
    Reject: 'Record a final rejection.',
  },
  tutorOutcome: 'Tutor outcome',
  outcomeLabels: domainLabelsContent.outcomeLabels,
} as const
