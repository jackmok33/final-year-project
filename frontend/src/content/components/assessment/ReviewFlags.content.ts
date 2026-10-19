import { textValue, type ContentValue } from '../../formatText'

export const reviewFlagsContent = {
  reviewFlags: 'Review flags',
  assessmentUnavailable: 'No assessment available for this application.',
  noFlagsMessage: 'No unresolved critical flags.',
  inspectCorrectFact: 'Inspect & correct fact',
  failureCategory: (error: ContentValue) => `Failure category: ${textValue(error)}`,
} as const
