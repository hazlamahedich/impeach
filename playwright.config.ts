/**
 * Playwright configuration — Epic 3 browser E2E framework bootstrap.
 *
 * Story 3.7 (operator triage surface) is the first UI surface requiring real
 * browser E2E. Config follows project-context §Testing & Eval (Playwright 1.50.x
 * pinned to patch) + the playwright-config guardrails.
 *
 * @rules AC-1, FR-1.7, NFR-O-1
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * Base URL resolved from env (operator/CI override) with the web dev-server
 * default fallback. Mirrors the `baseURL` injected into `use` so the webServer
 * probe and the per-test `page.goto('/')` agree on the same origin.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

/**
 * `true` when running under CI — tightens retries/workers and forbids `.only`.
 * Kept as a const (not inlined) so the intent reads at the top of each block.
 */
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['list'],
  ],
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure-and-retries',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'pnpm --filter @iip/web dev',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
