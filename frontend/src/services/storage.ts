import { openDB, type DBSchema, type IDBPTransaction } from 'idb'
import type { Dataset } from '../domain/types'

interface DemoDB extends DBSchema {
  state: { key: string; value: Dataset }
  files: { key: string; value: Blob }
}
const db = () =>
  openDB<DemoDB>('ucl-admissions-demo', 1, {
    upgrade(database) {
      database.createObjectStore('state')
      database.createObjectStore('files')
    },
  })
export async function readDataset() {
  return (await db()).get('state', 'dataset')
}
export async function readFile(id: string) {
  return (await db()).get('files', id)
}
export async function writeDataset(
  dataset: Dataset,
  files: Record<string, Blob> = {},
  remove: string[] = [],
  replaceFiles = false,
) {
  let tx: IDBPTransaction<DemoDB, ['state', 'files'], 'readwrite'> | undefined
  try {
    const database = await db()
    tx = database.transaction(['state', 'files'], 'readwrite')
    // A request can fail before we reach the final await. Handle the completion
    // rejection immediately, then abort the whole transaction in the catch.
    void tx.done.catch(() => {})
    if (replaceFiles) await tx.objectStore('files').clear()
    for (const id of remove) await tx.objectStore('files').delete(id)
    for (const [id, blob] of Object.entries(files)) await tx.objectStore('files').put(blob, id)
    await tx.objectStore('state').put(dataset, 'dataset')
    await tx.done
  } catch {
    try {
      tx?.abort()
    } catch {
      /* A failed request may already have aborted the transaction. */
    }
    await tx?.done.catch(() => {})
    throw new Error(
      'Browser storage could not save this change. Check available space and browser storage permissions, then retry.',
    )
  }
}
export async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('')
}
