import { workspaceLabels } from '../domain/workspace.content'

export const serviceHealthPageContent = {
  administration: workspaceLabels.administration,
  title: 'Service health',
  subtitle: 'Check backend connectivity and the services it reports.',
  refresh: 'Refresh status',
  checking: 'Checking…',
  backend: 'Backend API',
  available: 'Available',
  unavailable: 'Unavailable',
  notConfigured: 'Not configured',
  noBackend: 'No backend service has been configured.',
  service: 'Service',
  mode: 'Assessment mode',
  mockMode: 'Mock',
  database: 'Database connection',
  inference: 'AI inference',
  scope: 'The API check does not test PostgreSQL or AI inference connectivity.',
  checkedAt: (timestamp: string) =>
    `Last checked: ${new Date(timestamp).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    })}`,
} as const
