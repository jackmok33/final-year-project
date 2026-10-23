import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PDFDocument } from 'pdf-lib'
import { zipSync } from 'fflate'
import { readFile } from 'node:fs/promises'
import { dataset } from './helpers/dataset'

async function login(page: Page, role = 'tutor-a') {
  await page.goto('/login')
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(
      role === 'admin-a'
        ? 'admin@demo.ucl.local'
        : role === 'tutor-b'
          ? 'tutor.b@demo.ucl.local'
          : 'tutor@demo.ucl.local',
    )
  await page.getByLabel('Password', { exact: true }).fill('demo')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.locator('main h1')).toHaveText(
    role === 'admin-a' ? 'Service health' : 'Programme',
  )
}
async function intake(page: Page, label = 'CSML 26/27') {
  await page.goto('/modules')
  await page
    .locator('main')
    .getByRole('link', { name: `Open ${label}`, exact: true })
    .click()
  await expect(page.locator('main h1')).toHaveText(label)
  await expect(page.getByRole('link', { name: 'Batch 1', exact: true })).toBeVisible()
}
async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click()
}
async function pdf(pages = 1) {
  const document = await PDFDocument.create()
  for (let i = 0; i < pages; i++) document.addPage([595, 842])
  return Buffer.from(await document.save())
}
async function audit(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('main').getByRole('progressbar')).toHaveCount(0)
  await page.locator('main').evaluate((element) =>
    element
      .getAnimations({ subtree: true })
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .forEach((animation) => animation.finish()),
  )
  const result = await new AxeBuilder({ page }).analyze()
  expect(result.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual(
    [],
  )
}
async function createProgramme(page: Page, name: string) {
  await page.goto('/modules')
  await page.getByRole('button', { name: 'Add Programme', exact: true }).click()
  await page.getByRole('textbox', { name: 'Programme name', exact: true }).fill(name)
  await page.getByRole('button', { name: 'Add Programme', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(/\/batches\?programme=/)
}

test('desktop routes and the unchanged administrator screens remain accessible', async ({
  page,
}, info) => {
  await login(page)
  const paths = [
    '/modules',
    '/batches',
    '/applications',
    '/applications/new',
    '/applications/APP-2026-0142',
    '/applications/APP-2026-0142/evidence',
    '/applications/APP-2026-0142/correct',
    '/applications/APP-2026-0143/decision',
    '/criteria',
  ]
  for (const [index, path] of paths.entries()) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    await audit(page)
    if (path === '/criteria')
      await page.screenshot({ path: info.outputPath(`tutor-${index}.png`), fullPage: true })
  }
  await signOut(page)
  await login(page, 'admin-a')
  for (const path of ['/admin/health', '/admin/users', '/admin/programme', '/admin/data']) {
    await page.goto(path)
    await expect(page.locator('main h1')).toBeVisible()
    await audit(page)
  }
  await signOut(page)
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('login.png'), fullPage: true })
})

test('programme cards and sidebar intake links keep records separated through refresh', async ({
  page,
}) => {
  await login(page)
  await expect(
    page.locator('main').getByRole('link', { name: /^Open (CSML|CS|ML) \d\d\/\d\d$/ }),
  ).toHaveCount(9)
  await intake(page)
  await expect(page.getByRole('link', { name: /^Batch [123]$/ })).toHaveCount(3)
  await page.getByRole('link', { name: 'Open course CSML 25/26', exact: true }).click()
  await expect(page.locator('main h1')).toHaveText('CSML 25/26')
  await expect(page.getByRole('link', { name: /^Batch / })).toHaveCount(0)
  await page.reload()
  await expect(page.locator('main h1')).toHaveText('CSML 25/26')
  await page.getByRole('link', { name: 'Open course ML 26/27', exact: true }).click()
  await expect(page.locator('main h1')).toHaveText('ML 26/27')
})

