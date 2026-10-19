import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PDFDocument } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import { zipSync } from 'fflate'
import type { Dataset } from '../src/domain/types'

async function login(page: Page, role = 'tutor-a', enterDefault = true) {
  await page.goto('/login')
  await page.getByRole('combobox', { name: 'Account', exact: true }).click()
  await page
    .getByRole('option', {
      name:
        role === 'admin-a'
          ? 'Demo administrator'
          : role === 'tutor-b'
            ? 'Demo tutor B'
            : 'Jack · Demo tutor',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(
    page.getByRole('heading', {
      name: role === 'admin-a' ? 'Service health' : 'Courses',
      exact: true,
      level: 1,
    }),
  ).toBeVisible()
  if (role !== 'admin-a' && enterDefault)
    await chooseModule(page, 'Computational Statistics and Machine Learning MSc')
}
async function chooseModule(page: Page, name: string, intake = '26/27') {
  await page.goto('/modules')
  await page
    .locator('main')
    .getByRole('link', { name: `Open course ${name}`, exact: true })
    .click()
  await page.getByRole('button', { name: `Open ${intake} intake`, exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Upload batches', exact: true, level: 1 }),
  ).toBeVisible()
  await expect(page.locator('main').getByRole('progressbar')).toHaveCount(0)
  const existing = page.getByRole('link', { name: 'Open batch 1', exact: true })
  if (await existing.count()) await existing.click()
}
async function signOut(page: Page) {
  if (!(await page.getByRole('button', { name: 'Sign out', exact: true }).isVisible()))
    await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
}
async function openAssessmentHistory(page: Page) {
  const history = page.getByRole('button', { name: 'Assessment history', exact: true })
  if ((await history.getAttribute('aria-expanded')) !== 'true') await history.click()
}
async function reEvaluate(page: Page) {
  await openAssessmentHistory(page)
  await page.getByRole('button', { name: 'Re-evaluate application', exact: true }).click()
}
async function newWorkspace(page: Page, name: string) {
  await page.goto('/modules')
  await page.getByRole('button', { name: 'Add course', exact: true }).click()
  await page.getByRole('textbox', { name: 'Course name' }).fill(name)
  await page.getByRole('button', { name: 'Add course', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(/\/modules\/[^/]+$/)
}
async function uploadTranscript(page: Page, candidate: string) {
  await page.goto('/applications/new')
  const pdf = await PDFDocument.create()
  pdf.addPage([595, 842])
  await page.getByLabel('Upload Transcript', { exact: true }).setInputFiles({
    name: 'Original.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save()),
  })
  await expect(page.getByText('Original.pdf · 1 pages')).toBeVisible()
  await page.getByLabel('Candidate reference').fill(candidate)
  await page.getByRole('button', { name: 'Create application', exact: true }).click()
  await expect(page).toHaveURL(/\/applications\/APP-/)
  return page.url()
}
async function audit(page: Page) {
  // Audit settled controls, including colour transitions when queries enable a button.
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
        .map((animation) => animation.finished.catch(() => undefined)),
    )
  })
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
  ).toEqual([])
}
async function checkBackPosition(page: Page) {
  const back = page.getByRole('link', { name: 'Back', exact: true })
  if (!(await back.count())) return
  await expect(back).toBeVisible()
  const button = await back.boundingBox()
  const toolbar = await back.locator('..').boundingBox()
  expect(button).not.toBeNull()
  expect(toolbar).not.toBeNull()
  expect(Math.abs(button!.x + button!.width - toolbar!.x - toolbar!.width)).toBeLessThanOrEqual(1)
}
async function screenshot(page: Page, path: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    window.scrollTo(0, 0)
  })
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
}
test('all fifteen screens render at desktop and mobile sizes with no serious accessibility findings', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  const logo = page.getByRole('img', { name: 'UCL', exact: true })
  await expect(logo).toBeVisible()
  await expect(logo).toHaveJSProperty('naturalWidth', 167)
  await audit(page)
  await screenshot(page, testInfo.outputPath('00-login-desktop.png'))
  await login(page)
  await expect(page.getByRole('link', { name: 'UCL', exact: true })).toHaveAttribute(
    'href',
    '/modules',
  )
  await expect(page.getByRole('img', { name: 'UCL', exact: true })).toHaveJSProperty(
    'naturalWidth',
    167,
  )
  await expect(page.getByRole('columnheader')).toHaveText([
    'Application',
    'Score',
    'AI recommendation',
    'Decision',
  ])
  const tutorRoutes = [
    '/modules',
    '/modules/programme-1',
    '/applications',
    '/batches',
    '/applications/new',
    '/applications/APP-2026-0142',
    '/applications/APP-2026-0142/evidence?document=APP-2026-0142-transcript&page=2',
    '/applications/APP-2026-0142/correct',
    '/applications/APP-2026-0142/decision',
    '/criteria',
  ]
  for (const [i, path] of tutorRoutes.entries()) {
    await page.goto(path)
    await expect(page.locator('main h1')).toBeVisible()
    if (path.includes('/evidence')) {
      await expect(page.getByText('Loading PDF page…')).toBeHidden()
      await page.getByText('Accessible page text').click()
      await expect(page.locator('pre')).toContainText('74%')
      await page.getByText('Accessible page text').click()
    }
    await audit(page)
    await checkBackPosition(page)
    await screenshot(page, testInfo.outputPath(`tutor-${i}-desktop.png`))
  }
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/modules$/)
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [i, path] of tutorRoutes.entries()) {
    await page.goto(path)
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
    if (path.includes('/evidence')) {
      await expect(page.getByText('Loading PDF page…')).toBeHidden()
      await page.getByText('Accessible page text').click()
      await expect(page.locator('pre')).toContainText('74%')
      await page.getByText('Accessible page text').click()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await audit(page)
    await checkBackPosition(page)
    await screenshot(page, testInfo.outputPath(`tutor-${i}-mobile.png`))
  }
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('img', { name: 'UCL', exact: true })).toBeVisible()
  await screenshot(page, testInfo.outputPath('navigation-mobile.png'))
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page, 'admin-a')
  for (const [i, path] of [
    '/admin/health',
    '/admin/users',
    '/admin/programme',
    '/admin/data',
  ].entries()) {
    await page.goto(path)
    await expect(page.locator('main h1')).toBeVisible()
    await audit(page)
    await screenshot(page, testInfo.outputPath(`admin-${i}-desktop.png`))
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await audit(page)
    await screenshot(page, testInfo.outputPath(`admin-${i}-mobile.png`))
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  await page.goto('/applications/APP-2026-0142/evidence')
  await expect(page).toHaveURL(/\/admin\/health$/)
  await page.goto('/login')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
  await expect(page.getByRole('img', { name: 'UCL', exact: true })).toHaveJSProperty(
    'naturalWidth',
    167,
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await audit(page)
  await screenshot(page, testInfo.outputPath('00-login-mobile.png'))
  expect(errors).toEqual([])
})
test('application review prioritises the outcome and concerns with expandable details', async ({
  page,
}, testInfo) => {
  await login(page)
  await page.getByRole('link', { name: 'Open APP-2026-0142', exact: true }).click()
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.reload()
    const summary = page.getByRole('region', { name: 'Application summary', exact: true })
    await expect(summary.getByText('78.4', { exact: true })).toBeVisible()
    await expect(summary.getByText('Further review', { exact: true })).toBeVisible()
    await expect(summary.getByRole('link', { name: 'Record decision', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Needs attention', exact: true })).toBeVisible()
    await expect(page.getByText('GRADE MISMATCH', { exact: true })).toHaveCount(0)
    const correction = page.getByRole('link', { name: 'Inspect & correct fact', exact: true })
    await expect(correction).toBeVisible()
    const correctionBounds = await correction.boundingBox()
    expect(correctionBounds!.y + correctionBounds!.height).toBeLessThan(viewport.height)
    const history = page.getByRole('button', { name: 'Assessment history', exact: true })
    await expect(history).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('combobox', { name: 'Assessment run', exact: true })).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Re-evaluate application', exact: true }),
    ).toHaveCount(0)
    const academic = page.getByRole('button', { name: /Academic performance/ })
    await expect(academic).toHaveAttribute('aria-expanded', 'false')
    await audit(page)
    await screenshot(page, testInfo.outputPath(`application-review-${viewport.name}.png`))
    await academic.focus()
    await academic.press('Enter')
    await expect(academic).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('Moderate uncertainty', { exact: true })).toBeVisible()
    const rules = page.locator('summary').filter({ hasText: 'Scoring rules' })
    await rules.focus()
    await rules.press('Enter')
    await expect(rules.locator('..')).toHaveAttribute('open', '')
    await history.focus()
    await history.press('Enter')
    await expect(page.getByRole('combobox', { name: 'Assessment run', exact: true })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Re-evaluate application', exact: true }),
    ).toBeEnabled()
    await audit(page)
    await screenshot(page, testInfo.outputPath(`application-review-expanded-${viewport.name}.png`))
  }
  await page
    .getByRole('link', { name: /Transcript.pdf.*p\.2/ })
    .first()
    .click()
  await expect(page).toHaveURL(/document=APP-2026-0142-transcript.*page=2/)
  await expect(page.getByText('Loading PDF page…')).toBeHidden()
  await page.getByText('Accessible page text').click()
  await expect(page.locator('pre')).toContainText('Final weighted average: 74%')
})

