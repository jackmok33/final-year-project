import type { Dataset, User } from '../../domain/types'

export type { Command, CommandResult } from '../contracts'

/** Mutations prepare changes here; the public service commits them atomically. */
export interface CommandContext {
  data: Dataset
  user: User
  addedFiles: Record<string, Blob>
  removed: string[]
}
