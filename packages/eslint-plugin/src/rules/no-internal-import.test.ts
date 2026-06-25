import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import { noInternalImport } from './no-internal-import.js';

/**
 * @iip/no-internal-import — RuleTester coverage (STR-5, PC-1).
 *
 * ESLint v9's native RuleTester is bound to Vitest via the static
 * describe/it setters (ESLint falls back to ambient globals otherwise, which
 * Vitest does not expose without `globals: true`). `noInternalImport` is
 * authored with @typescript-eslint/utils' RuleCreator (proper TSESTree
 * typing); its runtime shape is identical to ESLint's RuleDefinition, so we
 * cast once at the seam to bridge the v8-creator ↔ v9-tester type skew.
 */

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const restrictions = [
  {
    restrictions: [
      {
        source: '@iip/graph/writer',
        allow: ['apps/ingest-worker/src/graph-builder/**'],
        message: 'banned outside the graph-builder (STR-5)',
      },
    ],
  },
];

describe('@iip/no-internal-import', () => {
  const ruleTester = new RuleTester({
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
  });

  ruleTester.run('no-internal-import', noInternalImport as never, {
    valid: [
      {
        filename: 'apps/ingest-worker/src/graph-builder/index.ts',
        code: "import { addEdge } from '@iip/graph/writer';",
        options: restrictions,
      },
      {
        filename: 'packages/rag/src/index.ts',
        code: "import { something } from '@iip/contracts';",
        options: restrictions,
      },
      {
        filename: 'apps/serve-worker/src/index.ts',
        code: "import { read } from '@iip/graph/reader';",
        options: restrictions,
      },
    ],

    invalid: [
      {
        filename: 'packages/rag/src/index.ts',
        code: "import { addEdge } from '@iip/graph/writer';",
        options: restrictions,
        errors: [{ messageId: 'restricted' }],
      },
      {
        filename: 'apps/serve-worker/src/index.ts',
        code: "import { addEdge } from '@iip/graph/writer/sub';",
        options: restrictions,
        errors: [{ messageId: 'restricted' }],
      },
      {
        filename: 'packages/rag/src/index.ts',
        code: "import { x } from '@iip/graph/src/internal/edge.js';",
        options: restrictions,
        errors: [{ messageId: 'internal' }],
      },
      {
        filename: '/Volumes/repo/packages/rag/src/index.ts',
        code: "import { x } from '@iip/graph/src/internal/edge.js';",
        options: restrictions,
        errors: [{ messageId: 'internal' }],
      },
      {
        filename: 'packages/rag/src/index.ts',
        code: "const writer = await import('@iip/graph/writer');",
        options: restrictions,
        errors: [{ messageId: 'restricted' }],
      },
      {
        filename: 'packages/rag/src/index.ts',
        code: "const writer = require('@iip/graph/writer');",
        options: restrictions,
        errors: [{ messageId: 'restricted' }],
      },
    ],
  });
});
