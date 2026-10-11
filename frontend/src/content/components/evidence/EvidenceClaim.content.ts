import { textValue, type ContentValue } from '../../formatText'

export const evidenceClaimContent = {
  assessmentClaim: 'Assessment claim',
  needsVerification: 'Needs verification',
  citedSource: 'Cited source',
  quotedClaim: (claim: ContentValue) => `“${textValue(claim)}”`,
  sourceContext: (name: ContentValue, page: ContentValue) =>
    `${textValue(name)} · page ${textValue(page)} · Simulated assessment`,
  noClaimMessage:
    'No assessment claim cites this page. You are viewing the preserved original document.',
  extractedFinalGrade: 'Extracted final grade',
  mismatchWarning:
    'The synthetic transcript shows 74%. Verify the original before correcting the extracted 71%.',
  correctExtractedFact: 'Correct extracted fact',
  citationHint:
    'A citation points to a source. Inspect the document to decide whether it supports the claim.',
  returnToAssessment: 'Return to assessment',
  notExtracted: 'Not extracted',
  gradeValue: (grade: number) => `${grade}%`,
} as const
