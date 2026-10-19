import { textValue, type ContentValue } from '../formatText'

export const assessmentPageContent = {
  subtitle: (candidate: ContentValue, submittedAt: ContentValue) =>
    `${String(candidate)} / Submitted ${String(submittedAt)}`,
  processingMessage: (status: ContentValue) =>
    `Evaluation ${textValue(status)}. This run will finish even if you refresh.`,
  readyForReview: 'Ready for review',
  requestEvaluation: 'Request evaluation',
  showLatest: 'Return to latest assessment',
  uploadDescription:
    'Your original PDFs are saved. Request an assessment to review the application.',
  historicRunNotice:
    'Viewing a previous assessment. Return to the latest assessment to record a decision or correct a fact.',
} as const
