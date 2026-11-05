import { domainLabelsContent } from '../../domain/types.content'

export const documentUploadContent = {
  documentNames: domainLabelsContent.documentNames,
  documentSummary: (name: string, pages: number) => `${name} · ${pages} pages`,
  pdfMaximum20Mb: 'PDF · maximum 20 MB',
  checking: 'Checking…',
  replace: 'Replace',
  choosePdf: 'Choose PDF',
  addReferences: 'Add references',
  uploadLabel: (documentName: string) => `Upload ${documentName}`,
  remove: (documentName: string) => `Remove ${documentName}`,
  removeReference: (name: string, index: number) => `Remove reference ${index + 1}: ${name}`,
} as const