test('tutor correction, evidence review, direct decision recording and persistence work end to end', async ({
  page,
}) => {
  await login(page)
  await page.getByRole('link', { name: 'Open APP-2026-0142', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Why this recommendation' })).toBeVisible()
  await page.getByRole('link', { name: 'Record decision', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Offer', exact: true })).toBeDisabled()
  await page.goto('/applications/APP-2026-0142/correct')
  await expect(page.getByLabel('Corrected value (%)')).toHaveValue('71')
  await page.getByLabel('Corrected value (%)').fill('74')
  await page.getByLabel('Reason for correction').fill('Original transcript page 2 states 74%.')
  await page.getByRole('button', { name: 'Save & re-evaluate' }).click()
  await expect(page).toHaveURL(/\/applications\/APP-2026-0142$/)
  await page.reload()
  await expect(page.getByRole('link', { name: 'Record decision', exact: true })).toBeEnabled()
  await expect(page.getByRole('heading', { name: 'Needs attention', exact: true })).toHaveCount(0)
  await openAssessmentHistory(page)
  await expect(page.getByText('Grade corrected: 71% → 74%')).toBeVisible()
  await page.getByRole('link', { name: 'Record decision', exact: true }).click()
  await page.getByRole('radio', { name: 'Offer', exact: true }).check()
  await expect(page.getByRole('button', { name: 'Record offer', exact: true })).toBeEnabled()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByLabel('Review note (optional)')).toHaveValue('')
  await expect(page.getByLabel(/Reason for override/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Record offer', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/applications\/APP-2026-0142$/)
  await page.reload()
  await expect(
    page
      .getByRole('group', { name: 'Tutor decision', exact: true })
      .getByText('Offer', { exact: true }),
  ).toBeVisible()
  await openAssessmentHistory(page)
  await expect(page.getByText(/Decision recorded ·/)).toBeVisible()
  await page.goto('/batches')
  const overview = page.getByRole('region', { name: 'Intake overview' })
  await expect(overview.getByRole('heading', { name: 'Offers given' })).toBeVisible()
  await expect(
    overview
      .locator('.MuiPaper-root')
      .filter({ hasText: 'Offers given' })
      .getByText('2', { exact: true }),
  ).toBeVisible()
  await expect(overview.getByText('3 / 8', { exact: true })).toBeVisible()
  await expect(
    page
      .getByRole('table', { name: 'Previous batches' })
      .getByRole('row', { name: /Open batch 1/ })
      .getByRole('cell')
      .nth(3),
  ).toHaveText('4')
  await page.reload()
  await expect(overview.getByText('3 / 8', { exact: true })).toBeVisible()
  await expect(
    page
      .getByRole('table', { name: 'Previous batches' })
      .getByRole('row', { name: /Open batch 1/ })
      .getByRole('cell')
      .nth(3),
  ).toHaveText('4')
  await page.goto('/applications/APP-2026-0142/evidence?document=APP-2026-0142-transcript&page=2')
  await page.getByText('Accessible page text').click()
  await expect(page.locator('pre')).toContainText('Final weighted average: 74%')
  await page.goto('/applications/APP-2026-0142/evidence?document=invalid&page=99')
  await expect(page.locator('main').getByRole('alert')).toContainText('unavailable')
  await page.goto('/criteria')
  await expect(page.getByLabel('Academic performance (%)')).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Activate draft' })).toHaveCount(0)
  await expect(page.getByText('Active: v1.0')).toBeVisible()
  await page.goto('/batches')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export course results' }).click()
  expect((await download).suggestedFilename()).toContain('.csv')
})
test('tutors record a different outcome without a note on desktop and mobile', async ({
  page,
}, testInfo) => {
  await login(page)
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/applications/APP-2026-0143/decision')
    await expect(page.getByText('AI recommendation: Offer', { exact: true })).toBeVisible()
    await page.getByRole('radio', { name: 'Reject', exact: true }).check()
    const note = page.getByLabel('Review note (optional)', { exact: true })
    await expect(note).toHaveValue('')
    await expect(note).not.toHaveAttribute('required')
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Record reject', exact: true })).toBeEnabled()
    await audit(page)
    await screenshot(page, testInfo.outputPath(`decision-form-${viewport.name}.png`))
    await page.getByRole('button', { name: 'Record reject', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/\/applications\/APP-2026-0143$/)
    await page.reload()
    const summary = page.getByRole('region', { name: 'Application summary', exact: true })
    await expect(summary.getByText('Offer', { exact: true })).toBeVisible()
    await expect(
      summary
        .getByRole('group', { name: 'Tutor decision', exact: true })
        .getByText('Reject', { exact: true }),
    ).toBeVisible()
    await openAssessmentHistory(page)
    await expect(page.getByText(/Decision recorded ·/)).toBeVisible()
    await expect(page.getByText('Tutor recorded: Reject', { exact: true })).toHaveCount(1)
    await audit(page)
  }
})

test('PDF validation, new uploads and backend-unavailable state are honest', async ({ page }) => {
  await login(page)
  await page.goto('/applications/new')
  await page.getByLabel('Upload Transcript', { exact: true }).setInputFiles({
    name: 'oversized.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(21 * 1024 * 1024),
  })
  await expect(page.getByRole('alert').filter({ hasText: '20 MB' })).toBeVisible()
  const oversizedPages = await PDFDocument.create()
  for (let i = 0; i < 101; i++) oversizedPages.addPage([595, 842])
  await page.getByLabel('Upload Transcript', { exact: true }).setInputFiles({
    name: 'too-many-pages.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await oversizedPages.save()),
  })
  await expect(page.getByRole('alert').filter({ hasText: '100 pages' })).toBeVisible()
  await page.getByLabel('Upload Transcript', { exact: true }).setInputFiles({
    name: 'corrupt.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('broken'),
  })
  await expect(page.getByRole('alert').filter({ hasText: 'cannot be read' })).toBeVisible()
  const pdf = await PDFDocument.create()
  pdf.addPage([595, 842])
  const buffer = Buffer.from(await pdf.save())
  await page
    .getByLabel('Upload Transcript', { exact: true })
    .setInputFiles({ name: 'Original.pdf', mimeType: 'application/pdf', buffer })
  await expect(page.getByText('Original.pdf · 1 pages')).toBeVisible()
  await page.getByLabel('Candidate reference').fill('SYN-NEW')
  await page.getByRole('button', { name: 'Create application' }).click()
  await expect(page).toHaveURL(/\/applications\/APP-2026-\d+$/)
  const reference = new URL(page.url()).pathname.split('/').at(-1)!
  await expect(page.getByRole('heading', { name: reference, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Request evaluation' }).click()
  await expect(page.getByText('Not assessed', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Not assessed', { exact: true })).toBeVisible()
  await expect(
    page.getByText('No assessment available for these documents.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'View documents' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'unavailable' })).toHaveCount(0)
})

test('keyboard users can sign in, skip navigation and choose a PDF', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('combobox', { name: 'Account' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/modules$/)
  await chooseModule(page, 'Computational Statistics and Machine Learning MSc')
  await page.goto('/applications')
  await expect(page.locator('main h1')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
  await page.goto('/applications/new')
  const button = page.getByRole('button', { name: 'Choose PDF' }).first()
  await button.focus()
  const choosing = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  const picker = await choosing
  const pdf = await PDFDocument.create()
  pdf.addPage([595, 842])
  await picker.setFiles({
    name: 'Keyboard.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save()),
  })
  await expect(page.getByText('Keyboard.pdf · 1 pages')).toBeVisible()
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

test('module cards, sidebar links and intake years keep applications separated and persistent', async ({
  page,
}) => {
  await login(page, 'tutor-a', false)
  await expect(page).toHaveURL(/\/modules$/)
  await expect(page.locator('main').getByRole('link')).toHaveCount(3)
  for (const name of [
    'Computational Statistics and Machine Learning MSc',
    'Machine Learning MSc',
    'Computer Science MSc',
  ])
    await expect(
      page.locator('main').getByRole('link', { name: `Open course ${name}`, exact: true }),
    ).toBeVisible()
  const navigation = page.getByRole('navigation', { name: 'Workspace navigation' })
  await expect(navigation.getByRole('combobox')).toHaveCount(0)
  await expect(navigation.getByRole('button', { name: 'Add course' })).toHaveCount(0)
  await expect(navigation.getByRole('link', { name: 'Applications', exact: true })).toHaveCount(0)
  await page
    .locator('main')
    .getByRole('link', {
      name: 'Open course Computational Statistics and Machine Learning MSc',
      exact: true,
    })
    .click()
  for (const year of ['24/25', '25/26', '26/27'])
    await expect(
      page.getByRole('button', { name: `Open ${year} intake`, exact: true }),
    ).toBeVisible()
  await screenshot(page, test.info().outputPath('module-intakes-desktop.png'))
  await page.getByRole('button', { name: 'Open 25/26 intake' }).click()
  await expect(
    page.getByText('No batches yet. Upload a ZIP to add applicants to this intake.'),
  ).toBeVisible()
  const applicationUrl = await uploadTranscript(page, 'INTAKE-25-ONLY')
  await expect(page.getByRole('heading', { name: /^APP-2026-\d+$/ })).toBeVisible()
  await expect(
    page.getByRole('banner').getByRole('link', { name: '25/26 intake', exact: true }),
  ).toHaveCount(0)
  await page.goto('/batches')
  await expect(page.locator('main').getByText(/25\/26 intake$/)).toBeVisible()
  await page.goto('/applications')
  await expect(page.getByRole('cell', { name: /INTAKE-25-ONLY/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('cell', { name: /INTAKE-25-ONLY/ })).toBeVisible()
  await page.goto('/batches')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export course results' }).click()
  const csv = await readFile((await (await downloading).path())!, 'utf8')
  expect(csv).toContain('2025 / 26')
  expect(csv).toContain('INTAKE-25-ONLY')
  expect(csv).toContain('SYN-142')
  await chooseModule(page, 'Computational Statistics and Machine Learning MSc', '26/27')
  await expect(page.getByRole('link', { name: 'Open APP-2026-0142' })).toBeVisible()
  await expect(page.getByText('INTAKE-25-ONLY')).toHaveCount(0)
  await page.goto(applicationUrl)
  await expect(page.getByRole('heading', { name: /^APP-2026-\d+$/ })).toBeVisible()
  await expect(
    page.getByRole('banner').getByRole('link', { name: '25/26 intake', exact: true }),
  ).toHaveCount(0)
  await page.goto('/batches')
  await expect(page.locator('main').getByText(/25\/26 intake$/)).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await audit(page)
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Open course Machine Learning MSc', exact: true })
    .click()
  await expect(page).toHaveURL(/\/modules\/programme-2$/)
  await page.getByRole('button', { name: 'Open 24/25 intake' }).click()
  await expect(
    page.getByText('No batches yet. Upload a ZIP to add applicants to this intake.'),
  ).toBeVisible()
  await page.reload()
  await expect(page.locator('main').getByText(/24\/25 intake$/)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Export course results', exact: true }),
  ).toBeEnabled()
  await audit(page)
  await screenshot(page, test.info().outputPath('intake-queue-mobile.png'))
  await signOut(page)
  await login(page, 'tutor-a', false)
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible()
})

test('course owners save versioned criteria without changing existing assessments', async ({
  page,
}, testInfo) => {
  await login(page)
  const snapshot = () =>
    page.evaluate(
      () =>
        new Promise<Dataset>((resolve, reject) => {
          const request = indexedDB.open('ucl-admissions-demo', 1)
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const database = request.result
            const transaction = database.transaction('state')
            const read = transaction.objectStore('state').get('dataset')
            read.onsuccess = () => resolve(read.result as Dataset)
            read.onerror = () => reject(read.error)
            transaction.oncomplete = () => database.close()
          }
        }),
    )
  const before = await snapshot()
  await page.goto('/criteria')
  await page.getByLabel('Academic performance (%)').fill('60')
  await expect(page.getByRole('button', { name: 'Save criteria', exact: true })).toBeDisabled()
  await page.getByLabel('CV & experience (%)').fill('20')
  await page.getByLabel('Personal statement (%)').fill('20')
  await page.getByLabel('Offer from', { exact: true }).fill('95')
  await page.getByLabel('Review margin (± points)').fill('2.5')
  await expect(page.getByText('100% · Valid')).toBeVisible()
  await page.getByRole('button', { name: 'Save criteria', exact: true }).click()
  await expect(page.getByText('Active: v1.1', { exact: true })).toBeVisible()
  await expect(page.getByText('v1.0 · Preserved', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Academic performance (%)')).toHaveValue('60')
  await expect(page.getByLabel('Offer from', { exact: true })).toHaveValue('95')
  const after = await snapshot()
  expect(after.applications).toEqual(before.applications)
  expect(after.documents).toEqual(before.documents)
  expect(after.rubrics.slice(0, -1)).toEqual(before.rubrics)
  expect(after.activeRubricIds['programme-2']).toBe(before.activeRubricIds['programme-2'])
  await audit(page)
  await screenshot(page, testInfo.outputPath('criteria-saved-desktop.png'))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByLabel('Reject below', { exact: true }).fill('65')
  await page.getByRole('button', { name: 'Save criteria', exact: true }).click()
  await expect(page.getByText('Active: v1.2', { exact: true })).toBeVisible()
  await audit(page)
  await screenshot(page, testInfo.outputPath('criteria-saved-mobile.png'))
  await page.getByRole('button', { name: 'Load criteria v1.0', exact: true }).click()
  await expect(page.getByLabel('Academic performance (%)')).toHaveValue('50')
  await expect(page.getByLabel('CV & experience (%)')).toHaveValue('25')
  await expect(page.getByLabel('Personal statement (%)')).toHaveValue('25')
  await expect(page.getByLabel('Offer from', { exact: true })).toHaveValue('80')
  await expect(page.getByLabel('Reject below', { exact: true })).toHaveValue('60')
  await expect(page.getByLabel('Review margin (± points)')).toHaveValue('3')
  await expect(page.getByText('Active: v1.2', { exact: true })).toBeVisible()
  await expect(page.getByText('Loaded v1.0 into the form', { exact: true })).toBeVisible()
  await expect(page.getByRole('form', { name: 'Admission criteria', exact: true })).toBeFocused()
  await audit(page)
  await screenshot(page, testInfo.outputPath('criteria-loaded-mobile.png'))
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page.getByLabel('Offer from', { exact: true })).toHaveValue('95')
  await expect(page.getByText('Loaded v1.0 into the form', { exact: true })).toHaveCount(0)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await chooseModule(page, 'Machine Learning MSc')
  await page.goto('/criteria')
  await expect(page.getByText('Active: v1.0', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Offer from', { exact: true })).toHaveValue('85')
  await page.goto('/applications/APP-2026-0143')
  await expect(page.getByText('Criteria v1.0', { exact: true })).toBeVisible()
  await reEvaluate(page)
  await expect(page.getByText('Criteria v1.2', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Re-evaluate application', exact: true }),
  ).toBeEnabled()
  const evaluated = await snapshot()
  const original = before.applications.find((a) => a.id === 'APP-2026-0143')!
  const updated = evaluated.applications.find((a) => a.id === original.id)!
  expect(updated.runs.slice(0, -1)).toEqual(original.runs)
  expect(updated.runs.at(-1)?.rubricId).toBe(evaluated.activeRubricIds['programme-1'])
  expect(updated.runs.at(-1)?.recommendation).toBe('Further review')
  expect(updated.decisions).toEqual(original.decisions)
  await page.goto('/criteria')
  const oldVersion = page.getByRole('button', { name: 'Load criteria v1.0', exact: true })
  await oldVersion.focus()
  await oldVersion.press('Enter')
  await expect(page.getByLabel('Academic performance (%)')).toHaveValue('50')
  await expect(oldVersion).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('form', { name: 'Admission criteria', exact: true })).toBeFocused()
  const loaded = await snapshot()
  expect(loaded.activeRubricIds).toEqual(evaluated.activeRubricIds)
  expect(loaded.rubrics).toEqual(evaluated.rubrics)
  expect(loaded.applications).toEqual(evaluated.applications)
  await page.getByRole('button', { name: 'Save criteria', exact: true }).click()
  await expect(page.getByText('Active: v1.3', { exact: true })).toBeVisible()
  await expect(page.getByText('v1.2 · Preserved', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Offer from', { exact: true })).toHaveValue('80')
  await expect(page.getByText('Active: v1.3', { exact: true })).toBeVisible()
  const restored = await snapshot()
  expect(restored.rubrics.slice(0, -1)).toEqual(evaluated.rubrics)
  expect(restored.rubrics.at(-1)).toMatchObject({
    weights: { academic: 50, cv: 25, statement: 25 },
    offerFrom: 80,
    rejectBelow: 60,
    margin: 3,
  })
  expect(restored.activeRubricIds['programme-1']).not.toBe(before.activeRubricIds['programme-1'])
  expect(restored.applications).toEqual(evaluated.applications)
  await audit(page)
  await screenshot(page, testInfo.outputPath('criteria-restored-desktop.png'))
  await page.goto('/applications/APP-2026-0143')
  await reEvaluate(page)
  await expect(page.getByText('Criteria v1.3', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Re-evaluate application', exact: true }),
  ).toBeEnabled()
  const reassessed = (await snapshot()).applications.find((a) => a.id === original.id)!
  expect(reassessed.runs.slice(0, -1)).toEqual(updated.runs)
  expect(reassessed.runs.at(-1)?.recommendation).toBe('Offer')
})

test('multi-module access keeps uploads and criteria scoped and guards unassigned deep links', async ({
  page,
}) => {
  await login(page)
  await chooseModule(page, 'Machine Learning MSc')
  await expect(page.getByRole('link', { name: 'Open APP-2026-0147' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open APP-2026-0142' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('banner')).toContainText('Machine Learning MSc')
  await page.goto('/applications/new')
  await expect(page.getByRole('textbox', { name: 'Course', exact: true })).toHaveValue(
    'Machine Learning MSc',
  )
  await page.goto('/criteria')
  await expect(page.getByRole('spinbutton', { name: 'Academic performance (%)' })).toHaveValue('60')
  await expect(page.getByRole('spinbutton', { name: 'Offer from' })).toBeEnabled()
  await chooseModule(page, 'Computational Statistics and Machine Learning MSc')
  await page.goto('/criteria')
  await expect(page.getByRole('spinbutton', { name: 'Offer from' })).toHaveValue('80')
  await signOut(page)
  await login(page, 'admin-a')
  await page.goto('/admin/users')
  await page.getByRole('button', { name: 'Edit Demo tutor B', exact: true }).click()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New programme' })).toHaveCount(0)
  await signOut(page)
  await login(page, 'tutor-b', false)
  await expect(page.getByRole('alert')).toContainText('Add a course to get started')
  await newWorkspace(page, 'COMP0003')
  await chooseModule(page, 'COMP0003')
  await expect(
    page.getByText('No batches yet. Upload a ZIP to add applicants to this intake.'),
  ).toBeVisible()
  await page.goto('/modules/programme-2')
  await expect(page.getByRole('heading', { name: 'Course unavailable' })).toBeVisible()
  await page.goto('/applications/APP-2026-0147/evidence')
  await expect(page.locator('main').getByRole('alert')).toContainText('tutor access')
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('tutors add courses by name from Courses and select an intake before uploading', async ({
  page,
}) => {
  await login(page, 'tutor-a', false)
  await page.getByRole('button', { name: 'Add course' }).click()
  await expect(page.getByRole('textbox', { name: 'Course name' })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Add course' })).toBeDisabled()
  await expect(page.locator('.MuiDialog-container')).toHaveCSS('opacity', '1')
  await audit(page)
  await page.getByRole('textbox', { name: 'Course name' }).fill('Data Science & AI MSc')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(
    page.getByRole('heading', { name: 'Data Science & AI MSc', exact: true, level: 1 }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Open 26/27 intake' }).click()
  await expect(
    page.getByText('No batches yet. Upload a ZIP to add applicants to this intake.'),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByRole('banner')).toContainText('Data Science & AI MSc')
  await page.goto('/modules')
  await page.getByRole('button', { name: 'Add course' }).click()
  await page.getByRole('textbox', { name: 'Course name' }).fill(' data science & ai msc ')
  await page.getByRole('button', { name: 'Add course' }).click()
  await expect(page.getByRole('alert')).toContainText('already have access')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await chooseModule(page, 'Data Science & AI MSc')
  await page.goto('/criteria')
  await expect(page.getByLabel('Academic performance (%)')).toBeEnabled()
  const applicationUrl = await uploadTranscript(page, 'ROBOTICS-CANDIDATE')
  await page.setViewportSize({ width: 390, height: 844 })
  await newWorkspace(page, 'Robotics MSc')
  await page.getByRole('button', { name: 'Open 26/27 intake' }).click()
  await expect(
    page.getByText('No batches yet. Upload a ZIP to add applicants to this intake.'),
  ).toBeVisible()
  await chooseModule(page, 'Data Science & AI MSc')
  await expect(page.getByRole('cell', { name: /ROBOTICS-CANDIDATE/ })).toBeVisible()
  await signOut(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page, 'tutor-b', false)
  await expect(
    page.locator('main').getByRole('link').filter({ hasText: 'Data Science & AI MSc' }),
  ).toHaveCount(0)
  await page.goto(applicationUrl)
  await expect(page.locator('main').getByRole('alert')).toContainText('tutor access')
})

test('owners delete workspaces from their intake page and recover after deleting the last module', async ({
  page,
}) => {
  await login(page, 'tutor-a', false)
  await newWorkspace(page, 'COMP0003')
  const moduleUrl = page.url()
  await page.getByRole('button', { name: 'Open 26/27 intake' }).click()
  const applicationUrl = await uploadTranscript(page, 'DELETABLE')
  await page.goto(moduleUrl)
  await page.getByRole('button', { name: 'Delete course' }).click()
  await expect(
    page.getByText('This will delete 1 application, 1 PDF and 1 criteria version.'),
  ).toBeVisible()
  await expect(page.locator('.MuiDialog-container')).toHaveCSS('opacity', '1')
  await audit(page)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await signOut(page)
  await login(page, 'tutor-b', false)
  await newWorkspace(page, 'Tutor B private course')
  await page.goto(moduleUrl)
  await expect(page.getByRole('heading', { name: 'Course unavailable' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete course' })).toHaveCount(0)
  await page.goto(applicationUrl)
  await expect(page.locator('main').getByRole('alert')).toContainText('tutor access')
  await signOut(page)
  await login(page, 'tutor-a', false)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(moduleUrl)
  await page.getByRole('button', { name: 'Delete course' }).click()
  await expect(page.getByText(/other tutor.*lose access/)).toHaveCount(0)
  await expect(page.locator('.MuiDialog-container')).toHaveCSS('opacity', '1')
  await audit(page)
  await screenshot(page, test.info().outputPath('delete-workspace-mobile.png'))
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(/\/modules$/)
  await page.reload()
  for (const name of [
    'Computational Statistics and Machine Learning MSc',
    'Machine Learning MSc',
    'Computer Science MSc',
  ]) {
    await page
      .locator('main')
      .getByRole('link', { name: `Open course ${name}`, exact: true })
      .click()
    await page.getByRole('button', { name: 'Delete course', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(page).toHaveURL(/\/modules$/)
  }
  await expect(page.getByRole('alert')).toContainText('do not have access to any courses')
  await newWorkspace(page, 'COMP0004')
  await page.getByRole('button', { name: 'Open 26/27 intake' }).click()
  await expect(
    page.getByText('No batches yet. Upload a ZIP to add applicants to this intake.'),
  ).toBeVisible()
  await signOut(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page, 'tutor-b', false)
  await expect(page.locator('main').getByRole('link').filter({ hasText: 'COMP0003' })).toHaveCount(
    0,
  )
  await page.goto(`${applicationUrl}/evidence`)
  await expect(page.locator('main').getByRole('alert')).toContainText('Application not found')
  await expect(page.locator('canvas')).toHaveCount(0)
})

async function applicantZip(names: string[]) {
  const files: Record<string, Uint8Array> = {}
  for (const name of names) {
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([595, 842])
    page.drawText(`Synthetic CV for ${name}`)
    files[`${name}/cv.pdf`] = await pdf.save()
  }
  return Buffer.from(zipSync(files))
}

test('ZIP batches separate applicant rows, preserve PDFs and persist through refresh and backup', async ({
  page,
}) => {
  await login(page, 'tutor-a', false)
  await page
    .getByRole('link', {
      name: 'Open course Computational Statistics and Machine Learning MSc',
      exact: true,
    })
    .first()
    .click()
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveAttribute(
    'href',
    '/modules',
  )
  await page.getByRole('button', { name: 'Open 25/26 intake' }).click()
  await expect(page.getByRole('heading', { name: 'Upload batches', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveAttribute(
    'href',
    '/modules/programme-1',
  )
  await page.getByRole('link', { name: 'Admission criteria', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Admission criteria', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Upload batches', exact: true })).toBeVisible()
  const overview = page.getByRole('region', { name: 'Intake overview' })
  await expect(overview.getByText('0 / 0', { exact: true })).toBeVisible()
  await page.getByLabel('Upload applicant ZIP').setInputFiles({
    name: 'November applications.zip',
    mimeType: 'application/zip',
    buffer: await applicantZip(['ZIP-001', 'ZIP-002']),
  })
  await page.getByRole('button', { name: 'Upload batch', exact: true }).click()
  await expect(page).toHaveURL(/\/batches\/[^/]+$/)
  const novemberUrl = page.url()
  await expect(page.getByRole('link', { name: 'Admission criteria', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Batch 1', exact: true })).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(3)
  await expect(page.getByRole('cell', { name: /ZIP-001/ })).toBeVisible()
  await expect(page.getByText('Not evaluated')).toHaveCount(2)
  const firstLink = page.getByRole('link', { name: /^Open APP-/ }).first()
  const appUrl = await firstLink.getAttribute('href')
  await firstLink.click()
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveAttribute(
    'href',
    new URL(novemberUrl).pathname,
  )
  await expect(page.getByText(/Your original PDFs are saved/)).toBeVisible()
  await page.getByRole('link', { name: 'View documents', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveAttribute(
    'href',
    appUrl!,
  )
  await expect(page.getByText('Loading PDF page…')).toBeHidden()
  await page.getByText('Accessible page text').click()
  await expect(page.locator('pre')).toContainText('Synthetic CV for ZIP-001')
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(new URL(appUrl!, novemberUrl).href)
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL(novemberUrl)
  await page.reload()
  await expect(page.getByRole('cell', { name: /ZIP-002/ })).toBeVisible()
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Open batch 1', exact: true })).toBeVisible()
  await expect(overview.getByText('0 / 2', { exact: true })).toBeVisible()
  await page.getByLabel('Upload applicant ZIP').setInputFiles({
    name: 'December applications.zip',
    mimeType: 'application/zip',
    buffer: await applicantZip(['ZIP-003']),
  })
  await page.getByRole('button', { name: 'Upload batch', exact: true }).click()
  await expect(page.getByRole('cell', { name: /ZIP-003/ })).toBeVisible()
  await expect(page.getByRole('cell', { name: /ZIP-001/ })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await audit(page)
  await screenshot(page, test.info().outputPath('batch-applicants-mobile.png'))
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await expect(overview.getByText('0 / 3', { exact: true })).toBeVisible()
  await expect(
    overview
      .locator('.MuiPaper-root')
      .filter({ hasText: 'Offers given' })
      .getByText('0', { exact: true }),
  ).toBeVisible()
  const batchTable = page.getByRole('table', { name: 'Previous batches' })
  await expect(
    overview
      .locator('.MuiPaper-root')
      .filter({ hasText: 'Total applicants' })
      .getByText('3', { exact: true }),
  ).toBeVisible()
  await expect(batchTable.getByRole('columnheader')).toHaveText([
    'Batch',
    'Date',
    'Applicants',
    'Pending human review',
  ])
  await expect(batchTable.getByRole('link')).toHaveText(['Batch 2', 'Batch 1'])
  for (const row of await batchTable.getByRole('row').all()) {
    const cells = row.getByRole('cell')
    if (await cells.count()) {
      await expect(cells.nth(1)).toHaveText(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$/)
      await expect(cells.nth(3)).toHaveText(await cells.nth(2).innerText())
    }
  }
  await expect(
    batchTable
      .getByRole('row', { name: /Open batch 1/ })
      .getByRole('cell')
      .nth(2),
  ).toBeVisible()
  await expect(
    batchTable
      .getByRole('row', { name: /Open batch 2/ })
      .getByRole('cell')
      .nth(2),
  ).toBeVisible()
  await audit(page)
  await screenshot(page, test.info().outputPath('upload-batches-mobile.png'))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await screenshot(page, test.info().outputPath('upload-batches-desktop.png'))
  await signOut(page)
  await login(page, 'admin-a')
  await page.goto('/admin/data')
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Create backup', exact: true }).click()
  const backup = await (await downloadEvent).path()
  await page.getByLabel('Application identifier').fill(appUrl!.split('/').at(-1)!)
  await page.getByRole('button', { name: 'Review deletion impact' }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'were deleted' })).toBeVisible()
  await page.getByLabel('Import demo backup').setInputFiles(backup!)
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Browser demo restored' })).toBeVisible()
  await signOut(page)
  await login(page, 'tutor-a', false)
  await page.goto(novemberUrl)
  await expect(page.getByRole('cell', { name: /ZIP-001/ })).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(3)
})

test('bad ZIP imports save no partial batch and batch links enforce programme membership', async ({
  page,
}) => {
  await login(page, 'tutor-a', false)
  await page
    .getByRole('link', { name: 'Open course Machine Learning MSc', exact: true })
    .first()
    .click()
  await page.getByRole('button', { name: 'Open 26/27 intake' }).click()
  const valid = await applicantZip(['VALID'])
  const { unzipSync } = await import('fflate')
  const files = unzipSync(valid)
  files['INVALID/transcript.pdf'] = new TextEncoder().encode('This is not a PDF')
  await page.getByLabel('Upload applicant ZIP').setInputFiles({
    name: 'Broken.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(zipSync(files)),
  })
  await page.getByRole('button', { name: 'Upload batch', exact: true }).click()
  await expect(page.getByText(/INVALID.*cannot be read/)).toBeVisible()
  await expect(page.getByRole('table', { name: 'Previous batches' }).getByRole('row')).toHaveCount(
    2,
  )
  await page.reload()
  await expect(page.getByRole('table', { name: 'Previous batches' }).getByRole('row')).toHaveCount(
    2,
  )
  await page
    .getByLabel('Upload applicant ZIP')
    .setInputFiles({ name: 'Valid.zip', mimeType: 'application/zip', buffer: valid })
  await page.getByRole('button', { name: 'Upload batch', exact: true }).click()
  await expect(page.getByRole('cell', { name: /VALID/ })).toBeVisible()
  const url = page.url()
  await signOut(page)
  await login(page, 'tutor-b', false)
  await page.goto(url)
  await expect(page.locator('main').getByRole('alert')).toContainText('tutor access')
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('sample CSML batches show pending work, recorded decisions and original evidence', async ({
  page,
}) => {
  await login(page)
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  const table = page.getByRole('table', { name: 'Previous batches' })
  for (const [number, total, pending] of [
    [1, 5, 5],
    [2, 2, 1],
    [3, 1, 0],
  ]) {
    const cells = table
      .getByRole('row', { name: new RegExp(`Open batch ${number}`) })
      .getByRole('cell')
    await expect(cells.nth(2)).toHaveText(String(total))
    await expect(cells.nth(3)).toHaveText(String(pending))
  }
  await table.getByRole('link', { name: 'Open batch 2', exact: true }).click()
  await expect(page.getByRole('button', { name: /Export/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Open SAMPLE-CSML-01', exact: true }).click()
  await expect(
    page
      .getByRole('group', { name: 'Tutor decision', exact: true })
      .getByText('Offer', { exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'View documents', exact: true }).click()
  await expect(page.getByText('Loading PDF page…')).toBeHidden()
  await page.getByText('Accessible page text').click()
  await expect(page.locator('pre')).toContainText('SYN-148')
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await table.getByRole('link', { name: 'Open batch 3', exact: true }).click()
  await page.getByRole('link', { name: 'Open SAMPLE-CSML-03', exact: true }).click()
  await expect(
    page
      .getByRole('group', { name: 'Tutor decision', exact: true })
      .getByText('Reject', { exact: true }),
  ).toBeVisible()
})

test('older saved browser data receives default CSML batches without a reset', async ({ page }) => {
  await login(page)
  const applicationUrl = await uploadTranscript(page, 'KEEP-MY-UPLOAD')
  await expect(page.locator('main h1')).toHaveText('APP-2026-0148')
  await page.goto('/batches')
  await expect(page.getByRole('table', { name: 'Previous batches' }).getByRole('row')).toHaveCount(
    4,
  )
  // Reproduce the older browser dataset: its upgrade marker was written even
  // though only the original batch and the tutor's uploaded PDF were saved.
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ucl-admissions-demo', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const data = await new Promise<Dataset>((resolve, reject) => {
      const request = database.transaction('state').objectStore('state').get('dataset')
      request.onsuccess = () => resolve(request.result as Dataset)
      request.onerror = () => reject(request.error)
    })
    const sampleIds = new Set(['SAMPLE-CSML-01', 'SAMPLE-CSML-02', 'SAMPLE-CSML-03'])
    const sampleDocuments = data.documents.filter((document) =>
      sampleIds.has(document.applicationId),
    )
    data.applications = data.applications.filter((application) => !sampleIds.has(application.id))
    data.documents = data.documents.filter((document) => !sampleIds.has(document.applicationId))
    data.batches = data.batches?.filter((batch) => !batch.id.startsWith('sample-csml-'))
    data.audit = data.audit.filter((event) => !event.id.startsWith('sample-csml-batches-v'))
    data.audit.push({
      id: 'sample-csml-batches-v1',
      at: '2026-10-16T15:00:00Z',
      actor: 'tutor-a',
      action: 'Add sample course batches',
      target: 'sample-batches',
    })
    const transaction = database.transaction(['state', 'files'], 'readwrite')
    const completed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    for (const document of sampleDocuments) transaction.objectStore('files').delete(document.id)
    transaction.objectStore('state').put(data, 'dataset')
    await completed
    database.close()
  })
  await page.reload()
  const table = page.getByRole('table', { name: 'Previous batches' })
  await expect(table.getByRole('row')).toHaveCount(4)
  for (const [number, total, pending] of [
    [1, 6, 6],
    [2, 2, 1],
    [3, 1, 0],
  ]) {
    const cells = table
      .getByRole('row', { name: new RegExp(`Open batch ${number}`) })
      .getByRole('cell')
    await expect(cells.nth(2)).toHaveText(String(total))
    await expect(cells.nth(3)).toHaveText(String(pending))
  }
  await page.reload()
  await expect(table.getByRole('row')).toHaveCount(4)
  await page.goto(applicationUrl)
  await page.getByRole('link', { name: 'View documents', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download original', exact: true }).click()
  expect((await readFile((await (await download).path())!)).subarray(0, 4).toString()).toBe('%PDF')
})
