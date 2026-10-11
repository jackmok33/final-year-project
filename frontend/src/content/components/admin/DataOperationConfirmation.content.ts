export const dataOperationConfirmationContent = {
  deleteThisLocalApplication: 'Delete this local application?',
  restoreBrowserDemoBackup: 'Restore browser demo backup?',
  resetTheDemoDataset: 'Reset the demo dataset?',
  deletionDescription: (applicationId: string) =>
    `Delete ${applicationId} and all of its original PDFs, derived assessments, corrections and decisions from this browser. Existing downloaded backups are unaffected.`,
  restoreDescription: (applications?: number, documents?: number) =>
    `Replace the current local dataset with ${applications ?? ''} applications and ${documents ?? ''} verified PDFs from this backup.`,
  resetDescription:
    'Replace this browser’s dataset with the original six synthetic applications across two example courses and demo accounts. Current changes will be removed.',
} as const
