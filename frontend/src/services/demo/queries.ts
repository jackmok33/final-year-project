import type { Dataset } from '../../domain/types'
import { applicationIntakeYear, intakeYears, normalizeIntakeYear } from '../../domain/intakes'
import { batchSummaries } from '../../domain/batches'
import { activeUser, requireAdmin, requireTutor, applicationFor } from './access'
import type { Query } from './contracts'

/** Read permissions and projections only; locking and recovery belong to the service entry. */
export function readQuery(data: Dataset, query: Query, userId: string | null): unknown {
  if (query.op === 'accounts')
    return data.users.map(({ id, name, email, active, roles }) => ({
      id,
      name,
      email,
      active,
      roles,
    }))
  const user = activeUser(data, userId)
  switch (query.op) {
    case 'me':
      return user
    case 'batches':
      requireTutor(data, user, query.programmeId)
      return batchSummaries(
        data,
        query.programmeId,
        normalizeIntakeYear(query.intakeYear) ?? query.intakeYear,
      )
    case 'batch': {
      const batch = data.batches!.find((b) => b.id === query.id)
      if (!batch) throw new Error('Upload batch not found.')
      requireTutor(data, user, batch.programmeId)
      return batchSummaries(data, batch.programmeId, batch.intakeYear).find(
        (b) => b.id === batch.id,
      )!
    }
    case 'applications': {
      requireTutor(data, user, query.programmeId)
      const programme = data.programmes.find((p) => p.id === query.programmeId)
      return data.applications.filter(
        (a) =>
          a.programmeId === query.programmeId &&
          (!query.intakeYear ||
            (programme &&
              applicationIntakeYear(a, programme) ===
                (normalizeIntakeYear(query.intakeYear) ?? query.intakeYear))),
      )
    }
    case 'application': {
      const application = applicationFor(data, user, query.id)
      return {
        application,
        documents: data.documents.filter((d) => d.applicationId === application.id),
        rubrics: data.rubrics.filter((r) => r.programmeId === application.programmeId),
      }
    }
    case 'programmeIntakes':
      if (!user.roles.includes('tutor')) throw new Error('Tutor access required.')
      return data.programmes
        .filter((p) => p.createdBy === user.id)
        .map((programme) => ({
          programmeId: programme.id,
          years: intakeYears(programme, data.applications),
        }))
    case 'programmes':
      return data.programmes.filter(
        (p) =>
          user.roles.includes('admin') || (user.roles.includes('tutor') && p.createdBy === user.id),
      )
    case 'rubrics':
      requireTutor(data, user, query.programmeId)
      return {
        rubrics: data.rubrics.filter((r) => r.programmeId === query.programmeId),
        activeId: data.activeRubricIds[query.programmeId],
      }
    case 'users':
      requireAdmin(user)
      return data.users
    case 'health':
      requireAdmin(user)
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
      requireAdmin(user)
      return data.audit
  }
}
