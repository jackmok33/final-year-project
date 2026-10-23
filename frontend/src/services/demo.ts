import type { Query, Command, CommandResult, CommandContext } from './demo/contracts'
import { runExclusive, loadDataset, recordAudit } from './demo/runtime'
import { activeUser, applicationFor } from './demo/access'
import { readQuery } from './demo/queries'
import { changeApplication } from './demo/applications'
import { changeSettings } from './demo/settings'
import { changeDemoData } from './demo/backups'
import { readFile, writeDataset } from './storage'

export type { UploadReference, Query, Command, CommandResult } from './demo/contracts'
export {
  stageArchive,
  releaseArchive,
  stageBackup,
  takeBackup,
  discardBackup,
  stageUploads,
  releaseUploads,
} from './demo/runtime'
export { validateBackup } from './demo/backups'

/** Public demo adapter. All reads/writes share one cross-tab storage lock. */
export function queryDemo(query: Query, userId: string | null): Promise<unknown> {
  return runExclusive(async () => readQuery(await loadDataset(), query, userId))
}

export async function authorizedFile(id: string, userId: string | null) {
  return runExclusive(async () => {
    const data = await loadDataset()
    const user = activeUser(data, userId)
    const doc = data.documents.find((d) => d.id === id)
    if (!doc) throw new Error('Document not found.')
    applicationFor(data, user, doc.applicationId)
    const file = await readFile(id)
    if (!file)
      throw new Error(
        'The original PDF is missing from browser storage. Restore a backup or reset the demo.',
      )
    recordAudit(data, user.id, 'Read original document', id)
    await writeDataset(data)
    return file
  })
}

export function commandDemo(command: Command, userId: string | null): Promise<CommandResult> {
  return runExclusive(async () => {
    const data = await loadDataset()
    const user = activeUser(data, userId)
    const context: CommandContext = { data, user, addedFiles: {}, removed: [] }
    let result: CommandResult | undefined
    switch (command.op) {
      case 'importBatch':
      case 'create':
      case 'evaluate':
      case 'correct':
      case 'decide':
      case 'deleteApplicant':
      case 'delete':
        result = await changeApplication(command, context)
        break
      case 'rubric':
      case 'user':
      case 'workspace':
      case 'programme':
      case 'model':
        result = changeSettings(command, context)
        break
      case 'backup':
      case 'restore':
      case 'reset':
        return changeDemoData(command, data, user)
      default:
        throw new Error('Unsupported demo operation.')
    }
    // An identical decision is a no-op; all other mutations commit records/PDFs together.
    if (result) await writeDataset(data, context.addedFiles, context.removed)
    return result ?? {}
  })
}
