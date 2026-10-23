import type { Backup, Dataset, DocumentType } from '../../domain/types'
import { applicationIntakeYear } from '../../domain/intakes'
import { assignExistingBatches } from '../../domain/batches'
import { addSampleCourseBatches, createSeed } from '../seed'
import { assignCourseOwners, migrateDataset, renameExampleCourses } from '../migration'
import { readDataset, writeDataset } from '../storage'
import type { UploadReference } from './contracts'

// Binary objects stay outside Redux and are released after each operation.
export const uploads = new Map<string, File>()
export const archives = new Map<string, File>()
export const backups = new Map<string, Backup>()
let serial: Promise<unknown> = Promise.resolve()

export function stageArchive(file: File) {
  const id = crypto.randomUUID()
  archives.set(id, file)
  return id
}

export function releaseArchive(id: string) {
  archives.delete(id)
}

export function stageBackup(backup: Backup) {
  const id = crypto.randomUUID()
  backups.set(id, backup)
  return id
}

export function takeBackup(id: string) {
  const backup = backups.get(id)
  backups.delete(id)
  return backup
}

export function discardBackup(id: string) {
  backups.delete(id)
}

export function stageUploads(files: { file: File; type: DocumentType }[]): UploadReference[] {
  return files.map(({ file, type }) => {
    const id = crypto.randomUUID()
    uploads.set(id, file)
    return { id, type }
  })
}

export function releaseUploads(refs: UploadReference[]) {
  refs.forEach((r) => uploads.delete(r.id))
}

export function runExclusive<T>(work: () => Promise<T>): Promise<T> {
  const result = serial.then(() =>
    typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('ucl-admissions-demo-store', work)
      : work(),
  )
  serial = result.catch(() => undefined)
  return result
}

export function recordAudit(data: Dataset, actor: string, action: string, target: string) {
  data.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor, action, target })
}

export async function loadDataset(): Promise<Dataset> {
  const stored = await readDataset()
  let data = stored && migrateDataset(stored)
  if (stored && Number(stored.version) === 1) {
    // Upgrade in place, retaining existing records and PDF blobs. Add one clearly
    // synthetic second-course fixture to make switching visible in the old demo.
    const seed = await createSeed()
    const second = { ...seed.dataset.programmes.find((p) => p.id === 'programme-2')! }
    const application = seed.dataset.applications.find((a) => a.programmeId === second.id)!
    if (data!.programmes.some((p) => p.id === second.id)) second.id = crypto.randomUUID()
    const rubric = {
      ...seed.dataset.rubrics.find((r) => r.programmeId === 'programme-2')!,
      id: crypto.randomUUID(),
      programmeId: second.id,
    }
    application.programmeId = second.id
    application.runs.forEach((run) => {
      run.rubricId = rubric.id
    })
    data!.programmes.push(second)
    data!.rubrics.push(rubric)
    data!.activeRubricIds[second.id] = rubric.id
    const canAddFixture = !data!.applications.some((a) => a.id === application.id)
    if (canAddFixture) data!.applications.push(application)
    const documents = seed.dataset.documents.filter(
      (d) => canAddFixture && d.applicationId === application.id,
    )
    data!.documents.push(...documents)
    const jack = data!.users.find((u) => u.id === 'tutor-a' && u.roles.includes('tutor'))
    if (jack) jack.programmeIds.push(second.id)
    await writeDataset(data!, Object.fromEntries(documents.map((d) => [d.id, seed.files[d.id]])))
  }

  if (!data) {
    const seeded = await createSeed()
    await writeDataset(seeded.dataset, seeded.files)
    data = seeded.dataset
  }
  renameExampleCourses(data)
  assignCourseOwners(data)
  const sampleFiles = await addSampleCourseBatches(data)
  // Runs use stored deadlines rather than in-memory timers, so refresh cannot strand a job.
  for (const application of data.applications) {
    const programme = data.programmes.find((p) => p.id === application.programmeId)
    if (programme && application.intakeYear === undefined)
      application.intakeYear = applicationIntakeYear(application, programme)
  }
  for (const app of data.applications)
    for (const run of app.runs) {
      if (run.status === 'queued' || run.status === 'running') {
        const done = Date.now() >= Date.parse(run.finishAt)
        run.status = done
          ? run.error
            ? 'failed'
            : 'awaiting review'
          : Date.now() > Date.parse(run.startedAt) + 400
            ? 'running'
            : 'queued'
      }
    }
  assignExistingBatches(data)
  await writeDataset(data, sampleFiles)
  return data
}
