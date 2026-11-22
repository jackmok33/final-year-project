export const englishTestFactsContent = {
  demoEligibility: 'Demo eligibility',
  unavailableValue: 'Unavailable',
  labels: {
    overall: 'Overall',
    listening: 'Listening',
    reading: 'Reading',
    writing: 'Writing',
    speaking: 'Speaking',
  },
  outcomes: {
    meets_requirement: 'Meets requirement',
    below_requirement: 'Below requirement',
    needs_review: 'Needs review',
  },
  reasons: {
    unsupported_report: 'The report type or page count could not be confirmed as supported.',
    unreadable_report: 'The report page could not be read safely.',
    invalid_output: 'The model returned an invalid set of results.',
    missing_bands: 'One or more bands could not be read.',
    inconsistent_bands: 'Some of the bands conflict. Check the original report.',
  },
  reportDetails: (type: string, date: string | null) => (date ? `${type} · ${date}` : type),
} as const
