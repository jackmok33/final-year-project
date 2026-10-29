import { isTutorOutcome, type Application, type Dataset, type Programme } from '../../domain/types'
import { assignExistingBatches } from '../../domain/batches'
import { applicationIntakeYear, normalizeIntakeYear } from '../../domain/intakes'
import { isWithinApplicationPageLimit } from '../../domain/documentLimits'
import { evaluateApplication } from '../evaluation'
import { sha256 } from '../storage'
import { requireAdmin, requireTutor, applicationFor, latestReadyRun } from './access'
import { archives, uploads } from '../fileStaging'
import { recordAudit } from './runtime'
import type { Command, CommandContext, CommandResult } from './contracts'

function selectedIntake(data: Dataset, programme: Programme, year = programme.year) {
  if (
    typeof year !== 'string' ||
    (!normalizeIntakeYear(year) &&
      year !== programme.year &&
      !data.applications.some(
        (a) => a.programmeId === programme.id && applicationIntakeYear(a, programme) === year,
      ))
  )
    throw new Error('Select a valid intake year before creating an application.')
  return normalizeIntakeYear(year) ?? year
}

type ApplicationCommand = Extract<
  Command,
  {
    op: 'importBatch' | 'create' | 'evaluate' | 'correct' | 'decide' | 'deleteApplicant' | 'delete'
  }
>

export async function changeApplication(
  command: ApplicationCommand,
  { data, user, addedFiles, removed }: CommandContext,
): Promise<CommandResult | undefined> {
  let result: CommandResult = {}
  switch (command.op) {
    case 'importBatch': {
      requireTutor(data, user, command.programmeId)
      const programme = data.programmes.find((p) => p.id === command.programmeId)
      if (!programme) throw new Error('Programme not found.')
      const year = selectedIntake(data, programme, command.intakeYear)
      const file = archives.get(command.archiveId)
      if (!file) throw new Error('Select the ZIP file again before importing.')
      const { prepareBatchImport } = await import('../batchImport')
      const imported = await prepareBatchImport(data, file, programme, year, user.id)
      data.batches!.push(imported.batch)
      data.applications.push(...imported.applications)
      data.documents.push(...imported.documents)
      Object.assign(addedFiles, imported.files)
      recordAudit(data, user.id, 'Import ZIP batch', imported.batch.id)
      result = { id: imported.batch.id }
      break
    }
    case 'create': {
      requireTutor(data, user, command.programmeId)
      const programme = data.programmes.find((p) => p.id === command.programmeId)
      if (!programme || !command.candidate.trim() || !command.uploads.length)
        throw new Error(
          'An application identifier, assigned programme and at least one PDF are required.',
        )
      const intakeYear = selectedIntake(data, programme, command.intakeYear)
      const targetBatch = command.batchId
        ? data.batches?.find(
            (b) =>
              b.id === command.batchId &&
              b.programmeId === programme.id &&
              b.intakeYear === intakeYear,
          )
        : undefined
      if (command.batchId && !targetBatch)
        throw new Error('Select a batch in the same programme and intake.')
      if (new Set(command.uploads.map((r) => r.type)).size !== command.uploads.length)
        throw new Error('Upload one document per type.')
      const lastReference = Math.max(
        146,
        ...data.applications.map((application) => Number(application.id.split('-').at(-1)) || 0),
      )
      const id = `APP-2026-${String(lastReference + 1).padStart(4, '0')}`
      const app: Application = {
        id,
        candidate: command.candidate.trim(),
        ...(targetBatch ? { batchId: targetBatch.id } : {}),
        programmeId: command.programmeId,
        intakeYear,
        submittedAt: new Date().toISOString(),
        documentIds: [],
        runs: [],
        corrections: [],
        decisions: [],
      }
      const { inspectPdf } = await import('../pdf')
      let pageCount = 0
      for (const ref of command.uploads) {
        const file = uploads.get(ref.id)
        if (!file)
          throw new Error('The selected upload is no longer available. Select the files again.')
        const { pages } = await inspectPdf(file)
        pageCount += pages
        if (!isWithinApplicationPageLimit(pageCount))
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
      assignExistingBatches(data)
      recordAudit(data, user.id, 'Create application', id)
      result = { id }
      break
    }
    case 'evaluate': {
      const app = applicationFor(data, user, command.id)
      if (['queued', 'running'].includes(app.runs.at(-1)?.status ?? ''))
        throw new Error('An evaluation is already in progress.')
      const rubric = data.rubrics.find((r) => r.id === data.activeRubricIds[app.programmeId])!
      app.runs.push(
        await evaluateApplication(
          app,
          data.documents.filter((d) => d.applicationId === app.id),
          rubric,
          app.corrections.at(-1)?.value ?? app.runs.at(-1)?.extractedGrade ?? 74,
          data.modelAvailable,
        ),
      )
      recordAudit(data, user.id, 'Start simulated evaluation', app.id)
      break
    }
    case 'correct': {
      const app = applicationFor(data, user, command.id)
      const run = latestReadyRun(app, command.runId)
      const doc = data.documents.find(
        (d) => d.id === command.documentId && d.applicationId === app.id && d.type === 'transcript',
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
      const next = await evaluateApplication(
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
      recordAudit(data, user.id, 'Correct fact and re-evaluate', app.id)
      break
    }
    case 'decide': {
      const app = applicationFor(data, user, command.id)
      const run = latestReadyRun(app, command.runId)
      if (!isTutorOutcome(command.outcome)) throw new Error('Select a valid outcome.')
      if (run.flags.some((f) => f.critical))
        throw new Error('Resolve critical review flags before a final decision.')
      const previous = app.decisions.at(-1)
      if (
        previous?.runId === run.id &&
        previous.outcome === command.outcome &&
        previous.reason === command.reason.trim()
      )
        return undefined
      app.decisions.push({
        id: crypto.randomUUID(),
        runId: run.id,
        outcome: command.outcome,
        recommendation: run.recommendation,
        reason: command.reason.trim(),
        actor: user.id,
        at: new Date().toISOString(),
      })
      recordAudit(data, user.id, 'Record tutor decision', app.id)
      break
    }
    case 'deleteApplicant':
    case 'delete': {
      if (command.op === 'delete') requireAdmin(user)
      else {
        if (!command.confirmed) throw new Error('Confirm application deletion before continuing.')
        applicationFor(data, user, command.id)
      }
      const app = data.applications.find((a) => a.id === command.id)
      if (!app) throw new Error('Application not found.')
      removed.push(...app.documentIds)
      data.applications = data.applications.filter((a) => a.id !== app.id)
      data.documents = data.documents.filter((d) => d.applicationId !== app.id)
      data.audit = data.audit.filter(
        (e) => e.target !== app.id && !app.documentIds.includes(e.target),
      )
      recordAudit(data, user.id, 'Delete application and documents', app.id)
      break
    }
  }
  return result
}
