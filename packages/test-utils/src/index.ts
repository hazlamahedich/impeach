/**
 * @iip/test-utils barrel — test factories for the IIP monorepo.
 *
 * @rules SEC-2, PC-2.6, PC-9
 */
export {
  createKeyPair,
  createSignature,
  createContentHash,
  createPrincipal,
  createDocument,
  asPrincipalSub,
} from './factories/intake.js';
export type {
  TestKeyPair,
  TestPrincipal,
  TestIntakeDocument,
} from './factories/intake.js';

// Story 2.10 — config_history test factory (PC-2.6, PC-9)
export {
  asConfigKey,
  asConfigHistoryId,
  asConfigHistoryRetentionClass,
  asPrincipal,
  makeConfigHistoryEntry,
} from './factories/config-history.js';
export type { ConfigHistoryEntry } from '@iip/config';

// Epic 3 — ingest domain factories (FR-1.1, FR-1.3, FR-1.5, FR-1.6)
export {
  asSourceId,
  asSourceSourceType,
  asCrawlStrategy,
  makeSource,
} from './factories/source.js';
export type { TestSource } from './factories/source.js';

export {
  asDocumentId,
  asContentChecksum,
  asRawSnapshotKey,
  makeDocument,
} from './factories/document.js';
export type { TestDocument, TestFetchMetadata } from './factories/document.js';

export {
  asJobId,
  asJobState,
  asStateRunId,
  makeIngestionJob,
} from './factories/ingestion-job.js';
export type { TestIngestionJob, TestJobError } from './factories/ingestion-job.js';
