import type { Backup } from '../domain/types'
import { validateBackup } from './demo/backups'
import { stageBackup } from './fileStaging'

export interface BackupPreview {
  id: string
  applications: number
  documents: number
}

/** Local demo maintenance only; this is not a server backup or migration API. */
export async function prepareBackupRestore(value: unknown): Promise<BackupPreview> {
  const { dataset } = await validateBackup(value)
  // Keep the validated archive intact, including supported legacy backup versions.
  return {
    id: stageBackup(value as Backup),
    applications: dataset.applications.length,
    documents: dataset.documents.length,
  }
}
