export const applicationTableContent = {
  applicationQueue: 'Application queue',
  headers: ['Application', 'Score', 'AI recommendation', 'Decision'],
  unavailableScore: '—',
  notEvaluated: 'Not evaluated',
  notRecorded: 'Not recorded',
  previousAssessment: 'Previous assessment',
  openLabel: (id: string) => `Open ${id}`,
} as const
