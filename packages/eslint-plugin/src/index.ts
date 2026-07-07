export { noInternalImport } from './rules/no-internal-import.js';
export type { Restriction } from './rules/no-internal-import.js';
export { noRawCypher } from './rules/no-raw-cypher.js';

import { noInternalImport } from './rules/no-internal-import.js';
import { noRawCypher } from './rules/no-raw-cypher.js';

/**
 * Plugin definition (ESLint flat-config plugin object).
 *
 * @rules STR-5, PC-1, PC-1e
 */
export const plugin = {
  meta: { name: '@iip/eslint-plugin' },
  rules: {
    'no-internal-import': noInternalImport,
    'no-raw-cypher': noRawCypher,
  },
};

/**
 * Flat-config preset (PC-1, PC-1e, STR-5).
 *
 * Seeds two load-bearing seams:
 *  - `@iip/graph/writer` is write-only and may only be imported from
 *    `apps/ingest-worker/src/graph-builder/**` (STR-5). Reads via
 *    `@iip/graph/reader` remain public.
 *  - Raw `ag_catalog.cypher(` is banned outside the sole Cypher seam
 *    `packages/graph/src/cypher.ts` (PC-1e). Use `cypher()` from `@iip/graph`.
 *
 * Extend this preset's `rules` with more restrictions as later stories harden
 * additional seams. Spread this object into the root `eslint.config.js`
 * flat-config array.
 */
export const importBoundaryPreset = {
  name: '@iip/eslint-plugin/import-boundary-preset',
  plugins: { '@iip': plugin },
  rules: {
    '@iip/no-internal-import': [
      'error',
      {
        restrictions: [
          {
            source: '@iip/graph/writer',
            allow: ['apps/ingest-worker/src/graph-builder/**'],
            message:
              "'@iip/graph/writer' is write-only and may only be imported from apps/ingest-worker/src/graph-builder/** (STR-5).",
          },
        ],
      },
    ],
    '@iip/no-raw-cypher': 'error',
  },
};
