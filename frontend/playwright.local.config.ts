import { defineConfig, devices } from '@playwright/test';

/** Live (unmocked) browser smoke against the isolated local stack. Servers are NOT started here: use `npm run local:dev`. */
export default defineConfig({
  testDir: './e2e-local',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5183',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
