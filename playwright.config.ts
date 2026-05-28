import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    // VITE_E2E disables the MSW browser worker (main.tsx): an active service
    // worker re-issues passthrough requests from the SW context and bypasses
    // page.route(). Never reuse an existing server — it might be running without
    // this env, which would silently re-enable MSW and break the hermetic specs.
    env: { VITE_E2E: 'true' },
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
})
