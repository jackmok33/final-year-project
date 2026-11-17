import type { Command, CommandResult, Query, QueryResult } from './contracts'
import { httpAdmissionsService } from './httpAdmissions'

/** The frontend service port; implementations own transport and permission checks.
 * userId guards late UI results; the Bearer token establishes server identity.
 */
export interface AdmissionsService {
  query<Q extends Query>(query: Q, userId: string | null): Promise<QueryResult<Q>>
  command(command: Command, userId: string | null): Promise<CommandResult>
  originalDocument(id: string, userId: string | null): Promise<Blob>
}

export const admissionsService: AdmissionsService = httpAdmissionsService
