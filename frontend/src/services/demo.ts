import type {
  Application,
  Backup,
  Dataset,
  Decision,
  DocumentType,
  Rubric,
  Programme,
  User,
} from '../domain/types'
import { validateRubric } from '../domain/rules'
import { baseRubric, createSeed, simulateRun } from './seed'
import { migrateDataset } from './migration'
import { readDataset, readFile, sha256, writeDataset } from './storage'

export interface UploadReference {
  id: string
  type: DocumentType
}
const uploads = new Map<string, File>()
const backups = new Map<string, Backup>()
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
export type Command =
  | { op: 'create'; candidate: string; programmeId: string; uploads: UploadReference[] }
  | { op: 'evaluate'; id: string }
  | {
      op: 'correct'
      id: string
      runId: string
      value: number
      reason: string
      documentId: string
      page: number
    }
  | {
      op: 'decide'
      id: string
      runId: string
      outcome: Decision['outcome']
      reason: string
      confirmed: boolean
    }
  | { op: 'rubric'; rubric: Rubric }
  | { op: 'user'; user: User }
  | { op: 'programme'; programme: Programme }
  | { op: 'workspace'; name: string }
  | { op: 'deleteWorkspace'; id: string; confirmed: boolean }
  | { op: 'model'; available: boolean }
  | { op: 'delete'; id: string }
  | { op: 'backup' }
  | { op: 'restore'; backupId: string }
  | { op: 'reset' }
export type Query =
  | { op: 'accounts' | 'me' | 'programmes' | 'users' | 'health' | 'audit' }
  | { op: 'applications' | 'rubrics'; programmeId: string }
  | { op: 'application'; id: string }
  | { op: 'workspaceDeletion'; id: string }
