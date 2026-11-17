import type { AdmissionsService } from './admissions'
import type { Command, Query, QueryResult } from './contracts'
import type { Dataset } from '../domain/types'
import { batchSummaries } from '../domain/batches'
import { intakeYears, normalizeIntakeYear, applicationIntakeYear } from '../domain/intakes'
import { archives, uploads } from './fileStaging'
import { backendRequest, backendSession } from './backendSession'
import { workspaceResponse } from './workspaceResponse'

let pending:
  { token: string | undefined; promise: Promise<Dataset & { subject: string }> } | undefined
function snapshot() {
  const token = backendSession()?.token
  if (pending && pending.token === token) return pending.promise
  const promise = backendRequest('/workspace', {}, token)
    .then((response) => response.json())
    .then(workspaceResponse)
    .finally(() => {
      if (pending?.promise === promise) pending = undefined
    })
  pending = { token, promise }
  return promise
}
export async function authenticateBackend(email: string, token: string) {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token))
    throw new Error('Enter the access token issued for your account.')
  const data = workspaceResponse(await (await backendRequest('/workspace', {}, token)).json())
  const account = data.users.find((u) => u.id === data.subject)!
  if (account.email.toLowerCase() !== email.trim().toLowerCase())
    throw new Error('The access token does not match this email address.')
  return account
}

function project(data: Dataset & { subject: string }, query: Query): QueryResult {
  const user = data.users.find((u) => u.id === data.subject)!
  switch (query.op) {
    case 'accounts':
      return data.users.map(({ id, name, email, active, roles }) => ({
        id,
        name,
        email,
        active,
        roles,
      }))
    case 'me':
      return user
    case 'users':
      if (!user.roles.includes('admin')) throw new Error('Administrator access is required.')
      return data.users
    case 'programmes':
      return data.programmes
    case 'programmeIntakes':
      return data.programmes.map((p) => ({
        programmeId: p.id,
        years: intakeYears(p, data.applications),
      }))
    case 'application': {
      const application = data.applications.find((a) => a.id === query.id)
      if (!application) throw new Error('Application not found.')
      return {
        application,
        documents: data.documents.filter((d) => d.applicationId === application.id),
        rubrics: data.rubrics.filter((r) => r.programmeId === application.programmeId),
      }
    }
    case 'batch': {
      const batch = data.batches?.find((b) => b.id === query.id)
      if (!batch) throw new Error('Upload batch not found.')
      return batchSummaries(data, batch.programmeId, batch.intakeYear).find(
        (b) => b.id === batch.id,
      )!
    }
    default: {
      const programme = data.programmes.find((p) => p.id === query.programmeId)
      if (!programme) throw new Error('Programme not found.')
      if (query.op === 'rubrics')
        return {
          rubrics: data.rubrics.filter((r) => r.programmeId === programme.id),
          activeId: data.activeRubricIds[programme.id],
        }
      if (query.op === 'batches')
        return batchSummaries(
          data,
          programme.id,
          normalizeIntakeYear(query.intakeYear) ?? query.intakeYear,
        )
      return data.applications
        .filter(
          (a) =>
            a.programmeId === programme.id &&
            (!query.intakeYear ||
              applicationIntakeYear(a, programme) ===
                (normalizeIntakeYear(query.intakeYear) ?? query.intakeYear)),
        )
        .map((a) => ({
          ...a,
          documentTypes: [
            ...new Set(data.documents.filter((d) => d.applicationId === a.id).map((d) => d.type)),
          ],
        }))
    }
  }
}

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}
async function saved(path: string, init: RequestInit, token: string) {
  if (backendSession()?.token !== token)
    throw new Error('Your signed-in account has changed. Reload the page.')
  const result: unknown = await (await backendRequest(path, init, token)).json()
  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    ('id' in result && typeof result.id !== 'string') ||
    ('batchId' in result && typeof result.batchId !== 'string')
  )
    throw new Error('The backend returned an invalid save response.')
  return result as { id?: string; batchId?: string }
}

