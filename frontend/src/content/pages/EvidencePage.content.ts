import { textValue, type ContentValue } from '../formatText'

export const evidencePageContent = {
  sourceEvidence: 'Source evidence',
  subtitle: (id: ContentValue) => `${String(id)} / Original document and cited claim`,
  backToAssessment: 'Back to assessment',
  originalDocument: 'Original document',
  downloadOriginal: 'Download original',
  invalidCitationMessage:
    'The document, page or run reference is unavailable. This citation has not been verified. Return to the assessment to select a valid source.',
  previousPage: 'Previous page',
  pagePosition: (page: ContentValue, pages: ContentValue) =>
    `Page ${textValue(page)} of ${textValue(pages)}`,
  nextPage: 'Next page',
} as const
