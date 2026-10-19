export const serviceHealthPageContent = {
  serviceHealth: 'Service health',
  subtitle: 'Inspect service availability, failed jobs and redacted operational activity.',
  modelUnavailableNotice:
    'Local model unavailable. Failed assessments can be retried when availability is restored.',
  redactedDemoLog: 'Redacted demo log',
  redactedLog: (jobId?: string, category?: string) =>
    `Job: ${jobId ?? ''}\nCategory: ${category ?? ''}\nSource: simulated local-model fixture\nApplicant content: excluded`,
} as const
