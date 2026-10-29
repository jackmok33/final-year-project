import type {
  Application,
  AuditEvent,
  BatchSummary,
  DemoHealth,
  DocumentRecord,
  DocumentType,
  Programme,
  Rubric,
  TutorOutcome,
  User,
} from '../domain/types'

/** Frontend read models shared by the current adapter and future HTTP mappings. */
export type AccountSummary = Pick<User, 'id' | 'name' | 'email' | 'active' | 'roles'>

export interface ApplicationDetail {
  application: Application
  documents: DocumentRecord[]
  rubrics: Rubric[]
}

export interface ProgrammeIntake {
  programmeId: string
  years: string[]
}

export interface RubricCollection {
  rubrics: Rubric[]
  activeId: string
}

export type Query =
  | { op: 'accounts' | 'me' | 'programmes' | 'users' | 'health' | 'audit' | 'programmeIntakes' }
  | { op: 'applications' | 'rubrics'; programmeId: string; intakeYear?: string }
  | { op: 'application'; id: string }
  | { op: 'batches'; programmeId: string; intakeYear: string }
  | { op: 'batch'; id: string }

export interface QueryResults {
  accounts: AccountSummary[]
  me: User
  programmes: Programme[]
  users: User[]
  health: DemoHealth
  audit: AuditEvent[]
  programmeIntakes: ProgrammeIntake[]
  applications: Application[]
  rubrics: RubricCollection
  application: ApplicationDetail
  batches: BatchSummary[]
  batch: BatchSummary
}

export type QueryResult<Q extends Query = Query> = QueryResults[Q['op']]

export interface UploadReference {
  id: string
  type: DocumentType
}

// Adapter commands are not a REST endpoint specification. Backup, restore,
// reset and simulated model controls currently operate on browser demo data.
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

export interface CommandResult {
  id?: string
  backupId?: string
}
