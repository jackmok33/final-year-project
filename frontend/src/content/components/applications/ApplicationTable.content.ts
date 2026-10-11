export const applicationTableContent = {
  applicationQueue: 'Application queue',
  headers: [
    'Application',
    'Workflow',
    'Score',
    'Recommendation',
    'Review flags',
    'Tutor decision',
    '',
  ],
  unavailableScore: '—',
  notEvaluated: 'Not evaluated',
  flagSummary: (count: number, critical: boolean) =>
    `${count} · ${critical ? 'Critical evidence' : 'Review needed'}`,
  none: 'None',
  notRecorded: 'Not recorded',
  open: 'Open',
  openLabel: (id: string) => `Open ${id}`,
} as const
