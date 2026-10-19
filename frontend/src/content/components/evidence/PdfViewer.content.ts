import { textValue, type ContentValue } from '../../formatText'

export const pdfViewerContent = {
  loadingPdfPage: 'Loading PDF page…',
  canvasLabel: (name: ContentValue, page: ContentValue) =>
    `${String(name)}, page ${String(page)}. Accessible page text follows below.`,
  accessiblePageText: 'Accessible page text',
  noTextMessage: 'This page has no readable embedded text. Inspect the original PDF.',
  documentHash: (hash: ContentValue) => `Original PDF · SHA-256: ${textValue(hash)}`,
} as const
