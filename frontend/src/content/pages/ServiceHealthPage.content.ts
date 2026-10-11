export const serviceHealthPageContent = {
  serviceHealth: 'Service health',
  subtitle: 'Inspect simulated availability, failed jobs and redacted operational activity.',
  demoNotice:
    'These services are demo fixtures. No backend, database server or local model is connected.',
  modelUnavailableNotice:
    'Simulated local model unavailable. Failed synthetic cases can be retried by a tutor after restoring demo availability.',
  redactedDemoLog: 'Redacted demo log',
  redactedLog: (jobId?: string, category?: string) =>
    `Job: ${jobId ?? ''}\nCategory: ${category ?? ''}\nSource: simulated local-model fixture\nApplicant content: excluded`,
} as const
