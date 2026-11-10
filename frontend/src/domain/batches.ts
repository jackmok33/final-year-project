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

export function batchApplications<T extends Application>(
  batch: UploadBatch,
  applications: T[],
): T[] {
  return applications.filter((a) => a.batchId === batch.id && a.programmeId === batch.programmeId)
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
