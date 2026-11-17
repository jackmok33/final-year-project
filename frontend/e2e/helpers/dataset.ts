import type { Page } from '@playwright/test'
import type { Dataset } from '../../src/domain/types'

export async function dataset(page: Page): Promise<Dataset> {
  return page.evaluate(async () => {
    const session = JSON.parse(sessionStorage.getItem('ucl-backend-auth')!)
    const response = await fetch('http://127.0.0.1:8001/api/v1/workspace', {
      headers: { Authorization: `Bearer ${session.token}` },
    })
    if (!response.ok) throw new Error('Server test dataset is unavailable.')
    return response.json()
  })
}
