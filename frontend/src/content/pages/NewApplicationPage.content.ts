import { batchListContent } from '../components/batches/BatchList.content'

export const newApplicationPageContent = {
  programme: 'Programme',
  newApplication: 'New application',
  subtitle: 'Create a record and preserve the original documents for tutor review.',
  batchName: batchListContent.batchName,
  batchUnavailable: 'This batch is unavailable.',
  workspaceUnavailable: 'This programme or intake is unavailable.',
  unableToReadPdf: 'Unable to read PDF.',
  noWorkspaceMessage: 'Choose a programme before creating an application.',
} as const
