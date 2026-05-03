import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 20_000,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
  },
})
