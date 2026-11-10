import type {
  Application,
  BatchSummary,
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

/** Source metadata for queue readiness; derive this without persisting duplicate document lists. */
export interface ApplicationListItem extends Application {
  documentTypes: DocumentType[]
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
  | { op: 'accounts' | 'me' | 'programmes' | 'users' | 'programmeIntakes' }
  | { op: 'applications' | 'rubrics'; programmeId: string; intakeYear?: string }
  | { op: 'application'; id: string }
  | { op: 'batches'; programmeId: string; intakeYear: string }
  | { op: 'batch'; id: string }

export interface QueryResults {
  accounts: AccountSummary[]
  me: User
  programmes: Programme[]
  users: User[]
  programmeIntakes: ProgrammeIntake[]
  applications: ApplicationListItem[]
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

// Adapter commands are not a REST endpoint specification.
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
  | { op: 'workspace'; name: string }
  | { op: 'deleteApplicant'; id: string; confirmed: boolean }

export interface CommandResult {
  id?: string
  batchId?: string
}
