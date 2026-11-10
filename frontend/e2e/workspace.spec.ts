import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PDFDocument } from 'pdf-lib'
import { zipSync } from 'fflate'
import { readFile } from 'node:fs/promises'
import { dataset } from './helpers/dataset'

const csmlIntakePath = '/programmes/programme-1/intakes/2026-27'

async function sampleApplicationPath(page: Page, id = 'APP-2026-0142') {
  const application = (await dataset(page)).applications.find((app) => app.id === id)!
  const parent = application.batchId
    ? `${csmlIntakePath}/batches/${encodeURIComponent(application.batchId)}`
    : `${csmlIntakePath}/applications`
  return application.batchId
    ? `${parent}/applications/${encodeURIComponent(id)}`
    : `${parent}/${encodeURIComponent(id)}`
}

async function expectBreadcrumbs(page: Page, labels: string[]) {
  const navigation = page.getByRole('navigation', { name: 'Breadcrumb', exact: true })
  await expect(navigation.getByRole('link')).toHaveText(labels)
  for (let index = 0; index < labels.length; index++)
    await expect(navigation.getByRole('link').nth(index)).toHaveCSS('color', 'rgb(89, 89, 89)')
  await expect(page.locator('main h1')).toHaveCount(1)
  await expect(page.locator('main h1')).toHaveText(labels.at(-1)!)
  await expect(navigation.getByRole('link').last()).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('main h1 a')).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('main').getByRole('link', { name: 'Back', exact: true })).toHaveCount(0)
  await expect(page.locator('main').getByRole('button', { name: 'Back', exact: true })).toHaveCount(
    0,
  )
  return navigation
}

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
  await expect(page.locator('main h1')).toHaveText(role === 'admin-a' ? 'Users' : 'Programme')
}
async function intake(page: Page, label = 'CSML 26/27') {
  await page.goto('/programmes')
  await page
    .locator('main')
    .getByRole('link', { name: `Open ${label}`, exact: true })
    .click()
  await expect(page.locator('main h1')).toHaveText(label)
  await expect(page.getByRole('link', { name: 'Batch 1', exact: true })).toBeVisible()
}
async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Logout', exact: true }).click()
}
async function pdf(pages = 1) {
  const document = await PDFDocument.create()
  for (let i = 0; i < pages; i++) document.addPage([595, 842])
  return Buffer.from(await document.save())
}
async function storedPdfHashes(page: Page) {
  return page.evaluate(async () => {
    const { keys, files } = await new Promise<{ keys: IDBValidKey[]; files: Blob[] }>(
      (resolve, reject) => {
        const request = indexedDB.open('ucl-admissions-demo', 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction('files')
          const store = transaction.objectStore('files')
          const keys = store.getAllKeys()
          const files = store.getAll()
          transaction.onerror = () => {
            db.close()
            reject(transaction.error)
          }
          transaction.oncomplete = () => {
            db.close()
            resolve({ keys: keys.result, files: files.result })
          }
        }
      },
    )
    return Promise.all(
      files.map(async (file, index) => ({
        id: String(keys[index]),
        size: file.size,
        sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))]
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join(''),
      })),
    )
  })
}
async function audit(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('main').getByRole('progressbar')).toHaveCount(0)
  await page.locator('body').evaluate((element) =>
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
  await page.goto('/programmes')
  await page.getByRole('button', { name: 'Add Programme', exact: true }).click()
  await page.getByRole('textbox', { name: 'Programme name', exact: true }).fill(name)
  await page.getByRole('button', { name: 'Add Programme', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).toHaveURL(/\/programmes\/[^/?]+\/intakes\/2026-27$/)
}

test('desktop routes and the simplified administrator screens remain accessible', async ({
  page,
}, info) => {
  await login(page)
  const applicationPath = await sampleApplicationPath(page)
  const otherApplicationPath = await sampleApplicationPath(page, 'APP-2026-0143')
  const paths = [
    '/programmes',
    csmlIntakePath,
    `${csmlIntakePath}/applications`,
    `${csmlIntakePath}/applications/new`,
    applicationPath,
    `${applicationPath}/evidence`,
    `${applicationPath}/correct`,
    `${otherApplicationPath}/decision`,
    `${csmlIntakePath}?tab=criteria`,
  ]
  for (const [index, path] of paths.entries()) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
    await audit(page)
    if (path.endsWith('?tab=criteria'))
      await page.screenshot({ path: info.outputPath(`tutor-${index}.png`), fullPage: true })
  }
  await signOut(page)
  await login(page, 'admin-a')
  for (const path of ['/admin/users', '/admin/health']) {
    await page.goto(path)
    await expect(page.locator('main h1')).toBeVisible()
    await audit(page)
  }
  await signOut(page)
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('login.png'), fullPage: true })
})

