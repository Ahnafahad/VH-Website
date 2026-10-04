import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/last-word-stack',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:6976',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
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
