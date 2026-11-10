import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { dataset } from './helpers/dataset'

async function reEvaluate(page: Page) {
  await page.getByRole('button', { name: 'Re-run AI evaluation', exact: true }).click()
}

test('administrator service health checks the API and recovers after a connection failure', async ({
  page,
}, info) => {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('admin@demo.ucl.local')
  await page.getByLabel('Password', { exact: true }).fill('demo')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page.locator('main h1')).toHaveText('Users')

  const healthUrl = 'http://127.0.0.1:8001/api/v1/health'
  const responsePromise = page.waitForResponse(
    (response) => response.url() === healthUrl && response.request().method() === 'GET',
  )
  await page.getByRole('link', { name: 'Service health', exact: true }).click()
  const response = await responsePromise
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ status: 'ok', mode: 'mock' })
  await expect(page.locator('main h1')).toHaveText('Service health')
  await expect(page.getByText('Available', { exact: true })).toBeVisible()
  await expect(page.getByText('Mock', { exact: true })).toBeVisible()
  await expect(page.getByText('Database connection', { exact: true })).toBeVisible()
  await expect(page.getByText('AI inference', { exact: true })).toBeVisible()
  await expect(page.getByText('Not configured', { exact: true })).toHaveCount(2)
  await expect(page.getByText(/^Last checked:/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeEnabled()
  await page.evaluate(() => document.fonts.ready)
  await page.locator('body').evaluate((element) =>
    element
      .getAnimations({ subtree: true })
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .forEach((animation) => animation.finish()),
  )
  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(
    accessibility.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? '')),
  ).toEqual([])
  await page.screenshot({ path: info.outputPath('admin-health-connected.png'), fullPage: true })

  await page.route(healthUrl, (route) => route.abort())
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click()
  await expect(page.getByText('Unavailable', { exact: true })).toBeVisible()
  await expect(page.getByText('Available', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('alert')).toBeVisible()

  await page.unroute(healthUrl)
  const recovery = page.waitForResponse(healthUrl)
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click()
  expect((await recovery).status()).toBe(200)
  await expect(page.getByText('Available', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)

  await page.goto('/applications/APP-2026-0142')
  await expect(page).toHaveURL('/admin/users')
  await expect(page.locator('main h1')).toHaveText('Users')
  await expect(page.getByRole('region', { name: 'Application review' })).toHaveCount(0)
})

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`FastAPI mock assessment, persistence and disconnection on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('tutor@demo.ucl.local')
    await page.getByLabel('Password', { exact: true }).fill('demo')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.goto('/applications/APP-2026-0143')
    await expect(
      page.getByRole('heading', { name: '2 - Ashy Handgun - 39485584', exact: true, level: 1 }),
    ).toBeVisible()
    await expect(page).toHaveURL(
      /\/programmes\/programme-1\/intakes\/2026-27\/batches\/[^/?]+\/applications\/APP-2026-0143$/,
    )
    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb', exact: true })
    await expect(breadcrumbs.getByRole('link')).toHaveText([
      'Programme',
      'CSML 26/27',
      'Batch 1',
      '2 - Ashy Handgun - 39485584',
    ])
    await expect(breadcrumbs.getByRole('link').last()).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0)
    await expect(page.getByText(/FastAPI connected/)).toHaveCount(0)
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/mock/assessments') &&
        response.request().method() === 'POST',
    )
    await reEvaluate(page)
    const response = await responsePromise
    expect(response.status()).toBe(200)
    const run = await response.json()
    expect(run.overall).toBe(88.5)
    expect(run.recommendation).toBe('Offer')
    expect(run.evaluationSource).toBe('fastapi-mock')
    await expect(
      page
        .getByRole('region', { name: 'Application review' })
        .getByText('Unconditional', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText(/FastAPI mock assessment: Offer/)).toBeVisible()
    await page.reload()
    await expect(page.getByText(/FastAPI mock assessment: Offer/)).toBeVisible()
    const results = await new AxeBuilder({ page }).analyze()
    expect(
      results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? '')),
    ).toEqual([])

    // Results keep their evidence data while original PDFs are opened from View documents.
    await expect(page.getByRole('tabpanel').getByRole('link')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Score breakdown', exact: true }).click()
    await expect(page.getByRole('tabpanel').getByRole('link')).toHaveCount(0)
    await page.getByRole('tab', { name: 'View documents', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Original document', exact: true })).toHaveText(
      'Transcript.pdf',
    )
    await expect(page.getByText('Page 2 of 4', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download original', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'AI recommendation', exact: true }).click()
    await page.route('http://127.0.0.1:8001/api/v1/mock/assessments', (route) => route.abort())
    await reEvaluate(page)
    await expect(page.getByText(/Cannot reach the FastAPI/)).toBeVisible()
    await expect(page.getByText(/FastAPI mock assessment: Offer/)).toBeVisible()
    await page.reload()
    await expect(page.getByText(/FastAPI mock assessment: Offer/)).toBeVisible()
    await page.unroute('http://127.0.0.1:8001/api/v1/mock/assessments')
    await page.goto('/criteria')
    await page.getByRole('button', { name: 'Recommendation thresholds' }).click()
    await page.getByLabel('Offer from', { exact: true }).fill('95')
    const previousCriteriaId = (await dataset(page)).activeRubricIds['programme-1']
    await page.getByRole('button', { name: 'Save criteria', exact: true }).click()
    await expect
      .poll(async () => (await dataset(page)).activeRubricIds['programme-1'])
      .not.toBe(previousCriteriaId)
    await page.goto('/applications/APP-2026-0143')
    const nextResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/v1/mock/assessments'),
    )
    await reEvaluate(page)
    const updatedResponse = await nextResponse
    expect(updatedResponse.status()).toBe(200)
    const updated = await updatedResponse.json()
    const request = updatedResponse.request().postDataJSON()
    expect(request.criteria).toMatchObject({ version: '1.1', offerFrom: 95 })
    expect(updated.rubricId).toBe(request.criteria.id)
    expect(updated.recommendation).toBe('Further review')
    await expect(
      page
        .getByRole('region', { name: 'Application review' })
        .getByText('Conditional', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText(/FastAPI mock assessment: Further review/)).toBeVisible()
  })
}
