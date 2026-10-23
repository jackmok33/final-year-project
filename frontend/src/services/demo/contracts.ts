import type {
  Dataset,
  DocumentType,
  Programme,
  Rubric,
  TutorOutcome,
  User,
} from '../../domain/types'

export interface UploadReference {
  id: string
  type: DocumentType
}
export type Command =
  | { op: 'importBatch'; programmeId: string; intakeYear: string; archiveId: string }
  | {
      op: 'create'
      candidate: string
      programmeId: string
      intakeYear?: string
      batchId?: string
      uploads: UploadReference[]
    }
  | { op: 'evaluate'; id: string }
  | {
      op: 'correct'
      id: string
      runId: string
      value: number
      reason: string
      documentId: string
      page: number
    }
  | {
      op: 'decide'
      id: string
      runId: string
      outcome: TutorOutcome
      reason: string
    }
  | { op: 'rubric'; rubric: Rubric }
  | { op: 'user'; user: User }
  | { op: 'programme'; programme: Programme }
  | { op: 'workspace'; name: string }
  | { op: 'model'; available: boolean }
  | { op: 'delete'; id: string }
  | { op: 'deleteApplicant'; id: string; confirmed: boolean }
  | { op: 'backup' }
  | { op: 'restore'; backupId: string }
  | { op: 'reset' }
export type Query =
  | { op: 'accounts' | 'me' | 'programmes' | 'users' | 'health' | 'audit' | 'programmeIntakes' }
  | { op: 'applications' | 'rubrics'; programmeId: string; intakeYear?: string }
  | { op: 'application'; id: string }
  | { op: 'batches'; programmeId: string; intakeYear: string }
  | { op: 'batch'; id: string }
export interface CommandResult {
  id?: string
  backupId?: string
}

/** Mutations prepare changes here; the public service commits them atomically. */
export interface CommandContext {
  data: Dataset
  user: User
  addedFiles: Record<string, Blob>
  removed: string[]
}
