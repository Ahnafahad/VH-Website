import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['last-word-stack/**/*.spec.ts', 'last-word/**/*.spec.ts'],
  snapshotPathTemplate: '{testDir}/{testFileDir}/__snapshots__/{arg}{ext}',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: process.env.LW_BASE_URL || 'http://127.0.0.1:6976',
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      // Hosts with a preinstalled Chromium of a different build (e.g. CI images) can point at it.
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  // LW_BASE_URL points at an already-running server (e.g. `next start` for production checks); then no dev server
  // is started, because two Next processes sharing one .next directory corrupt each other.
  webServer: process.env.LW_BASE_URL ? undefined : {
    command: 'node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 6976',
    url: 'http://127.0.0.1:6976/dev/last-word-stack',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      TURSO_DATABASE_URL: 'file::memory:',
      TURSO_AUTH_TOKEN: '',
      NEXTAUTH_SECRET: 'last-word-local-smoke-only',
      NEXTAUTH_URL: 'http://127.0.0.1:6976',
    },
  },
});
