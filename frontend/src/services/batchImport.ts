import type { Application, Dataset, Programme, UploadBatch } from '../domain/types'
import { readApplicantArchive } from './zip'
import { sha256 } from './storage'
import { inspectPdf } from './pdf'
import { isWithinApplicationPageLimit } from '../domain/documentLimits'

/** Build the complete import first; the caller commits metadata and PDFs in one transaction. */
export async function prepareBatchImport(
  data: Dataset,
  file: File,
  programme: Programme,
  intakeYear: string,
  userId: string,
) {
  const applicants = await readApplicantArchive(file)
  const batch: UploadBatch = {
    id: crypto.randomUUID(),
    programmeId: programme.id,
    intakeYear,
    filename: file.name,
    uploadedAt: new Date().toISOString(),
    uploadedBy: userId,
    source: 'zip',
  }
  const applications: Application[] = []
  const documents: Dataset['documents'] = []
  const files: Record<string, Blob> = {}
  let nextReference = Math.max(
    146,
    ...data.applications.map((a) => Number(a.id.split('-').at(-1)) || 0),
  )
  for (const applicant of applicants) {
    const id = `APP-2026-${String(++nextReference).padStart(4, '0')}`
    const application: Application = {
      id,
      candidate: applicant.candidate,
      programmeId: programme.id,
      intakeYear,
      batchId: batch.id,
      submittedAt: batch.uploadedAt,
      documentIds: [],
      runs: [],
      corrections: [],
      decisions: [],
    }
    let pages = 0
    for (const document of applicant.documents) {
      let count: number
      try {
        count = (await inspectPdf(document.file)).pages
      } catch (error) {
        throw new Error(
          `${applicant.candidate} / ${document.file.name}: ${error instanceof Error ? error.message : 'PDF validation failed.'}`,
          { cause: error },
        )
      }
      pages += count
      if (!isWithinApplicationPageLimit(pages))
        throw new Error(`“${applicant.candidate}” exceeds the combined 100-page application limit.`)
      const docId = crypto.randomUUID()
      documents.push({
        id: docId,
        applicationId: id,
        type: document.type,
        name: document.file.name,
        size: document.file.size,
        pages: count,
        hash: await sha256(document.file),
      })
      files[docId] = document.file
      application.documentIds.push(docId)
    }
    applications.push(application)
  }
  return { batch, applications, documents, files }
}
