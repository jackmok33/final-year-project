import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function login(page: Page, email = 'tutor@demo.ucl.local') {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('demo')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.locator('main h1')).toBeVisible()
}
async function audit(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await expect(page.getByText('Loading workspace…', { exact: true })).toBeHidden()
  await page.locator('body').evaluate((element) =>
    element
      .getAnimations({ subtree: true })
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .forEach((animation) => animation.finish()),
  )
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([])
}

test('redesigned programme, batch, review tabs and decision popup match the exported desktop flow', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/login')
  await page.getByRole('button', { name: "I don't have an account", exact: true }).click()
  const help = page.getByRole('dialog', { name: 'Available accounts', exact: true })
  await expect(help).toBeVisible()
  await audit(page)
  await help.getByRole('button', { name: 'Close help', exact: true }).click()
  await expect(help).toHaveCount(0)
  await login(page)
  await expect(page.getByRole('heading', { name: 'Programme', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open CSML 26/27', exact: true })).toBeVisible()
  await audit(page)
  await page.screenshot({ path: info.outputPath('programme.png'), fullPage: true })
  await page.getByRole('link', { name: 'Open CSML 26/27', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Batches', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('link', { name: 'Batch 1', exact: true })).toBeVisible()
  const batchPanel = page.getByRole('tabpanel', { name: 'Batches', exact: true })
  const overview = batchPanel.getByRole('region', { name: 'Intake overview' })
  await expect(overview).toBeVisible()
  await expect(batchPanel.getByRole('button', { name: 'Choose application ZIP' })).toBeVisible()
  await expect(batchPanel.getByRole('table', { name: 'Batches', exact: true })).toBeVisible()
  const tabsBounds = await page.getByRole('tablist', { name: 'Programme workspace' }).boundingBox()
  const overviewBounds = await overview.boundingBox()
  expect(tabsBounds).not.toBeNull()
  expect(overviewBounds).not.toBeNull()
  expect(tabsBounds!.y + tabsBounds!.height).toBeLessThanOrEqual(overviewBounds!.y)
  await audit(page)
  await page.screenshot({ path: info.outputPath('workspace.png'), fullPage: true })
  await page.getByRole('tab', { name: 'Admission criteria', exact: true }).click()
  await expect(page.getByRole('form', { name: 'Admission criteria', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Intake overview' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Choose application ZIP' })).toHaveCount(0)
  await expect(page.getByRole('table', { name: 'Batches', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Admission criteria', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('form', { name: 'Admission criteria', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Intake overview' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Choose application ZIP' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Version history', exact: true })).toHaveCount(0)
  await audit(page)
  await page.screenshot({ path: info.outputPath('criteria.png'), fullPage: true })
  await page.getByRole('tab', { name: 'Analytics', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Decision overview', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Intake overview' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Choose application ZIP' })).toHaveCount(0)
  await expect(page.getByRole('table', { name: 'Batches', exact: true })).toHaveCount(0)
  await audit(page)
  await page.screenshot({ path: info.outputPath('analytics.png'), fullPage: true })
  await page.getByRole('tab', { name: 'Batches', exact: true }).click()
  await page.getByRole('link', { name: 'Batch 1', exact: true }).click()
  await expect(page.getByRole('columnheader')).toHaveText([
    'Id',
    'Name',
    'Student ID',
    'State',
    'University',
    'Score',
    'AI',
    'Decision',
    'Actions',
  ])
  await audit(page)
  await page.screenshot({ path: info.outputPath('batch.png'), fullPage: true })
  const applicantRows = await page.getByRole('table', { name: 'Applicants' }).getByRole('row').all()
  for (const row of applicantRows.slice(1)) {
    const cells = row.getByRole('cell')
    await expect(cells.nth(6)).toHaveText(/^(Unconditional|Conditional|Reject|—)$/)
    await expect(cells.nth(7)).toHaveText(/^(Unconditional|Conditional|Reject|Pending)$/)
  }
  await page.getByRole('link', { name: 'View Carson Darrin', exact: true }).click()
  const summary = page.getByRole('region', { name: 'Application review' })
  await expect(summary.getByText('Conditional', { exact: true })).toBeVisible()
  await expect(summary.getByText('Pending', { exact: true })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveText([
    'AI recommendation',
    'Review flag',
    'Score breakdown',
    'View documents',
  ])
  await expect(
    page.getByRole('button', { name: 'Re-run AI evaluation', exact: true }),
  ).toBeVisible()
  for (const [label, file] of [
    ['AI recommendation', 'recommendation'],
    ['Review flag', 'flags'],
    ['Score breakdown', 'scores'],
    ['View documents', 'documents'],
  ]) {
    await page.getByRole('tab', { name: label, exact: true }).click()
    await expect(page.getByRole('tabpanel')).toBeVisible()
    if (file === 'documents') await expect(page.getByText('Loading PDF page…')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Assessment history', exact: true })).toHaveCount(
      0,
    )
    await audit(page)
    await page.screenshot({ path: info.outputPath(`${file}.png`), fullPage: true })
  }
  const decisionButton = page.getByRole('button', { name: 'Decision', exact: true })
  await decisionButton.click()
  const dialog = page.getByRole('dialog', { name: 'Record decision', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('radio')).toHaveCount(3)
  for (const radio of await dialog.getByRole('radio').all()) await expect(radio).toBeDisabled()
  await audit(page)
  await page.screenshot({ path: info.outputPath('decision-popup.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(decisionButton).toBeFocused()
  await expect(page.getByRole('tab', { name: 'View documents', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(errors).toEqual([])
})
