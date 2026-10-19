import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { brandingContent } from './src/content/branding.content.ts'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
export default defineConfig(({ mode }) => ({
  // Standalone browser checks must not inherit the optional local FastAPI adapter.
  define: mode === 'e2e' ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') } : undefined,
  plugins: [
    react(),
    {
      name: 'application-title',
      transformIndexHtml: () => [
        { tag: 'title', children: brandingContent.documentTitle, injectTo: 'head' },
      ],
    },
  ],
  server: {
    watch: {
      usePolling: true,
      interval: 300,
      ignored: ['**/test-results/**', '**/playwright-report/**', '**/coverage/**'],
    },
  },
  cacheDir: join(
    tmpdir(),
    `ucl-admissions-vite-${createHash('sha256')
      .update(import.meta.dirname)
      .digest('hex')
      .slice(0, 12)}`,
  ),
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules\/(react|react-dom|scheduler)\// },
            { name: 'mui', test: /node_modules\/(@mui|@emotion)\// },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    env: { VITE_API_BASE_URL: '' },
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/app/theme.ts'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 95 },
    },
  },
}))
