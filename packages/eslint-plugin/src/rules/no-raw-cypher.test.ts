import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import { noRawCypher } from './no-raw-cypher.js';

/**
 * @iip/no-raw-cypher — RuleTester coverage (PC-1e).
 *
 * Binds ESLint v9's native RuleTester to Vitest (same pattern as
 * no-internal-import.test.ts). Verifies the rule catches BOTH the JS-call form
 * and the string-template form (the real injection vector), and exempts the
 * sanctioned seam file.
 */

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

describe('@iip/no-raw-cypher', () => {
  const ruleTester = new RuleTester({
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
  });

  ruleTester.run('no-raw-cypher', noRawCypher as never, {
    valid: [
      // The sanctioned seam file is exempt.
      {
        filename: 'packages/graph/src/cypher.ts',
        code: "const sql = `SELECT * FROM ag_catalog.cypher($1, $$ RETURN 1 $$) AS (a agtype)`;",
      },
      // The seam's co-located test is exempt.
      {
        filename: 'packages/graph/src/cypher.test.ts',
        code: "expect(text).toContain('ag_catalog.cypher($1');",
      },
      // Clean code with no cypher references.
      {
        filename: 'packages/rag/src/index.ts',
        code: 'export const x = 1;',
      },
      // A template literal without ag_catalog.cypher is fine.
      {
        filename: 'apps/api/src/routes/query.ts',
        code: 'const q = `SELECT * FROM users WHERE id = $1`;',
      },
    ],

    invalid: [
      // Surface 1: JS-call form (bare ag_catalog.cypher call).
      {
        filename: 'packages/rag/src/index.ts',
        code: 'ag_catalog.cypher("g", `MATCH (n) RETURN n`);',
        errors: [{ messageId: 'rawCypher' }],
      },
      // Surface 2: string-template form inside a tagged template literal.
      {
        filename: 'apps/ingest-worker/src/extract/worker.ts',
        code: 'const sql = `SELECT * FROM ag_catalog.cypher(\'iip_graph\', $$ MATCH (n) RETURN n $$) AS (n agtype)`;',
        errors: [{ messageId: 'rawCypher' }],
      },
      // Surface 2b: whitespace-tolerant — `ag_catalog . cypher (` still matches.
      {
        filename: 'packages/rag/src/index.ts',
        code: 'const sql = `SELECT * FROM ag_catalog . cypher (\'g\', $$ RETURN 1 $$)`;',
        errors: [{ messageId: 'rawCypher' }],
      },
      // Surface 3: string-literal form inside client.query('...').
      {
        filename: 'apps/serve-worker/src/index.ts',
        code: "await client.query('SELECT * FROM ag_catalog.cypher(\\'g\\', $$ RETURN 1 $$)');",
        errors: [{ messageId: 'rawCypher' }],
      },
      // Case-insensitive: AG_CATALOG.CYPHER( still matches.
      {
        filename: 'packages/graph-builder/src/x.ts',
        code: 'const sql = `SELECT * FROM AG_CATALOG.CYPHER(\'g\', $$ RETURN 1 $$)`;',
        errors: [{ messageId: 'rawCypher' }],
      },
    ],
  });
});