export interface CommandResult {
  id?: string
  backupId?: string
}
let serial: Promise<unknown> = Promise.resolve()
function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const result = serial.then(() =>
    typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('ucl-admissions-demo-store', work)
      : work(),
  )
  serial = result.catch(() => undefined)
  return result
}
function audit(data: Dataset, actor: string, action: string, target: string) {
  data.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), actor, action, target })
}
async function load(): Promise<Dataset> {
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
  // Earlier name-only workspaces recorded their creator in the audit trail.
  // Retain that ownership when upgrading without assigning seeded/shared courses.
  for (const programme of data.programmes) {
    if (programme.createdBy === undefined) {
      const creation = data.audit.find(
        (event) => event.action === 'Create programme workspace' && event.target === programme.id,
      )
      if (creation && data.users.some((u) => u.id === creation.actor))
        programme.createdBy = creation.actor
    }
  }
  // Runs use stored deadlines rather than in-memory timers, so refresh cannot strand a job.
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
  await writeDataset(data)
  return data
}
function actorFor(data: Dataset, userId: string | null) {
  const user = data.users.find((u) => u.id === userId && u.active)
  if (!user)
    throw new Error(
      'Your demo session is unavailable or deactivated. Sign in with an active demo account.',
    )
  return user
}
function admin(user: User) {
  if (!user.roles.includes('admin')) throw new Error('Administrator access is required.')
}
function tutor(user: User, programmeId: string) {
  if (!user.roles.includes('tutor') || !user.programmeIds.includes(programmeId))
    throw new Error('You do not have tutor access to this programme.')
}
function addProgramme(data: Dataset, programme: Programme) {
  data.programmes.push(programme)
  const rubric: Rubric = {
    ...structuredClone(baseRubric),
    id: crypto.randomUUID(),
    programmeId: programme.id,
    createdAt: new Date().toISOString(),
  }
  data.rubrics.push(rubric)
  data.activeRubricIds[programme.id] = rubric.id
}
function ownedWorkspace(data: Dataset, user: User, id: string) {
  const programme = data.programmes.find((p) => p.id === id)
  if (!programme) throw new Error('Programme workspace not found.')
  tutor(user, id)
  if (programme.createdBy !== user.id)
    throw new Error('Only the tutor who created this workspace can delete it.')
  return programme
}
function appFor(data: Dataset, user: User, id: string) {
  const app = data.applications.find((a) => a.id === id)
  if (!app) throw new Error('Application not found.')
  tutor(user, app.programmeId)
  return app
}
export async function queryDemo(query: Query, userId: string | null): Promise<unknown> {
  return exclusive(async () => {
    const data = await load()
    if (query.op === 'accounts')
      return data.users.map(({ id, name, email, active, roles }) => ({
        id,
        name,
        email,
        active,
        roles,
      }))
    const user = actorFor(data, userId)
    switch (query.op) {
      case 'me':
        return user
      case 'applications': {
        tutor(user, query.programmeId)
        return data.applications.filter((a) => a.programmeId === query.programmeId)
      }
      case 'application': {
        const application = appFor(data, user, query.id)
        return {
          application,
          documents: data.documents.filter((d) => d.applicationId === application.id),
          rubrics: data.rubrics.filter((r) => r.programmeId === application.programmeId),
        }
      }
      case 'programmes':
        return data.programmes.filter(
          (p) => user.roles.includes('admin') || user.programmeIds.includes(p.id),
        )
      case 'workspaceDeletion': {
        const programme = ownedWorkspace(data, user, query.id)
        const applications = data.applications.filter((a) => a.programmeId === programme.id)
        const ids = new Set(applications.map((a) => a.id))
        return {
          programme,
          applications: applications.length,
          documents: data.documents.filter((d) => ids.has(d.applicationId)).length,
          criteriaVersions: data.rubrics.filter((r) => r.programmeId === programme.id).length,
          otherTutors: data.users.filter(
            (u) => u.id !== user.id && u.programmeIds.includes(programme.id),
          ).length,
        }
      }
      case 'rubrics':
        tutor(user, query.programmeId)
        return {
          rubrics: data.rubrics.filter((r) => r.programmeId === query.programmeId),
          activeId: data.activeRubricIds[query.programmeId],
        }
      case 'users':
        admin(user)
        return data.users
      case 'health':
        admin(user)
        return {
          modelAvailable: data.modelAvailable,
          failed: data.applications.filter((a) => a.runs.at(-1)?.status === 'failed').length,
          queued: data.applications.filter((a) =>
            ['queued', 'running'].includes(a.runs.at(-1)?.status ?? ''),
          ).length,
          logs: data.applications.flatMap((a) =>
            a.runs
              .filter((r) => r.error)
              .map((r) => ({ jobId: `JOB-${r.id.slice(0, 8)}`, category: r.error! })),
          ),
        }
      case 'audit':
        admin(user)
        return data.audit
    }
  })
}
export async function authorizedFile(id: string, userId: string | null) {
  return exclusive(async () => {
    const data = await load()
    const user = actorFor(data, userId)
    const doc = data.documents.find((d) => d.id === id)
    if (!doc) throw new Error('Document not found.')
    appFor(data, user, doc.applicationId)
    const file = await readFile(id)
    if (!file)
      throw new Error(
        'The original PDF is missing from browser storage. Restore a backup or reset the demo.',
      )
    audit(data, user.id, 'Read original document', id)
    await writeDataset(data)
    return file
  })
}
function readyRun(app: Application, runId: string) {
  const run = app.runs.at(-1)
  if (!run || run.id !== runId || ['queued', 'running', 'failed'].includes(run.status))
    throw new Error('Review the latest successful run before saving this change.')
  return run
}
export async function commandDemo(command: Command, userId: string | null): Promise<CommandResult> {
  return exclusive(async () => {
    const data = await load()
    const user = actorFor(data, userId)
    const addedFiles: Record<string, Blob> = {}
    const removed: string[] = []
    let result: CommandResult = {}
    switch (command.op) {
      case 'create': {
        tutor(user, command.programmeId)
        if (
          !data.programmes.some((p) => p.id === command.programmeId) ||
          !command.candidate.trim() ||
          !command.uploads.length
        )
          throw new Error(
            'An application identifier, assigned programme and at least one PDF are required.',
          )
        if (new Set(command.uploads.map((r) => r.type)).size !== command.uploads.length)
          throw new Error('Upload one document per type.')
        const id = `APP-2026-${String(Math.max(146, ...data.applications.map((a) => Number(a.id.split('-').at(-1)) || 0)) + 1).padStart(4, '0')}`
        const app: Application = {
          id,
          candidate: command.candidate.trim(),
          programmeId: command.programmeId,
          submittedAt: new Date().toISOString(),
          documentIds: [],
          runs: [],
          corrections: [],
          decisions: [],
        }
        const { inspectPdf } = await import('./pdf')
        let pageCount = 0
        for (const ref of command.uploads) {
          const file = uploads.get(ref.id)
          if (!file)
            throw new Error('The selected upload is no longer available. Select the files again.')
          const { pages } = await inspectPdf(file)
          pageCount += pages
          if (pageCount > 100)
            throw new Error('An application cannot contain more than 100 pages in total.')
          const docId = crypto.randomUUID()
          data.documents.push({
            id: docId,
            applicationId: id,
            type: ref.type,
            name: file.name,
            size: file.size,
            pages,
            hash: await sha256(file),
          })
          addedFiles[docId] = file
          app.documentIds.push(docId)
        }
        data.applications.push(app)
        audit(data, user.id, 'Create application', id)
        result = { id }
        break
      }
      case 'evaluate': {
        const app = appFor(data, user, command.id)
        if (['queued', 'running'].includes(app.runs.at(-1)?.status ?? ''))
          throw new Error('An evaluation is already in progress.')
        const rubric = data.rubrics.find((r) => r.id === data.activeRubricIds[app.programmeId])!
        app.runs.push(
          simulateRun(
            app,
            data.documents.filter((d) => d.applicationId === app.id),
            rubric,
            app.corrections.at(-1)?.value ?? app.runs.at(-1)?.extractedGrade ?? 74,
            data.modelAvailable,
          ),
        )
        audit(data, user.id, 'Start simulated evaluation', app.id)
        break
      }
      case 'correct': {
        const app = appFor(data, user, command.id)
        const run = readyRun(app, command.runId)
        const doc = data.documents.find(
          (d) =>
            d.id === command.documentId && d.applicationId === app.id && d.type === 'transcript',
        )
        if (
          !doc ||
          !Number.isInteger(command.page) ||
          command.page < 1 ||
          command.page > doc.pages ||
          !Number.isFinite(command.value) ||
          command.value < 0 ||
          command.value > 100 ||
          !command.reason.trim()
        )
          throw new Error(
            'Enter a grade between 0 and 100, a valid transcript page and a correction reason.',
          )
        app.corrections.push({
          id: crypto.randomUUID(),
          runId: run.id,
          original: run.extractedGrade,
          value: command.value,
          reason: command.reason.trim(),
          citation: {
            documentId: doc.id,
            page: command.page,
            claim: `Corrected grade: ${command.value}%`,
          },
          actor: user.id,
          at: new Date().toISOString(),
        })
        const rubric = data.rubrics.find((r) => r.id === data.activeRubricIds[app.programmeId])!
        const next = simulateRun(
          app,
          data.documents.filter((d) => d.applicationId === app.id),
          rubric,
          command.value,
          data.modelAvailable,
        )
        // Only the known 74% fixture has a simulated corrected assessment.
        if (app.fixture && command.value !== 74) {
          next.flags.push({
            code: 'UNSUPPORTED_DEMO_CORRECTION',
            critical: true,
            message:
              'This correction is saved, but no fixture assessment exists for this value. Backend evaluation is required.',
          })
          next.overall = null
          next.sections.forEach((s) => {
            s.score = null
          })
          next.recommendation = 'Further review'
          next.justification = {
            summary:
              'The corrected value is preserved. A backend assessment is required for this value; no demo score has been generated.',
            citations: [app.corrections.at(-1)!.citation],
            rules: ['Unknown assessment requires further review.'],
          }
        }
        app.runs.push(next)
        audit(data, user.id, 'Correct fact and re-evaluate', app.id)
        break
      }
      case 'decide': {
        const app = appFor(data, user, command.id)
        const run = readyRun(app, command.runId)
        if (!['Offer', 'Reject', 'Further review'].includes(command.outcome))
          throw new Error('Select a valid outcome.')
        if (
          command.outcome !== 'Further review' &&
          (!command.confirmed || run.flags.some((f) => f.critical))
        )
          throw new Error(
            'Resolve critical review flags and confirm evidence review before a final decision.',
          )
        if (command.outcome !== run.recommendation && !command.reason.trim())
          throw new Error('An override requires a reason.')
        const previous = app.decisions.at(-1)
        if (
          previous?.runId === run.id &&
          previous.outcome === command.outcome &&
          previous.reason === command.reason.trim()
        )
          return {}
        app.decisions.push({
          id: crypto.randomUUID(),
          runId: run.id,
          outcome: command.outcome,
          recommendation: run.recommendation,
          reason: command.reason.trim(),
          actor: user.id,
          at: new Date().toISOString(),
        })
        audit(data, user.id, 'Record tutor decision', app.id)
        break
      }
      case 'rubric': {
        tutor(user, command.rubric.programmeId)
        throw new Error('Criteria editing is disabled for the MVP.')
      }
      case 'user': {
        admin(user)
        const edited = structuredClone(command.user)
        if (
          !edited.name.trim() ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(edited.email) ||
          !edited.roles.length ||
          edited.roles.some((r) => !['tutor', 'admin'].includes(r)) ||
          edited.programmeIds.some((id) => !data.programmes.some((p) => p.id === id))
        )
          throw new Error('Enter a name, valid email, role and configured programme access.')
        if (
          data.users.some(
            (u) => u.id !== edited.id && u.email.toLowerCase() === edited.email.toLowerCase(),
          )
        )
          throw new Error('This email is already assigned to an account.')
        const existing = data.users.findIndex((u) => u.id === edited.id)
        const others = data.users.filter(
          (u) => u.id !== edited.id && u.active && u.roles.includes('admin'),
        )
        if (
          !others.length &&
          (!edited.active || !edited.roles.includes('admin')) &&
          data.users.find((u) => u.id === edited.id)?.roles.includes('admin')
        )
          throw new Error('Keep at least one active administrator.')
        if (!edited.roles.includes('tutor')) {
          edited.programmeIds = []
          edited.canPublishCriteria = false
        }
        if (existing >= 0) data.users[existing] = edited
        else data.users.push({ ...edited, id: crypto.randomUUID() })
        audit(data, user.id, 'Save account and permissions', edited.id || edited.email)
        break
      }
      case 'workspace': {
        if (!user.roles.includes('tutor')) throw new Error('Tutor access is required.')
        const name = command.name.trim()
        if (!name || name.length > 100)
          throw new Error('Enter a workspace name between 1 and 100 characters.')
        if (
          data.programmes.some(
            (p) =>
              user.programmeIds.includes(p.id) &&
              p.name.trim().toLowerCase() === name.toLowerCase(),
          )
        )
          throw new Error('You already have a programme workspace with this name.')
        const id = crypto.randomUUID()
        const year = new Date().getFullYear()
        addProgramme(data, {
          id,
          name,
          code: `WS-${id}`,
          year: `${year} / ${String(year + 1).slice(-2)}`,
          department: '',
          description:
            'User-created demo workspace. Initial criteria are examples, not UCL admissions policy.',
          createdBy: user.id,
        })
        user.programmeIds.push(id)
        audit(data, user.id, 'Create programme workspace', id)
        result = { id }
        break
      }
      case 'deleteWorkspace': {
        const programme = ownedWorkspace(data, user, command.id)
        if (!command.confirmed) throw new Error('Confirm workspace deletion before continuing.')
        const applications = data.applications.filter((a) => a.programmeId === programme.id)
        const appIds = new Set(applications.map((a) => a.id))
        const documents = data.documents.filter((d) => appIds.has(d.applicationId))
        const rubrics = data.rubrics.filter((r) => r.programmeId === programme.id)
        const targets = new Set([
          programme.id,
          ...documents.map((d) => d.id),
          ...rubrics.map((r) => r.id),
          ...applications.flatMap((a) => [
            a.id,
            ...a.runs.map((r) => r.id),
            ...a.corrections.map((c) => c.id),
            ...a.decisions.map((d) => d.id),
          ]),
        ])
        removed.push(...documents.map((d) => d.id))
        data.applications = data.applications.filter((a) => !appIds.has(a.id))
        data.documents = data.documents.filter((d) => !appIds.has(d.applicationId))
        data.rubrics = data.rubrics.filter((r) => r.programmeId !== programme.id)
        data.programmes = data.programmes.filter((p) => p.id !== programme.id)
        delete data.activeRubricIds[programme.id]
        for (const account of data.users)
          account.programmeIds = account.programmeIds.filter((id) => id !== programme.id)
        data.audit = data.audit.filter((event) => !targets.has(event.target))
        audit(data, user.id, 'Delete programme workspace', programme.id)
        break
      }
      case 'programme': {
        admin(user)
        const edited = { ...command.programme }
        // Metadata editing cannot claim or transfer ownership.
        delete edited.createdBy
        if (!edited.name.trim() || !edited.code.trim() || !edited.year.trim())
          throw new Error('Programme name, code and academic year are required.')
        if (
          data.programmes.some(
            (p) => p.id !== edited.id && p.code.toLowerCase() === edited.code.toLowerCase(),
          )
        )
          throw new Error('This programme code is already configured.')
        const index = data.programmes.findIndex((p) => p.id === edited.id)
        if (edited.id && index < 0) throw new Error('Programme not found.')
        if (index >= 0)
          data.programmes[index] = { ...edited, createdBy: data.programmes[index].createdBy }
        else {
          edited.id = crypto.randomUUID()
          addProgramme(data, edited)
        }
        audit(data, user.id, 'Save programme metadata', edited.id)
        result = { id: edited.id }
        break
      }
      case 'model':
        admin(user)
        data.modelAvailable = command.available
        audit(data, user.id, 'Change simulated service availability', 'demo-model')
        break
      case 'delete': {
        admin(user)
        const app = data.applications.find((a) => a.id === command.id)
        if (!app) throw new Error('Application not found.')
        removed.push(...app.documentIds)
        data.applications = data.applications.filter((a) => a.id !== app.id)
        data.documents = data.documents.filter((d) => d.applicationId !== app.id)
        data.audit = data.audit.filter(
          (e) => e.target !== app.id && !app.documentIds.includes(e.target),
        )
        audit(data, user.id, 'Delete application and documents', app.id)
        break
      }
      case 'backup': {
        admin(user)
        audit(data, user.id, 'Create browser demo backup', 'demo-dataset')
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
        admin(user)
        const backup = backups.get(command.backupId)
        const restored = await validateBackup(backup)
        const restoredUser = restored.dataset.users.find(
          (u) => u.id === user.id && u.active && u.roles.includes('admin'),
        )
        if (!restoredUser)
          throw new Error('The backup must retain your active administrator account.')
        audit(restored.dataset, user.id, 'Restore browser demo backup', 'demo-dataset')
        await writeDataset(restored.dataset, restored.files, [], true)
        backups.delete(command.backupId)
        return {}
      }
      case 'reset': {
        admin(user)
        const seed = await createSeed()
        audit(seed.dataset, user.id, 'Reset browser demo', 'demo-dataset')
        await writeDataset(seed.dataset, seed.files, [], true)
        return {}
      }
    }
    await writeDataset(data, addedFiles, removed)
    return result
  })
}

