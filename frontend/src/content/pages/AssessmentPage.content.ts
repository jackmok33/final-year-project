import { textValue, type ContentValue } from '../formatText'

export const assessmentPageContent = {
  subtitle: (candidate: ContentValue, submittedAt: ContentValue) =>
    `${String(candidate)} / Synthetic application / Submitted ${String(submittedAt)}`,
  processingMessage: (status: ContentValue) =>
    `Simulated evaluation ${textValue(status)}. This run will finish even if you refresh.`,
  readyForReview: 'Ready for review',
  uploadDescription:
    'Your original PDFs are saved. Request evaluation to see backend availability and missing-document flags.',
  backendNotice:
    'Scores are simulated only for seeded cases. This new upload will require the backend and local AI service.',
  historicRunNotice:
    'Viewing a previous run. Tutor decisions always use the latest successful run.',
} as const
