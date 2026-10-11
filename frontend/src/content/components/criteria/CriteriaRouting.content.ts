export const criteriaRoutingContent = {
  howRecommendationsAreRouted: 'How recommendations are routed',
  evidenceStep: '1 · Unresolved critical evidence',
  evidenceDescription:
    'Missing, conflicting or unsupported evidence takes precedence and routes to Further Review.',
  failureStep: '2 · Verified mandatory failure',
  failureDescription: 'A verified rule failure produces a Reject recommendation.',
  scoreStep: '3 · Scores and review margins',
  scoreDescription: 'Apply the stored thresholds only when the score can be calculated validly.',
  activationNotice:
    'Activating a version affects future runs. Existing assessments remain linked to their original criteria.',
} as const
