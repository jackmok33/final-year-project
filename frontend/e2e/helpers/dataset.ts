import type { Page } from '@playwright/test'
import type { Dataset } from '../../src/domain/types'

export async function dataset(page: Page): Promise<Dataset> {
  return page.evaluate(
    () =>
      new Promise<Dataset>((resolve, reject) => {
        const request = indexedDB.open('ucl-admissions-demo', 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const get = db.transaction('state').objectStore('state').get('dataset')
          get.onerror = () => reject(get.error)
          get.onsuccess = () => {
            resolve(get.result)
            db.close()
          }
        }
      }),
  )
}
