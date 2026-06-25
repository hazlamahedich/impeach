import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';
import minimatch from 'minimatch';

/**
 * @iip/no-internal-import — enforces package `exports`-map boundaries.
 *
 * Two capabilities (STR-5, PC-1):
 *
 *  1. Restricted-specifier list: ban a bare specifier or subpath
 *     (e.g. `@iip/graph/writer`) outside an allow-list of importer paths.
 *  2. Internal-path reach: report any import whose source drills into a
 *     package `internal/**` subtree from outside that subtree — i.e. reaching
 *     past the public `exports` map.
 *
 * Seeded restriction: `@iip/graph/writer` is write-only and may only be
 * imported from `apps/ingest-worker/src/graph-builder/**` (STR-5). Reads via
 * `@iip/graph/reader` remain public.
 *
 * @rules STR-5, PC-1
 */

type Restriction = {
  /** Restricted bare specifier or subpath (exact, or prefix when ending in '/'). */
  source: string;
  /** minimatch globs of importer paths that MAY use `source`. */
  allow: readonly string[];
  /** Violation message. */
  message: string;
};

export type { Restriction };

type Options = [{ restrictions: Restriction[] }];

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/impeachment-watch/iip/blob/main/docs/lint-rules/${name}.md`,
);

export const noInternalImport = createRule<Options, 'restricted' | 'internal'>({
  name: 'no-internal-import',
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce package exports-map boundaries (STR-5).',
    },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          restrictions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['source', 'allow', 'message'],
              properties: {
                source: { type: 'string' },
                allow: {
                  type: 'array',
                  items: { type: 'string' },
                },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    ],
    messages: {
      restricted: '{{message}}',
      internal:
        "'{{source}}' reaches into an internal/** subtree not exposed by the package exports map (STR-5).",
    },
  },
  defaultOptions: [{ restrictions: [] }],
  create(context, [{ restrictions }]) {
    const filename = context.filename ?? context.getFilename();
    const repoRoot = process.cwd();
    const relFilename = filename.startsWith(repoRoot)
      ? filename.slice(repoRoot.length + 1)
      : filename;

    const checkSource = (sourceNode: TSESTree.StringLiteral | null): void => {
      if (!sourceNode) return;
      const spec = sourceNode.value;
      if (!spec) return;

      for (const r of restrictions) {
        if (matchesSpecifier(spec, r.source)) {
          const allowed = r.allow.some((glob) => minimatch(relFilename, glob));
          if (!allowed) {
            context.report({
              node: sourceNode,
              messageId: 'restricted',
              data: { message: r.message },
            });
          }
        }
      }

      if (isInternalReach(spec, relFilename)) {
        context.report({
          node: sourceNode,
          messageId: 'internal',
          data: { source: spec },
        });
      }
    };

    return {
      ImportDeclaration(node) {
        checkSource(node.source);
      },
      ExportNamedDeclaration(node) {
        checkSource(node.source);
      },
      ExportAllDeclaration(node) {
        checkSource(node.source);
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal') {
          checkSource(node.source as TSESTree.StringLiteral);
        }
      },
      TSImportEqualsDeclaration(node) {
        if (
          node.moduleReference.type === 'TSExternalModuleReference' &&
          node.moduleReference.expression.type === 'Literal'
        ) {
          checkSource(node.moduleReference.expression as TSESTree.StringLiteral);
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments.length > 0 &&
          node.arguments[0]?.type === 'Literal'
        ) {
          checkSource(node.arguments[0] as TSESTree.StringLiteral);
        }
      },
    };
  },
});

function matchesSpecifier(spec: string, target: string): boolean {
  if (spec === target) return true;
  if (target.endsWith('/')) return spec.startsWith(target);
  return spec.startsWith(`${target}/`);
}

function isInternalReach(spec: string, filename: string): boolean {
  // Only enforce exports-map boundaries for workspace packages.
  if (!spec.startsWith('@iip/')) return false;
  if (!spec.includes('/internal/')) return false;
  // Allow imports inside any package's own internal subtree (cross-package
  // internal reach is still banned by the restriction list or zone rules).
  if (filename.includes('/internal/')) return false;
  return true;
}
