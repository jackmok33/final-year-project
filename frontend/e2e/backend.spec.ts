import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function reEvaluate(page: Page) {
  const history = page.getByRole('button', { name: 'Assessment history', exact: true })
  if ((await history.getAttribute('aria-expanded')) !== 'true') await history.click()
  await page.getByRole('button', { name: 'Re-evaluate application', exact: true }).click()
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`FastAPI mock assessment, persistence and disconnection on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/login')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.goto('/applications/APP-2026-0143')
    await expect(page.getByRole('heading', { name: 'APP-2026-0143', exact: true })).toBeVisible()
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
    await expect(page.getByText(/FastAPI mock assessment: Offer/)).toBeVisible()
    await page.reload()
    await expect(page.getByText(/FastAPI mock assessment: Offer/)).toBeVisible()
    const results = await new AxeBuilder({ page }).analyze()
    expect(
      results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? '')),
    ).toEqual([])

    // The backend's citation opens the same original PDF and page used in the browser demo.
    await page
      .getByRole('link', { name: /Transcript.pdf.*p\.2/ })
      .first()
      .click()
    await expect(page).toHaveURL(/document=APP-2026-0143-transcript.*page=2/)
    await page.goBack()
    await page.route('http://127.0.0.1:8001/api/v1/mock/assessments', (route) => route.abort())
    await reEvaluate(page)
    await expect(page.getByText(/Cannot reach the FastAPI/)).toBeVisible()
    await expect(page.getByText(/FastAPI mock assessment: Offer/)).toBeVisible()
    await page.reload()
    await expect(page.getByText(/FastAPI mock assessment: Offer/)).toBeVisible()
    await page.unroute('http://127.0.0.1:8001/api/v1/mock/assessments')
    await page.goto('/criteria')
    await page.getByLabel('Offer from', { exact: true }).fill('95')
    await page.getByRole('button', { name: 'Save criteria', exact: true }).click()
    await expect(page.getByText('Active: v1.1', { exact: true })).toBeVisible()
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
    await expect(page.getByText('Criteria v1.1', { exact: true })).toBeVisible()
  })
}
