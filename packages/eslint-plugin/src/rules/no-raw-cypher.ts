import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';
import minimatch from 'minimatch';

/**
 * @iip/no-raw-cypher — bans raw `ag_catalog.cypher(` outside the sole seam
 * (PC-1e).
 *
 * Apache AGE is invoked via `ag_catalog.cypher(graph, $$ ... $$)` SQL. Two
 * hazard surfaces exist:
 *
 *  1. **JS-call form**: `ag_catalog.cypher(...)` as a JavaScript CallExpression
 *     (e.g. if someone exposed the AGE function as a JS method). Rare in this
 *     codebase but mechanically possible.
 *  2. **String-template form**: `sql\`SELECT ... FROM ag_catalog.cypher('g',
 *     $$ ... $$)\`` or `client.query('... ag_catalog.cypher(...) ...')`. This
 *     is the REAL injection vector — an `$id` interpolated into the `$$ ... $$`
 *     block is string-substituted, not parameter-bound (ADR-0015).
 *
 * This rule reports both forms everywhere except the sanctioned seam file
 * `packages/graph/src/cypher.ts` (PC-1e). The `no-internal-syntax` selector
 * catches the JS-call form; a `Literal`/`TemplateElement` text scan catches
 * the string-template form (built-in `no-restricted-syntax` cannot match text
 * inside template strings, which is why this is a plugin rule).
 *
 * @rules PC-1e, NFR-S-2
 * @adr ADR-0015, ADR-0002
 */

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/impeachment-watch/iip/blob/main/docs/lint-rules/${name}.md`,
);

/** Files where raw `ag_catalog.cypher(` is permitted:
 *  - the sanctioned seam + its co-located test (PC-1e);
 *  - this rule's own source + RuleTester (the rule references the pattern it bans);
 *  - the lint-boundary integration test (asserts the rule fires).
 */
const ALLOW_GLOBS = [
  'packages/graph/src/cypher.ts',
  'packages/graph/src/cypher.test.ts',
  'packages/eslint-plugin/src/rules/no-raw-cypher.ts',
  'packages/eslint-plugin/src/rules/no-raw-cypher.test.ts',
  'tests/lint/import-boundaries.test.ts',
];

/** Regex matching `ag_catalog.cypher(` with tolerant whitespace/comment gaps. */
const RAW_CYPHER_RE = /ag_catalog\s*\.\s*cypher\s*\(/i;

type Options = [];

export const noRawCypher = createRule<Options, 'rawCypher'>({
  name: 'no-raw-cypher',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ban raw ag_catalog.cypher() outside the sole seam packages/graph/src/cypher.ts (PC-1e).',
    },
    schema: [],
    messages: {
      rawCypher:
        'Raw ag_catalog.cypher() is banned outside packages/graph/src/cypher.ts (PC-1e). Use the cypher(graph, query, params) wrapper from @iip/graph. See ADR-0015.',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const repoRoot = process.cwd();
    const relFilename = filename.startsWith(repoRoot)
      ? filename.slice(repoRoot.length + 1)
      : filename;

    // Allow-list: skip the sanctioned seam + its co-located tests.
    if (ALLOW_GLOBS.some((glob) => minimatch(relFilename, glob))) {
      return {};
    }

    /** Report a node with the rawCypher message. */
    const report = (node: TSESTree.Node): void => {
      context.report({ node, messageId: 'rawCypher' });
    };

    return {
      // Surface 1: JS-call form `ag_catalog.cypher(...)`.
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'ag_catalog' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'cypher'
        ) {
          report(node);
        }
      },

      // Surface 2: string-template form inside a tagged template or a plain
      // template literal (`sql\`... ag_catalog.cypher(...) ...\``).
      TemplateElement(node) {
        if (typeof node.value.raw === 'string' && RAW_CYPHER_RE.test(node.value.raw)) {
          report(node);
        }
      },

      // Surface 3: string-literal form (`client.query('... ag_catalog.cypher(...) ...')`).
      Literal(node) {
        if (typeof node.value === 'string' && RAW_CYPHER_RE.test(node.value)) {
          report(node);
        }
      },
    };
  },
});

export { ALLOW_GLOBS, RAW_CYPHER_RE };
