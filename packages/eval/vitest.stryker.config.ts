import { defineConfig } from 'vitest/config';

// Stryker-specific Vitest config — excludes the __tests__/*.spec.ts structural
// self-verification tests (english-oq9.spec.ts, filipino-oq9.spec.ts) which use
// `existsSync` + `import.meta.url` path checks that break under Stryker's temp-
// sandbox file copy. The co-located *.test.ts files (including the oq9
// mutation-relevant manifest-oq9-guards.test.ts + oq9.test.ts) are included.
// This is a test-discovery scoping fix, not a coverage gap — the spec files
// assert structural invariants (file paths, manifest existence), not oq9 logic.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*', 'src/__tests__/**/*.spec.ts'],
  },
});
