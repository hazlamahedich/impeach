import { defineConfig } from 'vitest/config';

/**
 * Stryker-dedicated Vitest config for packages/editorial.
 *
 * The package-level vitest.config.ts only includes src tests, which is
 * correct for `pnpm --filter @iip/editorial test` but insufficient for
 * mutation testing: the root-level integration/chaos/perf suites (and the
 * Story 2.4 integration suite) are the tests that actually exercise
 * editorial-log-repo.ts. This config layers those suites on top without
 * changing the package's normal test command.
 *
 * @rules DoD-5, DoD-9, SEC-6
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      '../../tests/integration/editorial-log*.integration.test.ts',
      '../../tests/chaos/editorial-log*.chaos.test.ts',
      '../../tests/perf/editorial-log*.perf.test.ts',
      '../../tests/contract/editorial-boundary.contract.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 120_000,
    hookTimeout: 240_000,
  },
});
