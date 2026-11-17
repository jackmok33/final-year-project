import { defineConfig } from '@playwright/test'
import {
  prepareBrowserFixture,
  backendPython,
  backendRoot,
  fixtureFile,
  tokenFile,
} from './e2e/helpers/server'
await prepareBrowserFixture()
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/frontend',
  testIgnore: 'backend.spec.ts',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    actionTimeout: 15000,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: [
    {
      command: `"${backendPython}" -B -m tests.workspace_test_data --backup "${fixtureFile}" --serve`,
      cwd: backendRoot,
      url: 'http://127.0.0.1:8001/api/v1/health',
      env: { DOCUMENT_API_TOKENS_FILE: tokenFile },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: `"${process.execPath}" node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort`,
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
    },
  ],
})
