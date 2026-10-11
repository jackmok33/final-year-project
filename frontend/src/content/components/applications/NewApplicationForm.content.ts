import { textValue, type ContentValue } from '../../formatText'

export const newApplicationFormContent = {
  newApplication: 'New application',
  subtitle: 'Create a record and preserve the original documents for tutor review.',
  applicationDetails: 'Application details',
  candidateReference: 'Candidate reference',
  candidateHint: 'Use a synthetic reference, for example SYN-0200.',
  assignedProgramme: 'Assigned programme',
  applicationDocuments: 'Application documents',
  pageTotal: (total: ContentValue) => `${textValue(total)} / 100 pages per application`,
  pageLimitError: 'The combined documents exceed 100 pages. Remove or replace a document.',
  saving: 'Saving…',
  createApplication: 'Create application',
  cancel: 'Cancel',
} as const
