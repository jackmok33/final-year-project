export const dataOperationsPageContent = {
  backupCouldNotBeExported: 'Backup could not be exported.',
  backupFilename: (date: string) => `ucl-demo-backup-${date}.json`,
  backupSuccess: 'Browser demo backup downloaded, including original PDFs.',
  backupSizeError: 'Demo backup imports are limited to 100 MB.',
  deletionSuccess: (applicationId: string) =>
    `${applicationId} and its local documents, runs and decisions were deleted.`,
  restoreSuccess: 'Browser demo restored. Records, PDFs and evidence links are available.',
  resetSuccess: 'Browser demo reset to the original synthetic cases.',
  dataOperations: 'Data operations',
  subtitle: 'Manage browser demo recovery and deletion through recorded maintenance actions.',
  demoNotice:
    'These actions affect this browser’s synthetic dataset. Server retention, backups and university storage are not connected.',
} as const
