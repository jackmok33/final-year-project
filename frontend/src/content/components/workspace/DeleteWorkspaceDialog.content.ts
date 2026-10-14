export const deleteWorkspaceDialogContent = {
  title: (name: string) => `Delete “${name}”?`,
  loading: 'Checking workspace contents…',
  impact: (applications: number, documents: number, criteria: number) =>
    `This will delete ${applications} application${applications === 1 ? '' : 's'}, ${documents} PDF${documents === 1 ? '' : 's'} and ${criteria} criteria version${criteria === 1 ? '' : 's'}.`,
  warning:
    'All assessments, corrections and decisions in this workspace will also be removed from this browser. This cannot be undone without restoring a previous demo backup.',
  shared: (count: number) =>
    `${count} other tutor${count === 1 ? '' : 's'} will lose access to this workspace.`,
} as const
