export const deleteWorkspaceDialogContent = {
  title: (name: string) => `Delete course “${name}”?`,
  loading: 'Checking course contents…',
  impact: (applications: number, documents: number, criteria: number) =>
    `This will delete ${applications} application${applications === 1 ? '' : 's'}, ${documents} PDF${documents === 1 ? '' : 's'} and ${criteria} criteria version${criteria === 1 ? '' : 's'}.`,
  warning:
    'All assessments, corrections and decisions in this course will also be removed from this browser. This cannot be undone without restoring a previous demo backup.',
} as const
