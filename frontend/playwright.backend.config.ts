import { defineConfig } from '@playwright/test'

// This suite owns separate ports and does not replace the user's running app/data.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'backend.spec.ts',
  timeout: 60000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  webServer: [
    {
      command: `"${process.env.UCL_BACKEND_PYTHON ?? 'python3'}" -m uvicorn app.main:app --host 127.0.0.1 --port 8001`,
      cwd: '../backend',
      url: 'http://127.0.0.1:8001/api/v1/health',
      env: { UCL_CORS_ORIGINS: 'http://127.0.0.1:5174' },
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
