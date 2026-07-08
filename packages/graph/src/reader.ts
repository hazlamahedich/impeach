/**
 * Reader entry point — public read-path Cypher access (STR-5).
 *
 * Re-exports the sole Cypher seam for read-path consumers (rag, citation,
 * timeline). Reads via `@iip/graph/reader` are allowed anywhere; writes via
 * `@iip/graph/writer` are restricted to `apps/ingest-worker/src/graph-builder/**`.
 *
 * @rules STR-5, PC-1e
 * @adr ADR-0015
 */
export { cypher, type CypherExecutor } from './cypher.js';
