import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PDFDocument } from 'pdf-lib'

async function login(page: Page, role = 'tutor-a') {
  await page.goto('/login')
  await page.getByLabel('Demo account').click()
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
      name: role === 'admin-a' ? 'Service health' : 'Applications',
      exact: true,
      level: 1,
    }),
  ).toBeVisible()
}
async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([])
}
async function screenshot(page: Page, path: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    window.scrollTo(0, 0)
  })
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
}
test('all twelve screens render at desktop and mobile sizes with no serious accessibility findings', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await audit(page)
  await screenshot(page, testInfo.outputPath('00-login-desktop.png'))
  await login(page)
  await expect(page.getByRole('columnheader')).toHaveText([
    'Application',
    'Score',
    'AI recommendation',
    'Decision',
  ])
  const tutorRoutes = [
    '/applications',
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
    await screenshot(page, testInfo.outputPath(`tutor-${i}-desktop.png`))
  }
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/applications$/)
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
    await screenshot(page, testInfo.outputPath(`tutor-${i}-mobile.png`))
  }
  await page.getByRole('button', { name: 'Open navigation' }).click()
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await audit(page)
  await screenshot(page, testInfo.outputPath('00-login-mobile.png'))
  expect(errors).toEqual([])
})
test('tutor correction, evidence review, override confirmation and persistence work end to end', async ({
  page,
}) => {
  await login(page)
  await page.getByRole('link', { name: 'Open APP-2026-0142', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Why this recommendation' })).toBeVisible()
  await page.getByRole('link', { name: 'Record decision', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Offer', exact: true })).toBeDisabled()
  await page.goto('/applications/APP-2026-0142/correct')
  await page.getByLabel('Reason for correction').fill('Original transcript page 2 states 74%.')
  await page.getByRole('button', { name: 'Save & re-evaluate' }).click()
  await expect(page).toHaveURL(/\/applications\/APP-2026-0142$/)
  await page.reload()
  await expect(page.getByText('No unresolved critical flags in this synthetic run.')).toBeVisible()
  await expect(page.getByText('Grade corrected: 71% → 74%')).toBeVisible()
  await page.getByRole('link', { name: 'Record decision', exact: true }).click()
  await page.getByRole('radio', { name: 'Offer', exact: true }).check()
  await expect(page.getByRole('button', { name: 'Record offer', exact: true })).toBeDisabled()
  await page
    .getByLabel('Reason for override')
    .fill('Reviewed evidence and authorised a synthetic demo override.')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Record offer', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page).toHaveURL(/\/applications\/APP-2026-0142$/)
  await page.reload()
  await expect(page.getByText('Tutor recorded: Offer')).toBeVisible()
  await page.goto('/applications/APP-2026-0142/evidence?document=APP-2026-0142-transcript&page=2')
  await page.getByText('Accessible page text').click()
  await expect(page.locator('pre')).toContainText('Final weighted average: 74%')
  await page.goto('/applications/APP-2026-0142/evidence?document=invalid&page=99')
  await expect(page.locator('main').getByRole('alert')).toContainText('unavailable')
  await page.goto('/criteria')
  await expect(page.getByLabel('Academic performance (%)')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Activate draft' })).toHaveCount(0)
  await expect(page.getByText('Active: v1.0')).toBeVisible()
  await page.goto('/applications')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export filtered results' }).click()
  expect((await download).suggestedFilename()).toContain('.csv')
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
  await expect(page.getByRole('heading', { name: 'APP-2026-0148', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Request evaluation' }).click()
  await expect(page.getByText('BACKEND UNAVAILABLE', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('BACKEND UNAVAILABLE', { exact: true })).toBeVisible()
  await expect(page.getByText('No assessment has been produced', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: 'View documents' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'unavailable' })).toHaveCount(0)
})

test('keyboard users can sign in, skip navigation and choose a PDF', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('combobox', { name: 'Demo account' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/applications$/)
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
  await page
    .getByRole('textbox', { name: 'Programme name', exact: true })
    .fill('UCL · Demo Computer Science')
  await page.getByRole('button', { name: 'Save programme' }).click()
  await expect(page.getByRole('status')).toContainText('Programme metadata saved')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Programme name', exact: true })).toHaveValue(
    'UCL · Demo Computer Science',
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
  await expect(page.getByRole('textbox', { name: 'Programme name', exact: true })).toHaveValue(
    'Programme · TBC',
  )
})

test('multi-course workspaces keep queues, uploads and criteria separate and respect assigned access', async ({
  page,
}) => {
  async function chooseCourse(name: string) {
    await page.getByRole('combobox', { name: 'Programme workspace', exact: true }).click()
    await page.getByRole('option', { name, exact: true }).click()
    await expect(page.getByRole('option', { name, exact: true })).toBeHidden()
    await expect(page).toHaveURL(/\/applications$/)
  }
  await login(page)
  await chooseCourse('Data Science · Example')
  await expect(page.getByRole('link', { name: 'Open APP-2026-0147', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open APP-2026-0142', exact: true })).toHaveCount(0)
  await screenshot(page, test.info().outputPath('course-workspace-desktop.png'))
  await page.reload()
  await expect(
    page.getByRole('combobox', { name: 'Programme workspace', exact: true }),
  ).toContainText('Data Science · Example')
  await expect(page.getByRole('link', { name: 'Open APP-2026-0147', exact: true })).toBeVisible()
  await page.goto('/applications/new')
  await expect(page.getByRole('textbox', { name: 'Assigned programme' })).toHaveValue(
    'Data Science · Example',
  )
  await page.goto('/criteria')
  await expect(page.getByRole('spinbutton', { name: 'Academic performance (%)' })).toHaveValue('60')
  await expect(page.getByRole('spinbutton', { name: 'Offer from' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Activate draft' })).toHaveCount(0)
  await expect(page.getByText('Active: v1.0', { exact: true })).toBeVisible()
  await chooseCourse('Programme · TBC')
  await page.goto('/criteria')
  await expect(page.getByRole('spinbutton', { name: 'Offer from' })).toHaveValue('80')
  await expect(page.getByText('Active: v1.0', { exact: true })).toBeVisible()
  // A permitted deep link selects the corresponding course workspace.
  await page.goto('/applications/APP-2026-0147')
  await expect(
    page.getByRole('combobox', { name: 'Programme workspace', exact: true }),
  ).toContainText('Data Science · Example')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await screenshot(page, test.info().outputPath('course-switcher-mobile.png'))
  await chooseCourse('Programme · TBC')
  await expect(page.getByRole('link', { name: 'Open APP-2026-0142', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page, 'admin-a')
  await page.goto('/admin/programme')
  await page.getByRole('button', { name: 'New programme', exact: true }).click()
  await page.getByRole('textbox', { name: 'Programme name', exact: true }).fill('Example course C')
  await page.getByRole('textbox', { name: 'Programme code', exact: true }).fill('DEMO-C')
  await page.getByRole('button', { name: 'Save programme', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Programme metadata saved')
  await page.goto('/admin/users')
  await page.getByRole('button', { name: 'Edit Demo tutor B', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Programme access: Example course C', exact: true })
    .check()
  await page.getByRole('button', { name: 'Save account', exact: true }).click()
  await expect(page.getByRole('row', { name: /Demo tutor B/ })).toContainText('Example course C')
  await page.reload()
  await expect(page.getByRole('row', { name: /Demo tutor B/ })).toContainText('Example course C')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await login(page, 'tutor-b')
  await page.getByRole('combobox', { name: 'Programme workspace', exact: true }).click()
  await expect(
    page.getByRole('option', { name: 'Data Science · Example', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('option', { name: 'Example course C', exact: true }).click()
  await expect(page.getByText('No applications match these filters.')).toBeVisible()
  await page.goto('/applications/new')
  await expect(page.getByRole('textbox', { name: 'Assigned programme' })).toHaveValue(
    'Example course C',
  )
  await page.goto('/applications/APP-2026-0147/evidence')
  await expect(page.locator('main').getByRole('alert')).toContainText('tutor access')
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('tutors create named workspaces on desktop and mobile with persistent separate applications', async ({
  page,
}) => {
  await login(page)
  await page.getByRole('button', { name: 'New workspace', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Workspace name' })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Create workspace', exact: true })).toBeDisabled()
  await expect(page.locator('.MuiDialog-container')).toHaveCSS('opacity', '1')
  await audit(page)
  await page.getByRole('textbox', { name: 'Workspace name' }).fill('Robotics MSc')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(
    page.getByRole('combobox', { name: 'Programme workspace', exact: true }),
  ).toContainText('Robotics MSc')
  await expect(page.getByText('No applications match these filters.')).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('combobox', { name: 'Programme workspace', exact: true }),
  ).toContainText('Robotics MSc')
  await page.getByRole('button', { name: 'New workspace', exact: true }).click()
  await page.getByRole('textbox', { name: 'Workspace name' }).fill(' robotics msc ')
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('already have')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.goto('/criteria')
  await expect(page.getByText('Active: v1.0', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Academic performance (%)')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Activate draft' })).toHaveCount(0)
  await page.goto('/applications/new')
  await expect(page.getByRole('textbox', { name: 'Assigned programme' })).toHaveValue(
    'Robotics MSc',
  )
  const pdf = await PDFDocument.create()
  pdf.addPage([595, 842])
  await page.getByLabel('Upload Transcript', { exact: true }).setInputFiles({
    name: 'Workspace.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save()),
  })
  await expect(page.getByText('Workspace.pdf · 1 pages')).toBeVisible()
  await page.getByLabel('Candidate reference').fill('ROBOTICS-CANDIDATE')
  await page.getByRole('button', { name: 'Create application', exact: true }).click()
  await expect(page).toHaveURL(/\/applications\/APP-/)
  const applicationUrl = page.url()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'New workspace', exact: true }).click()
  await page.getByRole('textbox', { name: 'Workspace name' }).fill('My second workspace')
  await expect(page.locator('.MuiDialog-container')).toHaveCSS('opacity', '1')
  await audit(page)
  await screenshot(page, test.info().outputPath('create-workspace-mobile.png'))
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(/\/applications$/)
  await expect(page.getByText('No applications match these filters.')).toBeVisible()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('combobox', { name: 'Programme workspace', exact: true }).click()
  await page.getByRole('option', { name: 'Robotics MSc', exact: true }).click()
  await expect(page.getByRole('cell', { name: /ROBOTICS-CANDIDATE/ })).toBeVisible()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page, 'tutor-b')
  await page.getByRole('combobox', { name: 'Programme workspace', exact: true }).click()
  await expect(page.getByRole('option', { name: 'Robotics MSc', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.goto(applicationUrl)
  await expect(page.locator('main').getByRole('alert')).toContainText('tutor access')
})

test('workspace owners confirm deletion of applications and PDFs, while assigned tutors cannot delete it', async ({
  page,
}) => {
  await login(page)
  await expect(page.getByRole('button', { name: 'Delete workspace', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'New workspace', exact: true }).click()
  await page.getByRole('textbox', { name: 'Workspace name' }).fill('Workspace to delete')
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Programme workspace', exact: true }),
  ).toContainText('Workspace to delete')
  await page.goto('/applications/new')
  const pdf = await PDFDocument.create()
  pdf.addPage([595, 842])
  await page.getByLabel('Upload Transcript', { exact: true }).setInputFiles({
    name: 'Delete-me.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save()),
  })
  await expect(page.getByText('Delete-me.pdf · 1 pages')).toBeVisible()
  await page.getByLabel('Candidate reference').fill('DELETABLE')
  await page.getByRole('button', { name: 'Create application', exact: true }).click()
  await expect(page).toHaveURL(/\/applications\/APP-/)
  const applicationUrl = page.url()
  await page.getByRole('button', { name: 'Delete workspace', exact: true }).click()
  await expect(
    page.getByText('This will delete 1 application, 1 PDF and 1 criteria version.'),
  ).toBeVisible()
  await expect(page.locator('.MuiDialog-container')).toHaveCSS('opacity', '1')
  await audit(page)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(applicationUrl)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await login(page, 'admin-a')
  await page.goto('/admin/users')
  await page.getByRole('button', { name: 'Edit Demo tutor B', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Programme access: Workspace to delete', exact: true })
    .check()
  await page.getByRole('button', { name: 'Save account', exact: true }).click()
  await expect(page.getByRole('row', { name: /Demo tutor B/ })).toContainText('Workspace to delete')
  await page.getByRole('button', { name: 'Edit Jack · Demo tutor', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Programme access: Programme · TBC', exact: true })
    .uncheck()
  await page
    .getByRole('checkbox', { name: 'Programme access: Data Science · Example', exact: true })
    .uncheck()
  await page.getByRole('button', { name: 'Save account', exact: true }).click()
  await expect(page.getByRole('row', { name: /Jack · Demo tutor/ })).not.toContainText(
    'Data Science · Example',
  )
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await login(page, 'tutor-b')
  await page.getByRole('combobox', { name: 'Programme workspace', exact: true }).click()
  await page.getByRole('option', { name: 'Workspace to delete', exact: true }).click()
  await expect(page.getByText('DELETABLE', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete workspace', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await login(page)
  // Jack's prior workspace selection is retained across signing out and back in.
  await expect(
    page.getByRole('combobox', { name: 'Programme workspace', exact: true }),
  ).toContainText('Workspace to delete')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Delete workspace', exact: true }).click()
  await expect(page.getByText('1 other tutor will lose access to this workspace.')).toBeVisible()
  await expect(page.locator('.MuiDialog-container')).toHaveCSS('opacity', '1')
  await audit(page)
  await screenshot(page, test.info().outputPath('delete-workspace-mobile.png'))
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(/\/applications$/)
  await page.reload()
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'Create a programme workspace',
  )
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(
    page.getByRole('combobox', { name: 'Programme workspace', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'New workspace', exact: true }).click()
  await page.getByRole('textbox', { name: 'Workspace name' }).fill('Fresh workspace')
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('No applications match these filters.')).toBeVisible()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page, 'tutor-b')
  await page.getByRole('combobox', { name: 'Programme workspace', exact: true }).click()
  await expect(page.getByRole('option', { name: 'Workspace to delete', exact: true })).toHaveCount(
    0,
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('link', { name: 'Open APP-2026-0142', exact: true })).toBeVisible()
  await page.goto(`${applicationUrl}/evidence`)
  await expect(page.locator('main').getByRole('alert')).toContainText('Application not found')
  await expect(page.locator('canvas')).toHaveCount(0)
})
