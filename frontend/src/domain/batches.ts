import type { Application, Dataset, UploadBatch } from './types'
import { applicationIntakeYear } from './intakes'
import { summarizeApplications } from './applicationSummary'

/** Number a single module/intake chronologically; stored order breaks timestamp ties. */
export function numberBatches<T extends UploadBatch>(batches: T[]) {
  return [...batches]
    .sort((a, b) => Date.parse(a.uploadedAt) - Date.parse(b.uploadedAt))
    .map((batch, index) => ({ ...batch, sequence: index + 1 }))
}

/** Group pre-batch records without changing originals, assessment history or record IDs. */
export function assignExistingBatches(data: Dataset) {
  data.batches ??= []
  for (const application of data.applications) {
    if (application.batchId) continue
    const programme = data.programmes.find((p) => p.id === application.programmeId)
    if (!programme) continue
    const year = applicationIntakeYear(application, programme)
    let batch = data.batches.find(
      (b) => b.source === 'existing' && b.programmeId === programme.id && b.intakeYear === year,
    )
    if (!batch) {
      batch = {
        id: crypto.randomUUID(),
        programmeId: programme.id,
        intakeYear: year,
        filename: '',
        uploadedAt: application.submittedAt,
        source: 'existing',
      }
      data.batches.push(batch)
    }
    application.batchId = batch.id
  }
}

export function batchApplications(batch: UploadBatch, applications: Application[]) {
  return applications.filter((a) => a.batchId === batch.id && a.programmeId === batch.programmeId)
}

/** Optional fields keep version-1/early version-2 backups compatible. */
export function validBatches(data: Dataset) {
  if (data.batches !== undefined && !Array.isArray(data.batches)) return false
  const batches = data.batches ?? []
  if (!Array.isArray(batches) || new Set(batches.map((b) => b.id)).size !== batches.length)
    return false
  if (
    !batches.every(
      (b) =>
        typeof b.id === 'string' &&
        !!b.id.trim() &&
        data.programmes.some((p) => p.id === b.programmeId) &&
        typeof b.intakeYear === 'string' &&
        !!b.intakeYear.trim() &&
        b.intakeYear.length <= 100 &&
        typeof b.filename === 'string' &&
        typeof b.uploadedAt === 'string' &&
        Number.isFinite(Date.parse(b.uploadedAt)) &&
        (b.source === 'existing' ||
          (b.source === 'zip' &&
            !!b.filename.trim() &&
            b.filename.toLowerCase().endsWith('.zip') &&
            !!b.uploadedBy)) &&
        (b.uploadedBy === undefined || data.users.some((u) => u.id === b.uploadedBy)),
    )
  )
    return false
  return data.applications.every(
    (a) =>
      a.batchId === undefined ||
      batches.some(
        (b) =>
          b.id === a.batchId &&
          b.programmeId === a.programmeId &&
          applicationIntakeYear(
            a,
            data.programmes.find((p) => p.id === a.programmeId)!,
          ) === b.intakeYear,
      ),
  )
}

export function batchSummaries(data: Dataset, programmeId: string, intakeYear: string) {
  return numberBatches(
    data.batches!.filter((b) => b.programmeId === programmeId && b.intakeYear === intakeYear),
  ).map((batch) => {
    const applications = batchApplications(batch, data.applications)
    const summary = summarizeApplications(applications)
    return {
      ...batch,
      applicantCount: summary.total,
      conditionalCount: summary.conditional,
      unconditionalCount: summary.unconditional,
      rejectCount: summary.reject,
      pendingReviewCount: summary.pending,
    }
  })
}
