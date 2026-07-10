export { createDb, closeDb, type Db, type DbHandle } from './client.js';
export { withTx } from './tx.js';
export { upsertLastWriteWins, upsertFirstWriteWins } from './upsert.js';
export * from './schema/index.js';
// Story 3.1 — source registry repository (FR-1.1)
export {
  createSourcesRepository,
  normalizeUrl,
  type SourceRegistryRepo,
} from './repositories/sources.js';
// Story 3.3 — documents repository (FR-1.3, PC-1a)
export {
  createDocumentsRepository,
  type DocumentsRepository,
  type DocumentRow,
  type UpsertDocumentInput,
} from './repositories/documents.js';
