/**
 * Drizzle relational schema barrel (STR-12).
 *
 * Single source: only `packages/db/src/schema` declares table defs
 * (project-context: lint-ban table defs elsewhere). `drizzle-kit generate` +
 * `migrate` consume the schema directory glob via `drizzle.config.ts`.
 *
 * AGE DDL is OUTSIDE Drizzle's awareness — parallel `infra/sql/age/` applied
 * by a dedicated boot runner (D1). Relational migrations first, AGE
 * projection second (STR-12).
 *
 * @rules STR-12, AC-1
 * @adr ADR-002
 */
export { intakeDocuments } from './intake-documents.js';
export { editorialLog } from './editorial-log.js';
export { configHistory } from './config-history.js';
// Epic 3 prep (TD3) — ingest pipeline tables (FR-1.1, FR-1.3, FR-1.5, FR-1.6)
export { sources } from './sources.js';
export { documents } from './documents.js';
export { documentEmbeddings } from './document-embeddings.js';
export { ingestionJobs } from './ingestion-jobs.js';
