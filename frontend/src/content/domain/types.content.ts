import type { DocumentType, Outcome, SectionKey, Workflow } from '../../domain/types'

export const domainLabelsContent = {
  sectionNames: {
    academic: 'Academic performance',
    cv: 'CV & experience',
    statement: 'Personal statement',
  } satisfies Record<SectionKey, string>,
  documentNames: {
    transcript: 'Transcript',
    cv: 'CV',
    statement: 'Personal statement',
  } satisfies Record<DocumentType, string>,
  outcomeLabels: {
    Conditional: 'Conditional',
    Unconditional: 'Unconditional',
    Offer: 'Offer',
    Reject: 'Reject',
    'Further review': 'Further review',
  } satisfies Record<Outcome, string>,
  workflowLabels: {
    'not evaluated': 'not evaluated',
    queued: 'queued',
    running: 'running',
    'awaiting review': 'awaiting review',
    completed: 'completed',
    failed: 'failed',
  } satisfies Record<Workflow | 'not evaluated', string>,
} as const
