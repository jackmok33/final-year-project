import { defineConfig } from '@playwright/test'

import {
  prepareBrowserFixture,
  prepareEnglishTestReport,
  prepareFullAssessment,
  backendPython,
  backendRoot,
  fixtureFile,
  tokenFile,
} from './e2e/helpers/server'
await prepareBrowserFixture()
const englishTestHash = await prepareEnglishTestReport()
const assessmentHashes = await prepareFullAssessment()

// This suite owns separate ports and does not replace the user's running app/data.
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/backend',
  testMatch: 'backend.spec.ts',
  timeout: 60000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  webServer: [
    {
      command: `"${backendPython}" -B -m tests.workspace_test_data --backup "${fixtureFile}" --serve`,
      cwd: backendRoot,
      url: 'http://127.0.0.1:8001/api/v1/health',
      timeout: 120000,
      env: {
        DOCUMENT_API_TOKENS_FILE: tokenFile,
        UCL_CORS_ORIGINS: 'http://127.0.0.1:5174',
        ENGLISH_TEST_PILOT_PDF_SHA256: englishTestHash,
        ASSESSMENT_PILOT_PDF_SHA256: assessmentHashes,
      },
      reuseExistingServer: false,
    },
    {
      command: `"${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort`,
      url: 'http://127.0.0.1:5174',
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:8001/api/v1' },
      reuseExistingServer: false,
    },
  ],
})
