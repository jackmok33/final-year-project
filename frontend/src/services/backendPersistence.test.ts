import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { commandDemo, queryDemo, stageBackup, takeBackup } from './demo'
import { readDataset } from './storage'
import { simulateRun } from './seed'

beforeEach(async () => {
  vi.stubEnv('VITE_API_BASE_URL', '')
  await queryDemo({ op: 'accounts' }, null)
  await commandDemo({ op: 'reset' }, 'admin-a')
  vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8000/api/v1')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('does not persist a failed HTTP evaluation or half of a correction', async () => {
  const before = (await readDataset())!
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Backend offline')))
  const app = before.applications[0]
  for (const operation of [
    { op: 'evaluate' as const, id: app.id },
    {
      op: 'correct' as const,
      id: app.id,
      runId: app.runs[0].id,
      value: 74,
      reason: 'Transcript verified',
      documentId: app.documentIds[0],
      page: 2,
    },
  ]) {
    await expect(commandDemo(operation, 'tutor-a')).rejects.toThrow('Cannot reach')
    expect(await readDataset()).toEqual(before)
  }
})

it('retains backend runs, original history and PDF references across reload and backup/restore', async () => {
  const data = (await readDataset())!
  const app = data.applications[0]
  const run = {
    ...simulateRun(
      app,
      data.documents.filter((d) => d.applicationId === app.id),
      data.rubrics[0],
      71,
      false,
    ),
    status: 'awaiting review' as const,
    evaluationSource: 'fastapi-mock' as const,
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(run)))
  await commandDemo({ op: 'evaluate', id: app.id }, 'tutor-a')
  const reloaded = (await queryDemo({ op: 'application', id: app.id }, 'tutor-a')) as {
    application: typeof app
  }
  expect(reloaded.application.runs).toHaveLength(2)
  expect(reloaded.application.runs[0]).toEqual(app.runs[0])
  expect(reloaded.application.runs[1]).toEqual(run)
  const { backupId } = await commandDemo({ op: 'backup' }, 'admin-a')
  const backup = takeBackup(backupId!)!
  expect(backup.files).toHaveLength(data.documents.length)
  await commandDemo({ op: 'reset' }, 'admin-a')
  await commandDemo({ op: 'restore', backupId: stageBackup(backup) }, 'admin-a')
  expect((await readDataset())!.applications[0].runs[1]).toEqual(run)
})

it('checks tutor permissions before sending any request', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  await expect(commandDemo({ op: 'evaluate', id: 'APP-2026-0142' }, 'admin-a')).rejects.toThrow(
    'tutor access',
  )
  await expect(commandDemo({ op: 'evaluate', id: 'APP-2026-0147' }, 'tutor-b')).rejects.toThrow(
    'tutor access',
  )
  expect(fetchMock).not.toHaveBeenCalled()
})
