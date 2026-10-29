import type { Command, CommandResult, Query, QueryResult } from './contracts'
import { authorizedFile, commandDemo, queryDemo } from './demo'

/** The frontend service port; implementations own transport and permission checks.
 * userId is prototype browser context, not server authentication.
 */
export interface AdmissionsService {
  query<Q extends Query>(query: Q, userId: string | null): Promise<QueryResult<Q>>
  command(command: Command, userId: string | null): Promise<CommandResult>
  originalDocument(id: string, userId: string | null): Promise<Blob>
}

// Keep adapter selection here so RTK Query and PDF consumers can share a future
// HTTP implementation. The current adapter still persists data in this browser.
export const admissionsService: AdmissionsService = {
  query: queryDemo,
  command: commandDemo,
  originalDocument: authorizedFile,
}