export async function validateBackup(
  value: unknown,
): Promise<{ dataset: Dataset; files: Record<string, Blob> }> {
  try {
    const backup = value as Backup
    const d = migrateDataset(backup.dataset)
    if (
      backup.format !== 'ucl-admissions-demo' ||
      ![1, 2].includes(Number(backup.version)) ||
      Number(backup.version) !== Number(backup.dataset.version) ||
      d.version !== 2 ||
      !Array.isArray(backup.files) ||
      !Array.isArray(d.users) ||
      !Array.isArray(d.applications) ||
      !Array.isArray(d.documents) ||
      !Array.isArray(d.rubrics) ||
      !Array.isArray(d.audit) ||
      typeof d.modelAvailable !== 'boolean'
    )
      throw new Error()
    const string = (v: unknown) => typeof v === 'string'
    if (
      !Array.isArray(d.programmes) ||
      !d.programmes.every((p) =>
        [p.id, p.name, p.code, p.year, p.department, p.description].every(string),
      ) ||
      !d.activeRubricIds ||
      typeof d.activeRubricIds !== 'object'
    )
      throw new Error()
    const programmeIds = new Set(d.programmes.map((p) => p.id))
    if (
      !d.users.every(
        (u) =>
          [u.id, u.name, u.email].every(string) &&
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
      !d.programmes.every(
        (p) =>
          p.createdBy === undefined ||
          (string(p.createdBy) && d.users.some((u) => u.id === p.createdBy)),
      ) ||
      !d.rubrics.every(
        (r) =>
          [r.id, r.version, r.createdAt].every(string) &&
          programmeIds.has(r.programmeId) &&
          Object.keys(r.weights).length === 3 &&
          ['academic', 'cv', 'statement'].every((k) => k in r.weights) &&
          !validateRubric(r),
      ) ||
      !d.programmes.every((p) =>
        d.rubrics.some((r) => r.id === d.activeRubricIds[p.id] && r.programmeId === p.id),
      ) ||
      Object.keys(d.activeRubricIds).some((id) => !programmeIds.has(id))
    )
      throw new Error()
    for (const list of [
      d.programmes,
      d.users,
      d.applications,
      d.documents,
      d.rubrics,
      d.audit,
      backup.files,
    ])
      if (new Set(list.map((x) => x.id)).size !== list.length) throw new Error()
    const docFor = (id: string, appId: string, page: number) =>
      d.documents.some(
        (doc) =>
          doc.id === id &&
          doc.applicationId === appId &&
          Number.isInteger(page) &&
          page >= 1 &&
          page <= doc.pages,
      )
    if (
      !d.applications.every(
        (a) =>
          [a.id, a.candidate, a.submittedAt].every(string) &&
          programmeIds.has(a.programmeId) &&
          Array.isArray(a.documentIds) &&
          Array.isArray(a.runs) &&
          Array.isArray(a.corrections) &&
          Array.isArray(a.decisions),
      )
    )
      throw new Error()
    if (
      !d.documents.every(
        (doc) =>
          [doc.id, doc.applicationId, doc.name, doc.hash].every(string) &&
          ['transcript', 'cv', 'statement'].includes(doc.type) &&
          Number.isInteger(doc.pages) &&
          doc.pages > 0 &&
          doc.pages <= 100 &&
          Number.isFinite(doc.size) &&
          doc.size > 0 &&
          doc.size <= 20 * 1024 * 1024 &&
          d.applications.some((a) => a.id === doc.applicationId && a.documentIds.includes(doc.id)),
      )
    )
      throw new Error()
    for (const a of d.applications) {
      if (
        new Set(a.documentIds).size !== a.documentIds.length ||
        !a.documentIds.every((id) =>
          d.documents.some((doc) => doc.id === id && doc.applicationId === a.id),
        ) ||
        d.documents
          .filter((doc) => doc.applicationId === a.id)
          .reduce((n, doc) => n + doc.pages, 0) > 100
      )
        throw new Error()
      if (a.fixture && !['review', 'offer', 'reject', 'missing', 'failed'].includes(a.fixture))
        throw new Error()
      const outcome = (o: unknown) => ['Offer', 'Reject', 'Further review'].includes(String(o))
      const citation = (c: { documentId: string; page: number; claim: string }) =>
        string(c.claim) && docFor(c.documentId, a.id, c.page)
      if (
        !a.runs.every(
          (r) =>
            [r.id, r.startedAt, r.finishAt].every(string) &&
            Number.isFinite(Date.parse(r.finishAt)) &&
            r.applicationId === a.id &&
            d.rubrics.some((k) => k.id === r.rubricId && k.programmeId === a.programmeId) &&
            ['queued', 'running', 'awaiting review', 'completed', 'failed'].includes(r.status) &&
            outcome(r.recommendation) &&
            r.simulated === true &&
            (r.extractedGrade === null ||
              (Number.isFinite(r.extractedGrade) &&
                r.extractedGrade >= 0 &&
                r.extractedGrade <= 100)) &&
            (r.error === undefined || string(r.error)) &&
            (r.parentRunId === undefined ||
              a.runs.some((previous) => previous.id === r.parentRunId)) &&
            (r.overall === null ||
              (Number.isFinite(r.overall) && r.overall >= 0 && r.overall <= 100)) &&
            Array.isArray(r.sections) &&
            r.sections.every(
              (s) =>
                ['academic', 'cv', 'statement'].includes(s.key) &&
                (s.score === null ||
                  (Number.isFinite(s.score) && s.score >= 0 && s.score <= 100)) &&
                string(s.explanation) &&
                string(s.uncertainty) &&
                s.citations.every(citation),
            ) &&
            string(r.justification.summary) &&
            r.justification.citations.every(citation) &&
            r.justification.rules.every(string) &&
            r.flags.every(
              (f) => string(f.code) && string(f.message) && typeof f.critical === 'boolean',
            ),
        )
      )
        throw new Error()
      if (
        !a.corrections.every(
          (c) =>
            a.runs.some((r) => r.id === c.runId) &&
            Number.isFinite(c.value) &&
            c.value >= 0 &&
            c.value <= 100 &&
            (c.original === null ||
              (Number.isFinite(c.original) && c.original >= 0 && c.original <= 100)) &&
            [c.id, c.reason, c.actor, c.at].every(string) &&
            citation(c.citation),
        )
      )
        throw new Error()
      if (
        !a.decisions.every(
          (c) =>
            a.runs.some((r) => r.id === c.runId) &&
            outcome(c.outcome) &&
            outcome(c.recommendation) &&
            [c.id, c.reason, c.actor, c.at].every(string),
        )
      )
        throw new Error()
    }
    if (!d.audit.every((e) => [e.id, e.at, e.actor, e.action, e.target].every(string)))
      throw new Error()
    if (backup.files.length !== d.documents.length) throw new Error()
    const files: Record<string, Blob> = {}
    for (const file of backup.files) {
      const doc = d.documents.find((doc) => doc.id === file.id)
      if (!doc || file.hash !== doc.hash || !string(file.base64)) throw new Error()
      const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes.buffer], { type: 'application/pdf' })
      if (blob.size !== doc.size || (await sha256(blob)) !== doc.hash) throw new Error()
      files[file.id] = blob
    }
    return { dataset: d, files }
  } catch {
    throw new Error(
      'This is not a valid, intact UCL demo backup. No stored data has been replaced.',
    )
  }
}