async function mutate(command: Command, token: string) {
  const save = (path: string, init: RequestInit) => saved(path, init, token)
  switch (command.op) {
    case 'workspace':
      return save('/programmes', json('POST', { name: command.name }))
    case 'rubric': {
      const r = command.rubric
      return save(
        `/programmes/${encodeURIComponent(r.programmeId)}/criteria`,
        json('PUT', {
          expectedId: r.id,
          weights: r.weights,
          rejectBelow: r.rejectBelow,
          offerFrom: r.offerFrom,
          margin: r.margin,
          mandatoryRule: r.mandatoryRule,
        }),
      )
    }
    case 'user': {
      const u = command.user
      return save(
        u.id ? `/accounts/${encodeURIComponent(u.id)}` : '/accounts',
        json(u.id ? 'PUT' : 'POST', {
          name: u.name,
          email: u.email,
          roles: u.roles,
          active: u.active,
        }),
      )
    }
    case 'deleteApplicant':
      return save(
        `/applications/${encodeURIComponent(command.id)}`,
        json('DELETE', { confirmed: command.confirmed }),
      )
    case 'evaluate':
      return save(`/applications/${encodeURIComponent(command.id)}/evaluations`, json('POST'))
    case 'correct':
      return save(
        `/applications/${encodeURIComponent(command.id)}/corrections`,
        json('POST', {
          runId: command.runId,
          value: command.value,
          reason: command.reason,
          documentId: command.documentId,
          page: command.page,
        }),
      )
    case 'decide':
      return save(
        `/applications/${encodeURIComponent(command.id)}/decisions`,
        json('POST', { runId: command.runId, outcome: command.outcome, reason: command.reason }),
      )
    case 'create': {
      const form = new FormData()
      const documents = command.uploads.map((part, index) => {
        const file = uploads.get(part.id)
        if (!file) throw new Error('Select the PDF files again.')
        form.append('file', file, file.name)
        return { type: part.type, fileIndex: index }
      })
      form.append(
        'manifest',
        JSON.stringify({
          candidate: command.candidate,
          intakeYear:
            command.intakeYear ??
            (await snapshot()).programmes.find((p) => p.id === command.programmeId)?.year,
          ...(command.batchId ? { batchId: command.batchId } : {}),
          documents,
        }),
      )
      return save(`/programmes/${encodeURIComponent(command.programmeId)}/applications`, {
        method: 'POST',
        body: form,
      })
    }
    case 'importBatch': {
      const archive = archives.get(command.archiveId)
      if (!archive) throw new Error('Select the ZIP file again.')
      const { readApplicantArchive } = await import('./zip')
      const applicants = await readApplicantArchive(archive)
      const form = new FormData()
      let index = 0
      const applications = applicants.map((applicant) => ({
        candidate: applicant.candidate,
        documents: applicant.documents.map((doc) => {
          form.append('file', doc.file, doc.file.name)
          return { type: doc.type, fileIndex: index++ }
        }),
      }))
      form.append(
        'manifest',
        JSON.stringify({ intakeYear: command.intakeYear, filename: archive.name, applications }),
      )
      return save(`/programmes/${encodeURIComponent(command.programmeId)}/batches`, {
        method: 'POST',
        body: form,
      })
    }
  }
}

function requireSession(userId: string | null) {
  if (!userId || backendSession()?.userId !== userId)
    throw new Error('Sign in with your account access token.')
}
export const httpAdmissionsService: AdmissionsService = {
  async query<Q extends Query>(query: Q, userId: string | null): Promise<QueryResult<Q>> {
    requireSession(userId)
    const token = backendSession()?.token
    const data = await snapshot()
    if (
      data.subject !== userId ||
      backendSession()?.userId !== userId ||
      backendSession()?.token !== token
    )
      throw new Error('Your signed-in account has changed. Reload the page.')
    return project(data, query) as QueryResult<Q>
  },
  async command(command, userId) {
    requireSession(userId)
    const token = backendSession()?.token
    const result = await mutate(command, token!)
    if (['workspace', 'rubric', 'user', 'create', 'importBatch'].includes(command.op) && !result.id)
      throw new Error('The backend returned an invalid save response.')
    if (['create', 'importBatch'].includes(command.op) && !result.batchId)
      throw new Error('The backend returned an invalid save response.')
    requireSession(userId)
    if (backendSession()?.token !== token)
      throw new Error('Your signed-in account has changed. Reload the page.')
    pending = undefined
    return result
  },
  async originalDocument(id, userId) {
    requireSession(userId)
    const token = backendSession()?.token
    const response = await backendRequest(`/documents/${encodeURIComponent(id)}`)
    if (response.headers.get('content-type')?.split(';')[0] !== 'application/pdf')
      throw new Error('The backend did not return a PDF.')
    const blob = await response.blob()
    requireSession(userId)
    if (backendSession()?.token !== token)
      throw new Error('Your signed-in account has changed. Reload the page.')
    return blob
  },
}
