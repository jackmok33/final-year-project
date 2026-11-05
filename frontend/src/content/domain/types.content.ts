import type {
  ApplicantReadiness,
  DocumentType,
  Outcome,
  SectionKey,
  Workflow,
} from '../../domain/types'

export const domainLabelsContent = {
  sectionNames: {
    academic: 'Academic performance',
    cv: 'CV & experience',
    statement: 'Personal statement',
    references: 'References',
  } satisfies Record<SectionKey, string>,
  documentNames: {
    transcript: 'Transcript',
    cv: 'CV',
    statement: 'Personal statement',
    application_form: 'Application form',
    english_test: 'English test report',
    reference: 'References',
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
  readinessLabels: {
    ready: 'Ready',
    missing: 'Missing',
  } satisfies Record<ApplicantReadiness, string>,
} as const
