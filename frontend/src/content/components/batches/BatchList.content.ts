export const batchListContent = {
  batchName: (sequence: number) => `Batch ${sequence}`,
  open: (sequence: number) => `Open batch ${sequence}`,
  previousBatches: 'Previous batches',
  batch: 'Batch',
  date: 'Date',
  applicants: 'Applicants',
  pendingHumanReview: 'Pending human review',
} as const
