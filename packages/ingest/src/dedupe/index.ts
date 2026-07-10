/**
 * @iip/ingest/dedupe barrel — content_checksum deduplication (FR-1.3).
 *
 * @rules FR-1.3, AC-3
 * @adr ADR-001
 */
export {
  deduplicateDocuments,
  type DedupDocument,
  type DuplicateEntry,
  type DedupResult,
} from './dedup.js';
