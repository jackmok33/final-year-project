import type { ContentValue } from '../../formatText'

export const correctionFormContent = {
  correctExtractedFact: 'Correct extracted fact',
  subtitle: (id: ContentValue, documentName: ContentValue) =>
    `${String(id)} / ${String(documentName)} / Source-based correction`,
  factCorrection: 'Fact correction',
  correctionNotice:
    'The original value is preserved. Saving creates a new fact version and a new simulated evaluation.',
  fact: 'Fact',
  finalWeightedAverage: 'Final weighted average',
  originalExtraction: 'Original extraction (%)',
  correctedValue: 'Corrected value (%)',
  sourceDocument: 'Source document',
  sourcePage: 'Source page',
  reasonForCorrection: 'Reason for correction',
  saveReEvaluate: 'Save & re-evaluate',
  cancel: 'Cancel',
  transcriptFallback: 'Transcript',
} as const
