import type { Application, Backup, Dataset, User } from '../../domain/types'
import { assignExistingBatches, validBatches } from '../../domain/batches'
import { validateRubric } from '../../domain/rules'
import { assignCourseOwners, migrateDataset } from '../migration'
import { readFile, sha256, writeDataset } from '../storage'
import { createSeed } from '../seed'
import { requireAdmin } from './access'
import { backups, recordAudit, stageBackup } from './runtime'
import type { Command, CommandResult } from './contracts'

type DataCommand = Extract<Command, { op: 'backup' | 'restore' | 'reset' }>

/** Replacement operations own their complete storage transaction. */
export async function changeDemoData(
  command: DataCommand,
  data: Dataset,
  user: User,
): Promise<CommandResult> {
  let result: CommandResult = {}
  switch (command.op) {
    case 'backup': {
      requireAdmin(user)
      recordAudit(data, user.id, 'Create browser demo backup', 'demo-dataset')
      const files: Backup['files'] = []
      for (const doc of data.documents) {
        const blob = await readFile(doc.id)
        if (!blob || (await sha256(blob)) !== doc.hash)
          throw new Error('A stored document is missing or changed. Backup was not created.')
        const bytes = new Uint8Array(await blob.arrayBuffer())
        let text = ''
        for (let offset = 0; offset < bytes.length; offset += 8192)
          text += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
        files.push({ id: doc.id, base64: btoa(text), hash: doc.hash })
      }
      const backup: Backup = {
        format: 'ucl-admissions-demo',
        version: 2,
        createdAt: new Date().toISOString(),
        dataset: data,
        files,
      }
      if (new Blob([JSON.stringify(backup)]).size > 100 * 1024 * 1024)
        throw new Error(
          'Browser demo backups are limited to 100 MB. Remove unneeded demo documents before exporting.',
        )
      result = { backupId: stageBackup(backup) }
      break
    }
    case 'restore': {
      requireAdmin(user)
      const backup = backups.get(command.backupId)
      const restored = await validateBackup(backup)
      const restoredUser = restored.dataset.users.find(
        (u) => u.id === user.id && u.active && u.roles.includes('admin'),
      )
      if (!restoredUser)
        throw new Error('The backup must retain your active administrator account.')
      recordAudit(restored.dataset, user.id, 'Restore browser demo backup', 'demo-dataset')
      await writeDataset(restored.dataset, restored.files, [], true)
      backups.delete(command.backupId)
      return {}
    }
    case 'reset': {
      requireAdmin(user)
      const seed = await createSeed()
      assignExistingBatches(seed.dataset)
      recordAudit(seed.dataset, user.id, 'Reset browser demo', 'demo-dataset')
      await writeDataset(seed.dataset, seed.files, [], true)
      return {}
    }
  }
  await writeDataset(data)
  return result
}

const isString = (value: unknown) => typeof value === 'string'

function validateCourseRecords(dataset: Dataset) {
  if (
    !Array.isArray(dataset.programmes) ||
    !dataset.programmes.every((p) =>
      [p.id, p.name, p.code, p.year, p.department, p.description].every(isString),
    ) ||
    !dataset.activeRubricIds ||
    typeof dataset.activeRubricIds !== 'object'
  )
    throw new Error()
  const programmeIds = new Set(dataset.programmes.map((p) => p.id))
  if (!validBatches(dataset)) throw new Error()
  if (
    !dataset.users.every(
      (u) =>
        [u.id, u.name, u.email].every(isString) &&
        typeof u.active === 'boolean' &&
        typeof u.canPublishCriteria === 'boolean' &&
        Array.isArray(u.roles) &&
        u.roles.length &&
        u.roles.every((r) => r === 'tutor' || r === 'admin') &&
        Array.isArray(u.programmeIds) &&
        u.programmeIds.every((p) => programmeIds.has(p)),
    )
  )
    throw new Error()
  if (
    !dataset.programmes.every(
      (p) =>
        p.createdBy === undefined ||
        (isString(p.createdBy) && dataset.users.some((u) => u.id === p.createdBy)),
    ) ||
    !dataset.rubrics.every(
      (r) =>
        [r.id, r.version, r.createdAt].every(isString) &&
        programmeIds.has(r.programmeId) &&
        Object.keys(r.weights).length === 3 &&
        ['academic', 'cv', 'statement'].every((k) => k in r.weights) &&
        !validateRubric(r),
    ) ||
    !dataset.programmes.every((p) =>
      dataset.rubrics.some((r) => r.id === dataset.activeRubricIds[p.id] && r.programmeId === p.id),
    ) ||
    Object.keys(dataset.activeRubricIds).some((id) => !programmeIds.has(id))
  )
    throw new Error()
}

