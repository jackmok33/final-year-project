export const serviceHealthPageContent = {
  serviceHealth: 'Service health',
  subtitle: 'Inspect simulated availability, failed jobs and redacted operational activity.',
  demoNotice:
    'These service-health rows are browser demo fixtures. They do not monitor the FastAPI scaffold, a database server or a real model.',
  modelUnavailableNotice:
    'Simulated local model unavailable. Failed synthetic cases can be retried by a tutor after restoring demo availability.',
  redactedDemoLog: 'Redacted demo log',
  redactedLog: (jobId?: string, category?: string) =>
    `Job: ${jobId ?? ''}\nCategory: ${category ?? ''}\nSource: simulated local-model fixture\nApplicant content: excluded`,
} as const
