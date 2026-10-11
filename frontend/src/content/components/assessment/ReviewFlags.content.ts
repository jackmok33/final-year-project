import { textValue, type ContentValue } from '../../formatText'

export const reviewFlagsContent = {
  reviewFlags: 'Review flags',
  noFlagsMessage: 'No unresolved critical flags in this synthetic run.',
  inspectCorrectFact: 'Inspect & correct fact',
  failureCategory: (error: ContentValue) => `Failure category: ${textValue(error)}`,
} as const
