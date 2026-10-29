import type { Backup, DocumentType } from '../domain/types'
import type { UploadReference } from './contracts'

// Files stay outside Redux; adapters resolve these temporary references before
// writing to storage or sending a request. Callers release them after each use.
export const uploads = new Map<string, File>()
export const archives = new Map<string, File>()
export const backups = new Map<string, Backup>()

function stage<T>(store: Map<string, T>, value: T) {
  const id = crypto.randomUUID()
  store.set(id, value)
  return id
}

export function stageArchive(file: File) {
  return stage(archives, file)
}

export function releaseArchive(id: string) {
  archives.delete(id)
}

export function stageUploads(files: { file: File; type: DocumentType }[]): UploadReference[] {
  return files.map(({ file, type }) => ({ id: stage(uploads, file), type }))
}

export function releaseUploads(refs: UploadReference[]) {
  refs.forEach(({ id }) => uploads.delete(id))
}

// Backup/restore currently applies only to the browser's demo dataset.
export function stageBackup(backup: Backup) {
  return stage(backups, backup)
}

export function takeBackup(id: string) {
  const backup = backups.get(id)
  backups.delete(id)
  return backup
}

export function discardBackup(id: string) {
  backups.delete(id)
}
