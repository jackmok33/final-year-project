import type { Application, Dataset, User } from '../../domain/types'

export function activeUser(data: Dataset, userId: string | null) {
  const user = data.users.find((u) => u.id === userId && u.active)
  if (!user)
    throw new Error(
      'Your demo session is unavailable or deactivated. Sign in with an active demo account.',
    )
  return user
}

export function requireAdmin(user: User) {
  if (!user.roles.includes('admin')) throw new Error('Administrator access is required.')
}

export function requireTutor(data: Dataset, user: User, programmeId: string) {
  if (
    !user.roles.includes('tutor') ||
    !data.programmes.some((p) => p.id === programmeId && p.createdBy === user.id)
  )
    throw new Error('You do not have tutor access to this programme.')
}

export function applicationFor(data: Dataset, user: User, id: string) {
  const app = data.applications.find((a) => a.id === id)
  if (!app) throw new Error('Application not found.')
  requireTutor(data, user, app.programmeId)
  return app
}

export function latestReadyRun(app: Application, runId: string) {
  const run = app.runs.at(-1)
  if (!run || run.id !== runId || ['queued', 'running', 'failed'].includes(run.status))
    throw new Error('Review the latest successful run before saving this change.')
  return run
}