function validateUniqueIds(dataset: Dataset, backup: Backup) {
  for (const list of [
    dataset.programmes,
    dataset.users,
    dataset.applications,
    dataset.documents,
    dataset.rubrics,
    dataset.audit,
    backup.files,
  ])
    if (new Set(list.map((x) => x.id)).size !== list.length) throw new Error()
}

function validateDocumentRecords(dataset: Dataset) {
  const programmeIds = new Set(dataset.programmes.map((programme) => programme.id))
  if (
    !dataset.applications.every(
      (application) =>
        [application.id, application.candidate, application.submittedAt].every(isString) &&
        programmeIds.has(application.programmeId) &&
        (application.intakeYear === undefined ||
          (isString(application.intakeYear) &&
            application.intakeYear.trim().length > 0 &&
            application.intakeYear.length <= 100)) &&
        Array.isArray(application.documentIds) &&
        Array.isArray(application.runs) &&
        Array.isArray(application.corrections) &&
        Array.isArray(application.decisions),
    )
  )
    throw new Error()
  if (
    !dataset.documents.every(
      (doc) =>
        [doc.id, doc.applicationId, doc.name, doc.hash].every(isString) &&
        ['transcript', 'cv', 'statement'].includes(doc.type) &&
        Number.isInteger(doc.pages) &&
        doc.pages > 0 &&
        doc.pages <= 100 &&
        Number.isFinite(doc.size) &&
        doc.size > 0 &&
        doc.size <= 20 * 1024 * 1024 &&
        dataset.applications.some(
          (application) =>
            application.id === doc.applicationId && application.documentIds.includes(doc.id),
        ),
    )
  )
    throw new Error()
}

