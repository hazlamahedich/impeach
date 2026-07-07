import { describe, it, expect, beforeAll } from 'vitest';
import { ESLint } from 'eslint';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Render-boundary lint test (AC #7).
 *
 * Runs ESLint programmatically (the `ESLint` API) against the REAL root
 * `eslint.config.js`, feeding the intentionally-illegal fixture sources via
 * `lintText()` with virtual filePaths under the package each fixture stands in
 * for. This verifies the actual configuration (not a copy) catches the STR-4 /
 * SC-3 boundary violations with the expected rule IDs.
 *
 * The root config imports `@iip/eslint-plugin` (built `dist/`), so the plugin
 * must be built before this test runs. In CI and under `pnpm test` the turbo
 * `lint` task depends on `@iip/eslint-plugin#build`; running this test file
 * directly without that dependency will fail with a clear precondition error.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const pluginDist = path.join(repoRoot, 'packages/eslint-plugin/dist/index.js');

const fixture = (name: string): string =>
  readFileSync(path.join(repoRoot, 'tests/lint-fixtures', name), 'utf8');

let eslint: ESLint;

beforeAll(
  () => {
    // The plugin dist is guaranteed by turbo (lint task depends on
    // @iip/eslint-plugin#build). We assert it exists so the test fails with a
    // clear precondition error instead of a cryptic module-resolution failure.
    if (!existsSync(pluginDist)) {
      throw new Error(
        `Plugin dist missing at ${pluginDist}. Run \`pnpm --filter @iip/eslint-plugin build\` first.`,
      );
    }
    eslint = new ESLint({ cwd: repoRoot });
  },
  60_000,
);

async function lintVirtual(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) throw new Error(`ESLint produced no result for ${filePath}`);
  return {
    errorCount: result.errorCount,
    ruleIds: result.messages
      .filter((m) => m.severity === 2)
      .map((m) => m.ruleId)
      .filter((r): r is string => Boolean(r)),
  };
}

describe('render boundary lint fixtures (AC #7, STR-4 / SC-3)', () => {
  it('flags rag importing @iip/render with the expected rule id', async () => {
    const { errorCount, ruleIds } = await lintVirtual(
      fixture('rag-imports-render.ts'),
      'packages/rag/src/illegal.ts',
    );
    expect(errorCount).toBeGreaterThan(0);
    // Deterministic core rule (string-based; survives resolver gaps).
    expect(ruleIds).toContain('no-restricted-imports');
  });

  it('flags render importing @iip/rag with the expected rule id', async () => {
    const { errorCount, ruleIds } = await lintVirtual(
      fixture('render-imports-rag.ts'),
      'packages/render/src/illegal.ts',
    );
    expect(errorCount).toBeGreaterThan(0);
    expect(ruleIds).toContain('no-restricted-imports');
  });

  it('does not flag a clean rag source that imports only @iip/contracts', async () => {
    const { errorCount } = await lintVirtual(
      "import { RenderInput } from '@iip/contracts';\nexport const x = RenderInput;\n",
      'packages/rag/src/clean.ts',
    );
    expect(errorCount).toBe(0);
  });
});

describe('raw cypher lint fixture (PC-1e — ag_catalog.cypher ban)', () => {
  it('flags raw ag_catalog.cypher() with the @iip/no-raw-cypher rule', async () => {
    const { errorCount, ruleIds } = await lintVirtual(
      fixture('raw-cypher-call.ts'),
      'packages/rag/src/illegal.ts',
    );
    expect(errorCount).toBeGreaterThan(0);
    expect(ruleIds).toContain('@iip/no-raw-cypher');
  });

  it('does not flag the sanctioned seam file packages/graph/src/cypher.ts', async () => {
    // The seam itself emits `ag_catalog.cypher($1, ...)` — that is the ONE
    // sanctioned call site. It must not be flagged.
    const { errorCount } = await lintVirtual(
      "export const sql = `SELECT * FROM ag_catalog.cypher($1, $$ RETURN 1 $$) AS (a agtype)`;\n",
      'packages/graph/src/cypher.ts',
    );
    expect(errorCount).toBe(0);
  });
});
