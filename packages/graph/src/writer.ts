/**
 * Writer entry point — write-path Cypher access (STR-5).
 *
 * Re-exports the sole Cypher seam for the graph-builder (sole AGE writer).
 * `@iip/eslint-plugin` `no-internal-import` restricts `@iip/graph/writer` to
 * `apps/ingest-worker/src/graph-builder/**` only (STR-5). Reads via
 * `@iip/graph/reader` remain public.
 *
 * @rules STR-5, PC-1e, PC-2.5
 * @adr ADR-0015
 */
export { cypher, type CypherExecutor } from './cypher.js';