test('search, status filters, score sorting and bounded pagination work on applicant rows', async ({
  page,
}) => {
  await login(page)
  await intake(page)
  await page.getByRole('link', { name: 'Batch 1', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Applicants' }).getByRole('row')).toHaveCount(6)
  await page.getByRole('textbox', { name: 'Search applicant', exact: true }).fill('Carson Darrin')
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2)
  await page.getByRole('textbox', { name: 'Search applicant', exact: true }).fill('no-such-person')
  await expect(page.getByText('No applicants match your filters.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Search applicant', exact: true }).fill('')
  await page.getByRole('combobox', { name: 'All status', exact: true }).click()
  await page.getByRole('option', { name: 'failed', exact: true }).click()
  await expect(page.getByRole('link', { name: 'View Sara Soudan', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'All status', exact: true }).click()
  await page.getByRole('option', { name: 'All status', exact: true }).click()
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).click()
  await page.getByRole('option', { name: 'Highest score', exact: true }).click()
  await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('Ashy Handgun')
  for (const header of [
    'Id',
    'Name',
    'Student ID',
    'State',
    'University',
    'Score',
    'AI',
    'Decision',
  ]) {
    const column = page.getByRole('columnheader', { name: header, exact: true })
    await column.getByRole('button', { name: header, exact: true }).click()
    await expect(column).toHaveAttribute('aria-sort', 'ascending')
    await column.getByRole('button', { name: header, exact: true }).click()
    await expect(column).toHaveAttribute('aria-sort', 'descending')
  }
  await expect(
    page.getByRole('columnheader', { name: 'Actions', exact: true }).getByRole('button'),
  ).toHaveCount(0)
  await page.getByRole('spinbutton', { name: 'Go to', exact: true }).fill('99')
  await expect(page.getByRole('spinbutton', { name: 'Go to', exact: true })).toHaveValue('1')
})

test('the three final tutor outcomes save directly and persist separately from the recommendation', async ({
  page,
}) => {
  await login(page)
  const original = (await dataset(page)).applications.find((a) => a.id === 'APP-2026-0143')!.runs
  for (const outcome of ['Conditional', 'Unconditional', 'Reject']) {
    await page.goto('/applications/APP-2026-0143/decision')
    await expect(page.getByRole('radio')).toHaveCount(3)
    await page.getByRole('radio', { name: outcome, exact: true }).check()
    await page.getByRole('button', { name: 'Record decision', exact: true }).click()
    await expect(page).toHaveURL(/\/applications\/APP-2026-0143$/)
    expect(
      (await dataset(page)).applications.find((a) => a.id === 'APP-2026-0143')!.decisions.at(-1)
        ?.outcome,
    ).toBe(outcome)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
  await page.reload()
  const saved = (await dataset(page)).applications.find((a) => a.id === 'APP-2026-0143')!
  expect(saved.runs).toEqual(original)
  expect(saved.decisions.at(-1)?.outcome).toBe('Reject')
})

test('flag correction preserves original facts, creates a run and enables final decisions', async ({
  page,
}) => {
  await login(page)
  await page.goto('/applications/APP-2026-0142/decision')
  for (const radio of await page.getByRole('radio').all()) await expect(radio).toBeDisabled()
  await page.getByRole('tab', { name: 'Review flag', exact: true }).click()
  await page.getByRole('link', { name: 'Update detail', exact: true }).click()
  await page.getByLabel('Corrected value', { exact: false }).fill('74')
  await page
    .getByLabel('Reason for correction', { exact: false })
    .fill('Transcript page 2 confirms 74%.')
  await page.getByRole('button', { name: 'Save & re-evaluate', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Record decision', exact: true })).toBeEnabled()
  await page.getByRole('tab', { name: 'Record decision', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Conditional', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Record decision', exact: true }).click()
  const app = (await dataset(page)).applications.find((a) => a.id === 'APP-2026-0142')!
  expect(app.runs).toHaveLength(2)
  expect(app.runs[0].extractedGrade).toBe(71)
  expect(app.corrections[0].value).toBe(74)
  await page.goto(`/applications/APP-2026-0142?run=${encodeURIComponent(app.runs[0].id)}`)
  await expect(page.getByText(/Viewing a previous assessment/)).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Record decision', exact: true })).toBeDisabled()
})

test('criteria edits preserve existing results without exposing history', async ({ page }) => {
  await login(page)
  await intake(page)
  const original = await dataset(page)
  const before = JSON.stringify(original.applications)
  await page.getByRole('tab', { name: 'Admission criteria', exact: true }).click()
  await page.getByLabel('CV & experience (%)', { exact: true }).fill('15')
  await page.getByLabel('Personal statement (%)', { exact: true }).fill('35')
  await page.getByRole('button', { name: 'Save criteria', exact: true }).click()
  await expect
    .poll(async () => (await dataset(page)).activeRubricIds['programme-1'])
    .not.toBe(original.activeRubricIds['programme-1'])
  const saved = await dataset(page)
  expect(JSON.stringify(saved.applications)).toBe(before)
  expect(saved.rubrics).toEqual(expect.arrayContaining(original.rubrics))
  await expect(page.getByRole('heading', { name: 'Version history', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Load criteria/ })).toHaveCount(0)
  await page.getByLabel('CV & experience (%)', { exact: true }).fill('20')
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page.getByLabel('CV & experience (%)', { exact: true })).toHaveValue('15')
  await page.reload()
  await page.getByRole('tab', { name: 'Admission criteria', exact: true }).click()
  await expect(page.getByLabel('CV & experience (%)', { exact: true })).toHaveValue('15')
})

test('an individual applicant joins the selected batch without fabricated assessment data', async ({
  page,
}) => {
  await login(page)
  await intake(page)
  await page.getByRole('link', { name: 'Batch 1', exact: true }).click()
  const batchId = new URL(page.url()).pathname.split('/').at(-1)!
  await page.getByRole('link', { name: 'Add applicant', exact: true }).click()
  await page.getByLabel('Candidate reference', { exact: false }).fill('New applicant')
  await page
    .getByLabel('Upload CV', { exact: true })
    .setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: await pdf() })
  await expect(page.getByRole('button', { name: 'Create application', exact: true })).toBeEnabled()
  await page.getByLabel('Upload CV', { exact: true }).setInputFiles({
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('not a PDF'),
  })
  await expect(page.getByRole('alert')).toContainText('This PDF cannot be read.')
  await expect(page.getByRole('button', { name: 'Remove CV', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create application', exact: true })).toBeDisabled()
  await page
    .getByLabel('Upload CV', { exact: true })
    .setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: await pdf() })
  await page.getByRole('button', { name: 'Create application', exact: true }).click()
  await expect(page).toHaveURL(/\/applications\/APP-/)
  const app = (await dataset(page)).applications.find((a) => a.candidate === 'New applicant')!
  expect(app.batchId).toBe(decodeURIComponent(batchId))
  expect(app.runs).toEqual([])
  await page.getByRole('button', { name: 'Request evaluation', exact: true }).click()
  const summary = page.getByRole('region', { name: 'Application review' })
  await expect(summary.getByText('—', { exact: true })).toHaveCount(2)
  await expect(summary.getByText('Pending', { exact: true })).toBeVisible()
  expect(
    (await dataset(page)).applications.find((a) => a.id === app.id)!.runs.at(-1)?.overall,
  ).toBeNull()
})

test('ZIP batches preserve extracted PDFs and reject incomplete imports atomically', async ({
  page,
}) => {
  await login(page)
  await intake(page)
  const before = (await dataset(page)).applications.length
  await page.getByLabel('Application ZIP file', { exact: true }).setInputFiles({
    name: 'bad.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('not an archive'),
  })
  await page.getByRole('button', { name: 'Upload batch', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect((await dataset(page)).applications).toHaveLength(before)
  const original = await pdf()
  const archive = Buffer.from(
    zipSync({ 'Applicant A/cv.pdf': original, 'Applicant B/transcript.pdf': original }),
  )
  await page
    .getByLabel('Application ZIP file', { exact: true })
    .setInputFiles({ name: 'November.zip', mimeType: 'application/zip', buffer: archive })
  await page.getByRole('button', { name: 'Upload batch', exact: true }).click()
  await expect(page).toHaveURL(/\/batches\/[^/?]+$/)
  await expect(page.getByRole('link', { name: 'View Applicant A', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View Applicant B', exact: true })).toBeVisible()
  const saved = await dataset(page)
  expect(saved.applications).toHaveLength(before + 2)
  expect(
    saved.applications
      .filter((a) => ['Applicant A', 'Applicant B'].includes(a.candidate))
      .every((a) => a.runs.length === 0),
  ).toBe(true)
  await page.reload()
  await expect(page.getByRole('link', { name: 'View Applicant A', exact: true })).toBeVisible()
})

test('owner deletion requires confirmation and removes only that applicant', async ({ page }) => {
  await login(page)
  await intake(page)
  await page.getByRole('link', { name: 'Batch 1', exact: true }).click()
  const before = await dataset(page)
  await page.getByRole('button', { name: 'Delete Ashy Handgun', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await dataset(page)).applications).toHaveLength(before.applications.length)
  await page.getByRole('button', { name: 'Delete Ashy Handgun', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('table', { name: 'Applicants' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View Ashy Handgun', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('table', { name: 'Applicants' })).toBeVisible()
  expect((await dataset(page)).applications.some((a) => a.id === 'APP-2026-0143')).toBe(false)
  expect((await dataset(page)).applications.filter((a) => a.programmeId === 'programme-2')).toEqual(
    before.applications.filter((a) => a.programmeId === 'programme-2'),
  )
})

test('course-owner and administrator access checks survive direct links and sign-in changes', async ({
  page,
}) => {
  await login(page, 'tutor-b')
  await expect(page.locator('main').getByRole('link', { name: /^Open / })).toHaveCount(0)
  await page.goto('/applications/APP-2026-0142')
  await expect(page.getByText(/tutor access/i)).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(0)
  await createProgramme(page, 'Data Science & AI MSc')
  const owned = (await dataset(page)).programmes.find((p) => p.name === 'Data Science & AI MSc')!
  expect(owned.createdBy).toBe('tutor-b')
  await signOut(page)
  await login(page, 'admin-a')
  await page.goto('/applications/APP-2026-0142')
  await expect(page.locator('main h1')).toHaveText('Service health')
})

test('programme cards have no management shortcut and old management links return to the programme list', async ({
  page,
}) => {
  await login(page, 'tutor-b')
  await createProgramme(page, 'Statistics MSc')
  const saved = await dataset(page)
  const owned = saved.programmes.find((programme) => programme.name === 'Statistics MSc')!
  await page.goto('/modules')
  const cards = page.locator('main').getByRole('link')
  await expect(cards).toHaveCount(3)
  for (const card of await cards.all())
    await expect(card).toHaveAttribute('href', /^\/batches\?programme=/)
  await expect(page.getByRole('button', { name: 'Delete course', exact: true })).toHaveCount(0)
  await page.goto(`/modules/${encodeURIComponent(owned.id)}`)
  await expect(page).toHaveURL('/modules')
  await expect(page.locator('main h1')).toHaveText('Programme')
  expect((await dataset(page)).programmes).toEqual(saved.programmes)
})

test('course CSV export covers every intake and preserves formula escaping', async ({ page }) => {
  await login(page)
  await intake(page)
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export results as CSV', exact: true }).click()
  const path = await (await downloaded).path()
  expect(path).toBeTruthy()
  const csv = await readFile(path!, 'utf8')
  expect(csv).toContain('Intake year')
  expect(csv).toContain('Tutor decision')
  expect(csv.split('\r\n')).toHaveLength(9)
  await page.getByRole('tab', { name: 'Analytics', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Decision overview', exact: true })).toBeVisible()
})

test('interrupted simulated evaluation recovers after refresh without losing its run', async ({
  page,
}) => {
  await login(page)
  await page.goto('/applications/APP-2026-0143')
  await page.getByRole('button', { name: 'Re-evaluate application', exact: true }).click()
  await expect
    .poll(
      async () =>
        (await dataset(page)).applications.find((a) => a.id === 'APP-2026-0143')!.runs.length,
    )
    .toBe(2)
  await page.reload()
  await expect(page.getByText('88.5', { exact: true })).toBeVisible()
  const app = (await dataset(page)).applications.find((a) => a.id === 'APP-2026-0143')!
  expect(app.runs).toHaveLength(2)
  expect(app.runs.at(-1)?.status).toBe('awaiting review')
})

test('keyboard users can select review tabs and open navigation on a small screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page)
  await page.goto('/applications/APP-2026-0143')
  const first = page.getByRole('tab', { name: 'AI recommendation', exact: true })
  await first.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tab', { name: 'Review flag', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Open course CSML 26/27', exact: true }),
  ).toBeVisible()
})
test('admin account/programme editing, deletion, backup restore and reset persist', async ({
  page,
}) => {
  await login(page, 'admin-a')
  await page.goto('/admin/programme')
  await page.getByRole('textbox', { name: 'Course code', exact: true }).fill('COMP0009')
  await page.getByRole('button', { name: 'Save programme' }).click()
  await expect(page.getByRole('status')).toContainText('Programme metadata saved')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Course code', exact: true })).toHaveValue(
    'COMP0009',
  )
  await page.goto('/admin/users')
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Demo new tutor')
  await page.getByLabel('Demo email').fill('new@demo.ucl.local')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('cell', { name: /^Demo new tutor/ })).toBeVisible()
  await page.getByRole('button', { name: 'Edit Demo new tutor', exact: true }).click()
  await page.getByRole('switch', { name: 'Account active' }).uncheck()
  await page.getByRole('button', { name: 'Save account' }).click()
  await expect(page.getByRole('row', { name: /Demo new tutor/ })).toContainText('Inactive')
  await page.goto('/admin/data')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Create backup', exact: true }).click()
  const download = await downloaded
  const path = await download.path()
  expect(path).toBeTruthy()
  await page.getByLabel('Application identifier').fill('APP-2026-0142')
  await page.getByRole('button', { name: 'Review deletion impact' }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'were deleted' })).toBeVisible()
  await page.getByLabel('Import demo backup').setInputFiles(path!)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Browser demo restored' })).toBeVisible()
  await page.getByRole('button', { name: 'Reset demo dataset' }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'reset to the original' })).toBeVisible()
  await page.goto('/admin/programme')
  await expect(page.getByRole('textbox', { name: 'Course code', exact: true })).toHaveValue(
    'COMP0001',
  )
})
