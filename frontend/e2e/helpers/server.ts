import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createSeed, addSampleCourseBatches } from '../../src/services/seed'
import { assignCourseOwners } from '../../src/services/migration'
import { assignExistingBatches } from '../../src/domain/batches'
import { applicationIntakeYear } from '../../src/domain/intakes'

const directory = join(tmpdir(), 'ucl-admissions-postgres-browser-tests')
export const fixtureFile = join(directory, 'synthetic-browser-backup.json')
export const tokenFile = join(directory, 'token-hashes.json')
export const backendRoot = resolve(import.meta.dirname, '../../../backend')
export const backendPython = process.env.UCL_BACKEND_PYTHON ?? 'python3'
export function accountToken(id = 'tutor-a') {
  return 'synthetic-e2e-' + id + '-' + 'x'.repeat(40)
}

export async function prepareBrowserFixture() {
  if (!process.env.DATABASE_URL || !process.env.TEST_DATABASE_URL)
    throw new Error(
      'Browser tests require distinct DATABASE_URL and TEST_DATABASE_URL (_test) values.',
    )
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const seed = await createSeed()
  assignCourseOwners(seed.dataset)
  Object.assign(seed.files, await addSampleCourseBatches(seed.dataset))
  for (const app of seed.dataset.applications) {
    const programme = seed.dataset.programmes.find((p) => p.id === app.programmeId)!
    app.intakeYear = applicationIntakeYear(app, programme)
    for (const run of app.runs)
      if (['queued', 'running'].includes(run.status))
        run.status = run.error ? 'failed' : 'awaiting review'
  }
  assignExistingBatches(seed.dataset)
  const files: Record<string, string> = {}
  for (const document of seed.dataset.documents)
    files[document.id] = Buffer.from(await seed.files[document.id].arrayBuffer()).toString('base64')
  const tokens = Object.fromEntries(
    seed.dataset.users.map((u) => [
      createHash('sha256').update(accountToken(u.id)).digest('hex'),
      u.id,
    ]),
  )
  await writeFile(fixtureFile, JSON.stringify({ dataset: seed.dataset, files }), { mode: 0o600 })
  await writeFile(tokenFile, JSON.stringify(tokens), { mode: 0o600 })
}

export async function resetBackend() {
  await promisify(execFile)(
    backendPython,
    ['-B', '-m', 'tests.workspace_test_data', '--backup', fixtureFile],
    { cwd: backendRoot, env: process.env, timeout: 120000 },
  )
}
