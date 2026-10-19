import { textValue, type ContentValue } from '../formatText'

export const assessmentPageContent = {
  subtitle: (candidate: ContentValue, submittedAt: ContentValue) =>
    `${String(candidate)} / Submitted ${String(submittedAt)}`,
  processingMessage: (status: ContentValue) =>
    `Evaluation ${textValue(status)}. This run will finish even if you refresh.`,
  readyForReview: 'Ready for review',
  uploadDescription:
    'Your original PDFs are saved. Request an assessment to review the application.',
  historicRunNotice:
    'Viewing a previous run. Tutor decisions always use the latest successful run.',
} as const
