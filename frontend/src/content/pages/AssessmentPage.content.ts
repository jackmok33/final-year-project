import { workspaceLabels } from '../domain/workspace.content'
import { textValue, type ContentValue } from '../formatText'

export const assessmentPageContent = {
  processingMessage: (status: ContentValue) =>
    `Evaluation ${textValue(status)}. This run will finish even if you refresh.`,
  readyForReview: 'Ready for review',
  requestEvaluation: 'Request evaluation',
  reEvaluate: 'Re-evaluate application',
  showLatest: 'Return to latest assessment',
  historicRunNotice:
    'Viewing a previous assessment. Return to the latest assessment to record a decision or correct a fact.',
  programme: 'Programme',
  back: workspaceLabels.back,
  applicantHeading: (index: number, name: string, studentId: string) =>
    name === studentId ? `${index} - ${name}` : `${index} - ${name} - ${studentId}`,
  reviewTabs: workspaceLabels.reviewTabs,
  aiRecommendation: 'AI recommendation',
  reviewFlags: 'Review flag',
  noFlags: workspaceLabels.noFlags,
  scoreBreakdown: 'Score breakdown',
  noEvidence: workspaceLabels.noEvidence,
  documents: 'View documents',
  recordDecision: 'Record decision',
} as const
