import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

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
    await expect(page.getByText(/FastAPI connected/)).toBeVisible()
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/mock/assessments') &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Re-evaluate demo case' }).click()
    const response = await responsePromise
    expect(response.status()).toBe(200)
    const run = await response.json()
    expect(run.overall).toBe(88.5)
    expect(run.recommendation).toBe('Offer')
    expect(run.evaluationSource).toBe('fastapi-mock')
    await expect(page.getByText(/This assessment came from FastAPI/)).toBeVisible()
    await expect(page.getByText(/FastAPI mock assessment: Offer/)).toBeVisible()
    await page.reload()
    await expect(page.getByText(/This assessment came from FastAPI/)).toBeVisible()
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
    await page.getByRole('button', { name: 'Re-evaluate demo case' }).click()
    await expect(page.getByText(/Cannot reach the FastAPI/)).toBeVisible()
    await expect(page.getByText(/FastAPI mock assessment: Offer/)).toBeVisible()
    await page.reload()
    await expect(page.getByText(/This assessment came from FastAPI/)).toBeVisible()
  })
}
