import { domainLabelsContent } from '../../domain/types.content'
import type { ContentValue } from '../../formatText'

export const criteriaFieldsContent = {
  sectionWeights: 'Section weights',
  weightLabel: (sectionName: ContentValue) => `${String(sectionName)} (%)`,
  total: 'Total',
  totalLabel: (total: number, invalid: boolean) =>
    `${Number.isFinite(total) ? total : '—'}% · ${invalid ? 'Invalid' : 'Valid'}`,
  recommendationThresholds: 'Recommendation thresholds',
  rejectBelow: 'Reject below',
  offerFrom: 'Offer from',
  reviewMarginPoints: 'Review margin (± points)',
  marginHint: 'Review margins include their boundary values. Missing sections never become zero.',
  sectionNames: domainLabelsContent.sectionNames,
} as const