function validateApplicationHistory(dataset: Dataset, application: Application) {
  const docFor = (id: string, appId: string, page: number) =>
    dataset.documents.some(
      (doc) =>
        doc.id === id &&
        doc.applicationId === appId &&
        Number.isInteger(page) &&
        page >= 1 &&
        page <= doc.pages,
    )
  if (
    new Set(application.documentIds).size !== application.documentIds.length ||
    !application.documentIds.every((id) =>
      dataset.documents.some((doc) => doc.id === id && doc.applicationId === application.id),
    ) ||
    dataset.documents
      .filter((doc) => doc.applicationId === application.id)
      .reduce((n, doc) => n + doc.pages, 0) > 100
  )
    throw new Error()
  if (
    application.fixture &&
    !['review', 'offer', 'reject', 'missing', 'failed'].includes(application.fixture)
  )
    throw new Error()
  const outcome = (o: unknown) =>
    ['Offer', 'Reject', 'Further review', 'Conditional', 'Unconditional'].includes(String(o))
  const citation = (c: { documentId: string; page: number; claim: string }) =>
    isString(c.claim) && docFor(c.documentId, application.id, c.page)
  if (
    !application.runs.every(
      (r) =>
        [r.id, r.startedAt, r.finishAt].every(isString) &&
        Number.isFinite(Date.parse(r.finishAt)) &&
        r.applicationId === application.id &&
        dataset.rubrics.some(
          (k) => k.id === r.rubricId && k.programmeId === application.programmeId,
        ) &&
        ['queued', 'running', 'awaiting review', 'completed', 'failed'].includes(r.status) &&
        outcome(r.recommendation) &&
        r.simulated === true &&
        (r.extractedGrade === null ||
          (Number.isFinite(r.extractedGrade) &&
            r.extractedGrade >= 0 &&
            r.extractedGrade <= 100)) &&
        (r.error === undefined || isString(r.error)) &&
        (r.parentRunId === undefined ||
          application.runs.some((previous) => previous.id === r.parentRunId)) &&
        (r.overall === null ||
          (Number.isFinite(r.overall) && r.overall >= 0 && r.overall <= 100)) &&
        Array.isArray(r.sections) &&
        r.sections.every(
          (s) =>
            ['academic', 'cv', 'statement'].includes(s.key) &&
            (s.score === null || (Number.isFinite(s.score) && s.score >= 0 && s.score <= 100)) &&
            isString(s.explanation) &&
            isString(s.uncertainty) &&
            s.citations.every(citation),
        ) &&
        isString(r.justification.summary) &&
        r.justification.citations.every(citation) &&
        r.justification.rules.every(isString) &&
        r.flags.every(
          (f) => isString(f.code) && isString(f.message) && typeof f.critical === 'boolean',
        ),
    )
  )
    throw new Error()
  if (
    !application.corrections.every(
      (c) =>
        application.runs.some((r) => r.id === c.runId) &&
        Number.isFinite(c.value) &&
        c.value >= 0 &&
        c.value <= 100 &&
        (c.original === null ||
          (Number.isFinite(c.original) && c.original >= 0 && c.original <= 100)) &&
        [c.id, c.reason, c.actor, c.at].every(isString) &&
        citation(c.citation),
    )
  )
    throw new Error()
  if (
    !application.decisions.every(
      (c) =>
        application.runs.some((r) => r.id === c.runId) &&
        outcome(c.outcome) &&
        outcome(c.recommendation) &&
        [c.id, c.reason, c.actor, c.at].every(isString),
    )
  )
    throw new Error()
}

/** Validate metadata, linked history and every PDF before allowing a replacement. */
export async function validateBackup(
  value: unknown,
): Promise<{ dataset: Dataset; files: Record<string, Blob> }> {
  try {
    const backup = value as Backup
    const dataset = migrateDataset(structuredClone(backup.dataset))
    if (
      backup.format !== 'ucl-admissions-demo' ||
      ![1, 2].includes(Number(backup.version)) ||
      Number(backup.version) !== Number(backup.dataset.version) ||
      dataset.version !== 2 ||
      !Array.isArray(backup.files) ||
      !Array.isArray(dataset.users) ||
      !Array.isArray(dataset.applications) ||
      !Array.isArray(dataset.documents) ||
      !Array.isArray(dataset.rubrics) ||
      !Array.isArray(dataset.audit) ||
      typeof dataset.modelAvailable !== 'boolean'
    )
      throw new Error()
    validateCourseRecords(dataset)
    validateUniqueIds(dataset, backup)
    validateDocumentRecords(dataset)
    for (const application of dataset.applications) validateApplicationHistory(dataset, application)
    if (!dataset.audit.every((e) => [e.id, e.at, e.actor, e.action, e.target].every(isString)))
      throw new Error()
    if (backup.files.length !== dataset.documents.length) throw new Error()
    const files: Record<string, Blob> = {}
    for (const file of backup.files) {
      const doc = dataset.documents.find((doc) => doc.id === file.id)
      if (!doc || file.hash !== doc.hash || !isString(file.base64)) throw new Error()
      const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes.buffer], { type: 'application/pdf' })
      if (blob.size !== doc.size || (await sha256(blob)) !== doc.hash) throw new Error()
      files[file.id] = blob
    }
    assignCourseOwners(dataset)
    return { dataset, files }
  } catch {
    throw new Error(
      'This is not a valid, intact UCL demo backup. No stored data has been replaced.',
    )
  }
}
