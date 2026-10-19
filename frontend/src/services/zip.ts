import { Unzip, UnzipInflate, unzipSync } from 'fflate'
import type { DocumentType } from '../domain/types'

export const MAX_ZIP_SIZE = 100 * 1024 * 1024
export const MAX_EXPANDED_SIZE = 200 * 1024 * 1024
export const MAX_APPLICANTS = 100
const MAX_PDF_SIZE = 20 * 1024 * 1024
export interface ArchiveApplicant {
  candidate: string
  documents: { type: DocumentType; file: File }[]
}

function pathParts(path: string) {
  if (path.startsWith('/') || path.includes('\\') || path.includes('\0'))
    throw new Error('The ZIP contains an unsafe file path.')
  const parts = path.replace(/\/$/, '').split('/')
  if (parts.some((p) => !p || p === '.' || p === '..' || p.includes(':')))
    throw new Error('The ZIP contains an unsafe file path.')
  return parts
}
function ignored(parts: string[]) {
  return (
    parts.some((p) => p === '__MACOSX' || p.startsWith('._')) ||
    ['.DS_Store', 'Thumbs.db'].includes(parts.at(-1)!)
  )
}
function documentType(filename: string): DocumentType {
  const words = filename
    .slice(0, -4)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
  const matches: DocumentType[] = []
  if (words.some((w) => ['cv', 'resume', 'vitae'].includes(w))) matches.push('cv')
  if (words.some((w) => ['transcript', 'transcripts'].includes(w))) matches.push('transcript')
  if (words.some((w) => ['statement', 'ps'].includes(w))) matches.push('statement')
  if (matches.length !== 1)
    throw new Error(`Cannot identify “${filename}”. Use cv.pdf, transcript.pdf or statement.pdf.`)
  return matches[0]
}

/** Inspect ZIP metadata before streaming bounded output. Nothing is written to disk or IndexedDB. */
export async function readApplicantArchive(file: File): Promise<ArchiveApplicant[]> {
  if (!file.name.toLowerCase().endsWith('.zip') || !file.size || file.size > MAX_ZIP_SIZE)
    throw new Error('Choose a non-empty ZIP file no larger than 100 MB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const inventory = new Map<string, { parts: string[]; size: number }>()
  let expanded = 0
  let entries = 0
  try {
    unzipSync(bytes, {
      filter(entry) {
        if (++entries > 1000) throw new Error('The ZIP contains too many files or folders.')
        const parts = pathParts(entry.name)
        if (entry.name.endsWith('/') || ignored(parts)) return false
        if (!entry.name.toLowerCase().endsWith('.pdf'))
          throw new Error(`“${entry.name}” is not a PDF. This version imports PDF documents only.`)
        if (inventory.has(entry.name.toLowerCase()))
          throw new Error('The ZIP contains duplicate file paths.')
        if (entry.originalSize === 0 || entry.originalSize > MAX_PDF_SIZE)
          throw new Error('Each PDF must be non-empty and no larger than 20 MB.')
        expanded += entry.originalSize
        if (expanded > MAX_EXPANDED_SIZE)
          throw new Error('The extracted ZIP must not exceed 200 MB.')
        inventory.set(entry.name.toLowerCase(), { parts, size: entry.originalSize })
        return false
      },
    })
    if (!inventory.size) throw new Error('The ZIP contains no applicant PDFs.')
    const paths = [...inventory.values()].map((e) => e.parts)
    const wrapped = paths.every((p) => p.length === 3 && p[0] === paths[0][0])
    const applicants = new Map<string, ArchiveApplicant>()
    const destinations = new Map<string, { applicant: ArchiveApplicant; type: DocumentType }>()
    for (const [path, { parts }] of inventory) {
      const relative = wrapped ? parts.slice(1) : parts
      if (relative.length !== 2)
        throw new Error('Use one folder per applicant, with their PDFs directly inside it.')
      const [candidate, filename] = relative
      if (candidate.trim() !== candidate || candidate.length > 200)
        throw new Error('Applicant folder names must be trimmed and at most 200 characters.')
      const key = candidate.toLowerCase()
      const applicant = applicants.get(key) ?? { candidate, documents: [] }
      if (applicant.candidate !== candidate)
        throw new Error('Applicant folder names must be unique, ignoring case.')
      applicants.set(key, applicant)
      if (applicants.size > MAX_APPLICANTS)
        throw new Error('A ZIP batch supports at most 100 applicants.')
      const type = documentType(filename)
      if ([...destinations.values()].some((d) => d.applicant === applicant && d.type === type))
        throw new Error(
          `“${candidate}” has more than one ${type} PDF. Include one document per type.`,
        )
      destinations.set(path, { applicant, type })
    }
    let outputSize = 0
    const completed = new Set<string>()
    const seen = new Set<string>()
    const unzipper = new Unzip((entry) => {
      const parts = pathParts(entry.name)
      if (entry.name.endsWith('/') || ignored(parts)) return
      const key = entry.name.toLowerCase()
      const expected = inventory.get(key)
      if (!expected || seen.has(key)) throw new Error('The ZIP file directory is inconsistent.')
      seen.add(key)
      let size = 0
      const chunks: Uint8Array<ArrayBuffer>[] = []
      entry.ondata = (error, chunk, final) => {
        if (error) throw error
        size += chunk.length
        outputSize += chunk.length
        if (size > MAX_PDF_SIZE || outputSize > MAX_EXPANDED_SIZE || size > expected.size)
          throw new Error('The extracted ZIP exceeds its document or batch size limit.')
        chunks.push(new Uint8Array(chunk))
        if (final) {
          if (size !== expected.size) throw new Error('The ZIP contains an incomplete PDF.')
          const destination = destinations.get(key)!
          destination.applicant.documents.push({
            type: destination.type,
            file: new File(chunks, parts.at(-1)!, { type: 'application/pdf' }),
          })
          completed.add(key)
        }
      }
      entry.start()
    })
    unzipper.register(UnzipInflate)
    // Bounded chunks also limit temporary inflated allocations; yield for visible progress.
    for (let offset = 0; offset < bytes.length; offset += 16384) {
      const end = Math.min(offset + 16384, bytes.length)
      unzipper.push(bytes.subarray(offset, end), end === bytes.length)
      if (offset % (1024 * 1024) === 0) await new Promise((resolve) => setTimeout(resolve, 0))
    }
    if (completed.size !== inventory.size) throw new Error('The ZIP contains incomplete files.')
    return [...applicants.values()]
  } catch (error) {
    if (error instanceof Error && error.message && !('code' in error)) throw error
    throw new Error('This ZIP cannot be read. Check that it is complete and not encrypted.', {
      cause: error,
    })
  }
}