test('clickable breadcrumbs follow every ancestor and keep the current applicant as the only heading', async ({
  page,
}, info) => {
  await login(page)
  await expect(page).toHaveURL('/programmes')
  await expectBreadcrumbs(page, ['Programme'])
  await intake(page)
  await expect(page).toHaveURL(csmlIntakePath)
  await expectBreadcrumbs(page, ['Programme', 'CSML 26/27'])
  await page.getByRole('link', { name: 'Batch 1', exact: true }).click()
  const batchPath = new URL(page.url()).pathname
  await expectBreadcrumbs(page, ['Programme', 'CSML 26/27', 'Batch 1'])
  await page.getByRole('link', { name: 'View Carson Darrin', exact: true }).click()
  const applicationPath = await sampleApplicationPath(page)
  await expect(page).toHaveURL(applicationPath)
  const labels = ['Programme', 'CSML 26/27', 'Batch 1', '1 - Carson Darrin - 24738849']
  const breadcrumbs = await expectBreadcrumbs(page, labels)
  await expect(breadcrumbs.getByRole('link', { name: 'Programme', exact: true })).toHaveAttribute(
    'href',
    '/programmes',
  )
  await expect(breadcrumbs.getByRole('link', { name: 'CSML 26/27', exact: true })).toHaveAttribute(
    'href',
    csmlIntakePath,
  )
  await expect(breadcrumbs.getByRole('link', { name: 'Batch 1', exact: true })).toHaveAttribute(
    'href',
    batchPath,
  )
  await expect(breadcrumbs.getByRole('link').last()).toHaveAttribute('href', applicationPath)
  await expect(breadcrumbs.getByRole('link').first()).toHaveCSS('font-size', '14px')
  await expect(breadcrumbs.getByRole('link').last()).toHaveCSS('font-weight', '400')
  await breadcrumbs.getByRole('link').first().hover()
  await expect(breadcrumbs.getByRole('link').first()).toHaveCSS('color', 'rgb(89, 89, 89)')
  await expect(breadcrumbs.getByRole('link').first()).toHaveCSS('text-decoration-line', 'none')
  await expect(page.locator('main h2').filter({ hasText: 'Carson Darrin' })).toHaveCount(0)
  expect(new URL(page.url()).pathname).not.toMatch(/Carson|Darrin|24738849|Batch%20|Batch-/)
  await audit(page)
  await page.screenshot({ path: info.outputPath('applicant-breadcrumbs.png'), fullPage: true })
  await page.reload()
  await expectBreadcrumbs(page, labels)

  const current = breadcrumbs.getByRole('link').last()
  await current.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(applicationPath)
  await expectBreadcrumbs(page, labels)
  await breadcrumbs.getByRole('link', { name: 'Batch 1', exact: true }).click()
  await expect(page).toHaveURL(batchPath)
  await expect(page.getByRole('table', { name: 'Applicants', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Add applicant', exact: true }).click()
  await expect(page).toHaveURL(`${batchPath}/applications/new`)
  await expectBreadcrumbs(page, ['Programme', 'CSML 26/27', 'Batch 1', 'New application'])
  await page
    .getByRole('navigation', { name: 'Breadcrumb', exact: true })
    .getByRole('link', { name: 'Batch 1', exact: true })
    .click()
  await expect(page).toHaveURL(batchPath)

  await page.goto(applicationPath)
  await expectBreadcrumbs(page, labels)
  const programmeLink = breadcrumbs.getByRole('link', { name: 'Programme', exact: true })
  await programmeLink.focus()
  await page.keyboard.press('Tab')
  await expect(breadcrumbs.getByRole('link', { name: 'CSML 26/27', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(csmlIntakePath)
  await expectBreadcrumbs(page, ['Programme', 'CSML 26/27'])
  await expect(page.getByRole('table', { name: 'Batches', exact: true })).toBeVisible()
  await page.goto(applicationPath)
  await expectBreadcrumbs(page, labels)
  await breadcrumbs.getByRole('link', { name: 'Programme', exact: true }).click()
  await expect(page).toHaveURL('/programmes')
  await expectBreadcrumbs(page, ['Programme'])
  await audit(page)
})

test('legacy routes replace their URLs while preserving evidence, run and workspace bookmarks', async ({
  page,
}, info) => {
  await login(page)
  const original = await dataset(page)
  const application = original.applications.find((app) => app.id === 'APP-2026-0142')!
  const applicationPath = await sampleApplicationPath(page)
  const batchPath = `${csmlIntakePath}/batches/${encodeURIComponent(application.batchId!)}`
  const transcript = original.documents.find(
    (document) => document.applicationId === application.id && document.type === 'transcript',
  )!
  const query = new URLSearchParams({
    run: application.runs.at(-1)!.id,
    document: transcript.id,
    page: '2',
  })
  const bookmarks = [
    ['/modules', '/programmes'],
    [
      '/batches?programme=programme-1&intake=2026%20%2F%2027&tab=analytics',
      `${csmlIntakePath}?tab=analytics`,
    ],
    ['/criteria?programme=programme-1&intake=2026%20%2F%2027', `${csmlIntakePath}?tab=criteria`],
    [`/batches/${encodeURIComponent(application.batchId!)}`, batchPath],
    [
      `/applications/new?batch=${encodeURIComponent(application.batchId!)}`,
      `${batchPath}/applications/new`,
    ],
    [
      `/applications/${application.id}?tab=scores&run=${encodeURIComponent(application.runs.at(-1)!.id)}`,
      `${applicationPath}?tab=scores&run=${encodeURIComponent(application.runs.at(-1)!.id)}`,
    ],
  ] as const
  for (const [legacy, canonical] of bookmarks) {
    await page.goto(legacy)
    await expect(page).toHaveURL(canonical)
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0)
  }
  await page.goto(`/applications/${application.id}/evidence?${query}#saved-page`)
  await expect(page).toHaveURL(`${applicationPath}/evidence?${query}#saved-page`)
  await expect(page.getByText('Page 2 of 4', { exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(`${applicationPath}/evidence?${query}#saved-page`)
  await expect(page.getByText('Page 2 of 4', { exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
  await audit(page)
  await page.screenshot({
    path: info.outputPath('canonical-evidence-bookmark.png'),
    fullPage: true,
  })
  for (const [suffix, dialogName] of [
    ['correct', 'Correct extracted fact'],
    ['decision', 'Record decision'],
  ]) {
    await page.goto(`/applications/${application.id}/${suffix}?${query}`)
    await expect(page).toHaveURL(`${applicationPath}/${suffix}?${query}`)
    await expect(page.getByRole('dialog', { name: dialogName, exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const destination = new URL(page.url())
    expect(destination.searchParams.get('run')).toBe(application.runs.at(-1)!.id)
    expect(destination.searchParams.get('document')).toBe(transcript.id)
    expect(destination.searchParams.get('page')).toBe('2')
  }
  await page.goto('/programmes')
  await page.goto(`/batches/${encodeURIComponent(application.batchId!)}`)
  await expect(page).toHaveURL(batchPath)
  await page.goBack()
  await expect(page).toHaveURL('/programmes')
  const preserved = await dataset(page)
  expect(preserved.applications).toEqual(original.applications)
  expect(preserved.documents).toEqual(original.documents)
})

test('canonical routes reject a child under another programme, intake or batch without exposing records', async ({
  page,
}) => {
  await login(page)
  const original = await dataset(page)
  const application = original.applications.find((app) => app.id === 'APP-2026-0142')!
  const actualBatch = encodeURIComponent(application.batchId!)
  const otherBatch = encodeURIComponent(
    original.batches!.find(
      (batch) => batch.id !== application.batchId && batch.programmeId === application.programmeId,
    )!.id,
  )
  const mismatched = [
    `/programmes/programme-2/intakes/2026-27/batches/${actualBatch}`,
    `/programmes/programme-1/intakes/2025-26/batches/${actualBatch}`,
    `/programmes/programme-2/intakes/2026-27/batches/${actualBatch}/applications/${application.id}`,
    `/programmes/programme-1/intakes/2025-26/batches/${actualBatch}/applications/${application.id}/evidence`,
    `${csmlIntakePath}/batches/${otherBatch}/applications/${application.id}/evidence`,
    `${csmlIntakePath}/applications/${application.id}/evidence`,
    `/programmes/programme-2/intakes/2026-27/batches/${actualBatch}/applications/new`,
  ]
  for (const path of mismatched) {
    await page.goto(path)
    await expect(page.locator('main').getByRole('alert')).toBeVisible()
    await expect(page.getByRole('table', { name: 'Applicants', exact: true })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Application review', exact: true })).toHaveCount(
      0,
    )
    await expect(page.getByRole('tab')).toHaveCount(0)
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'View Carson Darrin', exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Candidate reference', { exact: false })).toHaveCount(0)
    expect(new URL(page.url()).pathname).toBe(path)
  }
  expect((await dataset(page)).applications).toEqual(original.applications)
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

test('account menu opens the password form and logs out without changing prototype credentials', async ({
  page,
}, info) => {
  await login(page)
  const original = await dataset(page)
  const accountMenu = page.getByRole('button', { name: 'Account menu', exact: true })
  await accountMenu.click()
  await expect(page.getByRole('menuitem', { name: 'All programmes', exact: true })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Logout', exact: true })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Change password', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Change password', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel(/^Current password/).fill('demo')
  await dialog.getByLabel(/^New password/).fill('temporary-password')
  await dialog.getByLabel(/^Confirm new password/).fill('different-password')
  await dialog.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByLabel(/^Confirm new password/).fill('temporary-password')
  await dialog.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText(/authentication|password service/i)
  expect(await dataset(page)).toEqual(original)
  await audit(page)
  await page.screenshot({ path: info.outputPath('change-password-popup.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(accountMenu).toBeFocused()
  await accountMenu.click()
  await page.getByRole('menuitem', { name: 'Change password', exact: true }).click()
  await expect(dialog.getByLabel(/^Current password/)).toBeEmpty()
  await expect(dialog.getByLabel(/^New password/)).toBeEmpty()
  await expect(dialog.getByLabel(/^Confirm new password/)).toBeEmpty()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await signOut(page)
  await expect(page).toHaveURL('/login')
  await login(page)
})

test('search, status filters, score sorting and bounded pagination work on applicant rows', async ({
  page,
}, info) => {
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
  await expect(page.getByRole('option', { name: 'Missing', exact: true })).toHaveCount(1)
  await expect(page.getByRole('option', { name: 'Ready', exact: true })).toHaveCount(1)
  await page.getByRole('option', { name: 'Missing', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Applicants' }).getByRole('row')).toHaveCount(6)
  await expect(page.getByRole('link', { name: 'View Sara Soudan', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('missing-applicants.png'), fullPage: true })
  await page.getByRole('combobox', { name: 'All status', exact: true }).click()
  await page.getByRole('option', { name: 'Ready', exact: true }).click()
  await expect(page.getByText('No applicants match your filters.')).toBeVisible()
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

test('all three tutor outcomes save with review flags and leave the assessment unchanged', async ({
  page,
}) => {
  await login(page)
  const original = (await dataset(page)).applications.find((a) => a.id === 'APP-2026-0142')!.runs
  expect(original.at(-1)!.flags.some((flag) => flag.critical)).toBe(true)
  for (const url of [
    '/applications/APP-2026-0142/decision',
    '/applications/APP-2026-0142?tab=decision',
  ]) {
    await page.goto(url)
    const dialog = page.getByRole('dialog', { name: 'Record decision', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('radio')).toHaveCount(3)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'AI recommendation', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  }
  for (const outcome of ['Conditional', 'Unconditional', 'Reject']) {
    await page.goto('/applications/APP-2026-0142')
    await page.getByRole('button', { name: 'Decision', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Record decision', exact: true })
    await expect(dialog.getByRole('radio')).toHaveCount(3)
    await expect(dialog.getByRole('checkbox')).toHaveCount(0)
    await dialog.getByRole('radio', { name: outcome, exact: true }).check()
    await dialog.getByRole('button', { name: 'Record decision', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL(/\/applications\/APP-2026-0142$/)
    expect(
      (await dataset(page)).applications.find((a) => a.id === 'APP-2026-0142')!.decisions.at(-1)
        ?.outcome,
    ).toBe(outcome)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
  await page.reload()
  const saved = (await dataset(page)).applications.find((a) => a.id === 'APP-2026-0142')!
  expect(saved.runs).toEqual(original)
  expect(saved.decisions.at(-1)?.outcome).toBe('Reject')
  await page.getByRole('tab', { name: 'Review flag', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(original.at(-1)!.flags[0].message)
})

test('flag correction popup preserves review context and original facts while creating a run', async ({
  page,
}, info) => {
  await login(page)
  await page.goto('/applications/APP-2026-0142/decision')
  const preCorrectionDialog = page.getByRole('dialog', { name: 'Record decision', exact: true })
  await expect(preCorrectionDialog).toBeVisible()
  for (const radio of await preCorrectionDialog.getByRole('radio').all())
    await expect(radio).toBeEnabled()
  await preCorrectionDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(preCorrectionDialog).toHaveCount(0)
  await expect(page.getByText('Grade: 71%', { exact: true })).toBeVisible()
  await expect(page.getByText(/Assessment score: (90|82)\/100/)).toHaveCount(0)
  await page.getByRole('tab', { name: 'Review flag', exact: true }).click()
  const updateDetail = page.getByRole('button', { name: 'Update detail', exact: true })
  await updateDetail.click()
  const correctionDialog = page.getByRole('dialog', { name: 'Correct extracted fact', exact: true })
  await expect(correctionDialog).toBeVisible()
  await expect(page).toHaveURL(/tab=flags.*correction=edit/)
  await correctionDialog.getByLabel('Corrected value', { exact: false }).fill('74')
  await correctionDialog.getByLabel('Reason for correction', { exact: false }).fill('Unsaved note')
  await page.keyboard.press('Escape')
  await expect(correctionDialog).toHaveCount(0)
  await expect(updateDetail).toBeFocused()
  expect(
    (await dataset(page)).applications.find((a) => a.id === 'APP-2026-0142')!.runs,
  ).toHaveLength(1)
  await updateDetail.click()
  await expect(correctionDialog.getByLabel('Corrected value', { exact: false })).toHaveValue('71')
  await expect(correctionDialog.getByLabel('Reason for correction', { exact: false })).toBeEmpty()
  await audit(page)
  await page.screenshot({ path: info.outputPath('correction-popup.png'), fullPage: true })
  await correctionDialog.getByLabel('Corrected value', { exact: false }).fill('74')
  await correctionDialog
    .getByLabel('Reason for correction', { exact: false })
    .fill('Transcript page 2 confirms 74%.')
  await correctionDialog.getByRole('button', { name: 'Save & re-evaluate', exact: true }).click()
  await expect(correctionDialog).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Review flag', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('tab', { name: 'AI recommendation', exact: true }).click()
  await expect(page.getByText('Grade: 74%', { exact: true })).toBeVisible()
  await expect(page.getByText('Grade: 71%', { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Grade: 74%', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('evidence-summary-corrected.png'), fullPage: true })
  await expect(page.getByRole('button', { name: 'Decision', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Decision', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Record decision', exact: true })
  await expect(dialog.getByRole('radio', { name: 'Conditional', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Record decision', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const app = (await dataset(page)).applications.find((a) => a.id === 'APP-2026-0142')!
  expect(app.runs).toHaveLength(2)
  expect(app.runs[0].extractedGrade).toBe(71)
  expect(app.corrections[0].value).toBe(74)
  await page.goto(`/applications/APP-2026-0142?run=${encodeURIComponent(app.runs[0].id)}`)
  await expect(page.getByText(/Viewing a previous assessment/)).toBeVisible()
  await expect(page.getByText('Grade: 71%', { exact: true })).toBeVisible()
  await expect(page.getByText('Grade: 74%', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Decision', exact: true })).toBeDisabled()
  await page.goto(`/applications/APP-2026-0142/decision?run=${encodeURIComponent(app.runs[0].id)}`)
  const historicalDialog = page.getByRole('dialog', { name: 'Record decision', exact: true })
  await expect(historicalDialog).toBeVisible()
  await expect(historicalDialog.getByRole('radio')).toHaveCount(0)
  await expect(
    historicalDialog.getByText('Return to the latest assessment before recording a decision.'),
  ).toBeVisible()
  await historicalDialog.getByRole('button', { name: 'Close decision', exact: true }).click()
  await expect(historicalDialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Decision', exact: true })).toBeDisabled()
  await page.goto(`/applications/APP-2026-0142/correct?run=${encodeURIComponent(app.runs[0].id)}`)
  const historicalCorrection = page.getByRole('dialog', {
    name: 'Correct extracted fact',
    exact: true,
  })
  await expect(historicalCorrection).toBeVisible()
  await expect(historicalCorrection.getByLabel('Corrected value', { exact: false })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(historicalCorrection).toHaveCount(0)
  await expect(page.getByText(/Viewing a previous assessment/)).toBeVisible()
  expect(
    (await dataset(page)).applications.find((a) => a.id === 'APP-2026-0142')!.runs,
  ).toHaveLength(2)
})

test('criteria edits preserve existing results without exposing history', async ({ page }) => {
  await login(page)
  await intake(page)
  const original = await dataset(page)
  const before = JSON.stringify(original.applications)
  await page.getByRole('tab', { name: 'Admission criteria', exact: true }).click()
  await expect(page.getByLabel('References (%)', { exact: true })).toHaveValue('0')
  await page.getByLabel('References (%)', { exact: true }).fill('10')
  await page.getByLabel('Academic performance (%)', { exact: true }).fill('40')
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

test('six document categories preserve both references and four score panels without rewriting history', async ({
  page,
}, info) => {
  await login(page)
  await intake(page)
  const before = await dataset(page)
  const previousHashes = await storedPdfHashes(page)
  await page.goto('/applications/APP-2026-0143?tab=scores')
  await page.getByRole('tab', { name: 'Score breakdown', exact: true }).click()
  const referenceSection = page.getByRole('button', { name: /References/ })
  await expect(referenceSection).toContainText('Score unavailable')
  await referenceSection.click()
  await expect(page.getByText('This section was not assessed in this run.')).toBeVisible()
  expect((await dataset(page)).applications).toEqual(before.applications)
  await audit(page)
  await page.screenshot({ path: info.outputPath('four-score-sections.png'), fullPage: true })

  await page.goto('/applications/new')
  await page.getByLabel('Candidate reference', { exact: false }).fill('SYN-FULL-PACKET')
  const original = await pdf()
  const categories = [
    ['Transcript', 'transcript'],
    ['CV', 'cv'],
    ['Personal statement', 'statement'],
    ['Application form', 'application_form'],
    ['English test report', 'english_test'],
  ] as const
  for (const [label, type] of categories) {
    await page
      .getByLabel(`Upload ${label}`, { exact: true })
      .setInputFiles({ name: `${type}.pdf`, mimeType: 'application/pdf', buffer: original })
    await expect(
      page.getByRole('button', { name: 'Create application', exact: true }),
    ).toBeEnabled()
  }
  await page.getByLabel('Upload References', { exact: true }).setInputFiles([
    { name: 'academic-reference.pdf', mimeType: 'application/pdf', buffer: original },
    { name: 'professional-reference.pdf', mimeType: 'application/pdf', buffer: original },
  ])
  await expect(page.getByText('7 / 100 pages per application')).toBeVisible()
  await audit(page)
  await page.screenshot({ path: info.outputPath('expanded-document-upload.png'), fullPage: true })
  await page.getByRole('button', { name: 'Create application', exact: true }).click()
  await expect(page).toHaveURL(/\/applications\/APP-/)
  const saved = await dataset(page)
  const app = saved.applications.find((a) => a.candidate === 'SYN-FULL-PACKET')!
  expect(app.documentIds).toHaveLength(7)
  expect(
    saved.documents.filter((d) => d.applicationId === app.id && d.type === 'reference'),
  ).toHaveLength(2)
  expect(saved.applications.filter((a) => a.id !== app.id)).toEqual(before.applications)
  expect(await storedPdfHashes(page)).toEqual(expect.arrayContaining(previousHashes))
  await page.goto('/applications')
  await page.getByRole('textbox', { name: 'Search applicant', exact: true }).fill('SYN-FULL-PACKET')
  const readyRow = page.getByRole('row').filter({
    has: page.getByRole('link', { name: 'View SYN-FULL-PACKET', exact: true }),
  })
  await expect(readyRow.getByRole('cell').nth(3)).toHaveText('Ready')
  await expect(readyRow.getByRole('cell').nth(6)).toHaveText('—')
  await expect(readyRow.getByRole('cell').nth(7)).toHaveText('Pending')
  await page.getByRole('combobox', { name: 'All status', exact: true }).click()
  await page.getByRole('option', { name: 'Ready', exact: true }).click()
  await expect(readyRow).toBeVisible()
  await page.screenshot({ path: info.outputPath('ready-applicant.png'), fullPage: true })
  await page.getByRole('combobox', { name: 'All status', exact: true }).click()
  await page.getByRole('option', { name: 'Missing', exact: true }).click()
  await expect(page.getByText('No applicants match your filters.')).toBeVisible()
  await page.goto(`/applications/${encodeURIComponent(app.id)}`)
  await page.getByRole('tab', { name: 'View documents', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Original document', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Original document', exact: true }).click()
  await expect(page.getByRole('option')).toHaveCount(7)
  await page.getByRole('option', { name: /professional-reference.pdf/ }).click()
  await expect(page.locator('canvas')).toBeVisible()
  await page.reload()
  await expect(page.locator('canvas')).toBeVisible()
  expect((await dataset(page)).documents.filter((d) => d.applicationId === app.id)).toHaveLength(7)
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
    zipSync({
      'Applicant A/cv.pdf': original,
      'Applicant B/transcript.pdf': original,
      'Applicant A/application_form.pdf': original,
      'Applicant A/english_test.pdf': original,
      'Applicant A/reference-1.pdf': original,
      'Applicant A/reference-2.pdf': original,
    }),
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
  const fullApplicant = saved.applications.find((a) => a.candidate === 'Applicant A')!
  expect(
    saved.documents.filter((d) => d.applicationId === fullApplicant.id && d.type === 'reference'),
  ).toHaveLength(2)
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
  const forbiddenApplicationPath = await sampleApplicationPath(page)
  for (const path of ['/applications/APP-2026-0142', `${forbiddenApplicationPath}/evidence`]) {
    await page.goto(path)
    await expect(page.getByText(/tutor access/i)).toBeVisible()
    await expect(page.getByRole('tab')).toHaveCount(0)
    await expect(page.locator('canvas')).toHaveCount(0)
  }
  await createProgramme(page, 'Data Science & AI MSc')
  const owned = (await dataset(page)).programmes.find((p) => p.name === 'Data Science & AI MSc')!
  expect(owned.createdBy).toBe('tutor-b')
  await signOut(page)
  await login(page, 'admin-a')
  for (const path of ['/applications/APP-2026-0142', forbiddenApplicationPath]) {
    await page.goto(path)
    await expect(page).toHaveURL('/admin/users')
    await expect(page.locator('main h1')).toHaveText('Users')
    await expect(page.getByRole('region', { name: 'Application review', exact: true })).toHaveCount(
      0,
    )
  }
})

test('programme cards have no management shortcut and old management links return to the programme list', async ({
  page,
}) => {
  await login(page, 'tutor-b')
  await createProgramme(page, 'Statistics MSc')
  const saved = await dataset(page)
  const owned = saved.programmes.find((programme) => programme.name === 'Statistics MSc')!
  await page.goto('/programmes')
  const cards = page.locator('main').getByRole('link', { name: /^Open / })
  await expect(cards).toHaveCount(3)
  for (const card of await cards.all())
    await expect(card).toHaveAttribute('href', /^\/programmes\/[^/?]+\/intakes\/20\d\d-\d\d$/)
  await expect(page.getByRole('button', { name: 'Delete course', exact: true })).toHaveCount(0)
  await page.goto(`/modules/${encodeURIComponent(owned.id)}`)
  await expect(page).toHaveURL('/programmes')
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
  expect(csv).toContain('"State"')
  expect(csv).toContain('Tutor decision')
  expect(csv.split('\r\n')).toHaveLength(9)
  expect(csv.match(/,"Missing",/g) ?? []).toHaveLength(8)
  await page.getByRole('tab', { name: 'Analytics', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Decision overview', exact: true })).toBeVisible()
})

test('interrupted simulated evaluation recovers after refresh without losing its run', async ({
  page,
}) => {
  await login(page)
  await page.goto('/applications/APP-2026-0143')
  await page.getByRole('button', { name: 'Re-run AI evaluation', exact: true }).click()
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
  const decisionButton = page.getByRole('button', { name: 'Decision', exact: true })
  await decisionButton.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Record decision', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('radio', { name: 'Conditional', exact: true })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(decisionButton).toBeFocused()
  await expect(page.getByRole('tab', { name: 'Review flag', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Open course CSML 26/27', exact: true }),
  ).toBeVisible()
})
test('admin users and service health remain functional without obsolete tools', async ({
  page,
}, info) => {
  await login(page, 'admin-a')
  const navigation = page.getByRole('navigation', { name: 'Workspace navigation' })
  await expect(navigation.getByRole('link', { name: 'Users', exact: true })).toBeVisible()
  await expect(navigation.getByRole('link', { name: 'Service health', exact: true })).toBeVisible()
  for (const label of ['Backup & restore', 'Programme settings', 'Data operations'])
    await expect(navigation.getByRole('link', { name: label, exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'New account', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'Create account', exact: true })
  await create.getByLabel(/^Name/).fill('New tutor')
  await create.getByLabel(/^Email/).fill('new@demo.ucl.local')
  await create.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(create).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit New tutor', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit account', exact: true })
  await edit.getByRole('switch', { name: 'Account active', exact: true }).uncheck()
  await edit.getByRole('button', { name: 'Save account', exact: true }).click()
  await expect(edit).toHaveCount(0)
  await expect(page.getByRole('row', { name: /New tutor/ })).toContainText('Inactive')
  const administrator = (await dataset(page)).users.find((user) => user.id === 'admin-a')!
  await page.getByRole('button', { name: `Edit ${administrator.name}`, exact: true }).click()
  await edit.getByRole('switch', { name: 'Account active', exact: true }).uncheck()
  await edit.getByRole('button', { name: 'Save account', exact: true }).click()
  await expect(edit.getByRole('alert')).toContainText(/active administrator/i)
  expect((await dataset(page)).users.find((user) => user.id === 'admin-a')!.active).toBe(true)
  await edit.getByRole('button', { name: 'Cancel', exact: true }).click()
  await audit(page)
  await page.screenshot({ path: info.outputPath('admin-users.png'), fullPage: true })
  await expect(page.getByRole('button', { name: 'Reset demo dataset', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create backup', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Import backup', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Application identifier')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('row', { name: /New tutor/ })).toContainText('Inactive')
  await navigation.getByRole('link', { name: 'Service health', exact: true }).click()
  await expect(page.locator('main h1')).toHaveText('Service health')
  await expect(page.getByText('Not configured', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('No backend service has been configured.')
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('No backend service has been configured.')
  await audit(page)
  await page.screenshot({
    path: info.outputPath('admin-health-not-configured.png'),
    fullPage: true,
  })
  const beforeRemovedRoutes = await dataset(page)
  const originalPdfHashes = await storedPdfHashes(page)
  expect(originalPdfHashes.length).toBeGreaterThan(0)
  for (const legacy of ['/admin/programme', '/admin/data', '/admin/backup']) {
    await page.goto(legacy)
    await expect(page).toHaveURL('/admin/users')
    await expect(page.locator('main h1')).toHaveText('Users')
    await expect(page.getByRole('button', { name: 'Create backup', exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Import backup', { exact: true })).toHaveCount(0)
  }
  const preserved = await dataset(page)
  expect(preserved.applications).toEqual(beforeRemovedRoutes.applications)
  expect(preserved.documents).toEqual(beforeRemovedRoutes.documents)
  expect(await storedPdfHashes(page)).toEqual(originalPdfHashes)
})
