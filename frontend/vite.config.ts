import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { brandingContent } from './src/content/branding.content.ts'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: [
      // Mantis uses typed per-icon imports. This template's icon-package root
      // wrappers export nested CommonJS defaults; resolve the ESM implementations
      // consistently in Vite/Vitest and production without changing public types.
      { find: /^@ant-design\/icons\/([^/]+)$/, replacement: '@ant-design/icons/es/icons/$1' },
    ],
  },
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
    // MUI renders and coverage instrumentation are CPU-heavy. Bound concurrency
    // so lazy-route waits and user typing complete reliably on local machines.
    maxWorkers: 2,
    env: { VITE_API_BASE_URL: '' },
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/app/theme.ts',
        // Supplied template source has focused integration tests; coverage targets
        // apply to the application's own workflows rather than unused template options.
        'src/mantis/**',
      ],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 95 },
    },
  },
}))
