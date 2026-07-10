/**
 * @iip/ingest barrel — two-person intake state machine (SEC-2) + fetch/dedupe.
 *
 * STR-1 consolidation: merged `packages/intake` (SEC-2 state machine) into
 * `packages/ingest`. Story 3.3 adds `src/fetch/` (tiered crawlers + Crawler
 * port) and `src/dedupe/` (content_checksum deduplication).
 *
 * @rules SEC-2, AC-INTAKE, STR-1, FR-1.3
 */
export const packageName = '@iip/ingest';

export function hello(): string {
  return `alive: ${packageName}`;
}

export {
  IntakeError,
  InMemoryIntakeReplayDetector,
} from './types.js';
export type {
  IntakeErrorCode,
  IntakeDocument,
  OperatorKeyEntry,
  OperatorKeyRegistry,
  PartnerKeyRegistry,
  ReplayDetector,
  SignatureEnvelope,
  PartnerSignatureEnvelope,
  ReviewInput,
  ReasonInput,
  IntakeGateConfig,
  AttestationPayload,
  SignedAttestation,
  IntakeGate,
} from './types.js';

export { createIntakeGate } from './gate/state.js';
export {
  createOperatorKeyRegistry,
  createPartnerKeyRegistry,
} from './crypto/verify.js';
export { verifyAttestation } from './attestation.js';

// Story 3.3 — fetch adapters + deduplication (FR-1.3)
export {
  deduplicateDocuments,
  type DedupDocument,
  type DuplicateEntry,
  type DedupResult,
} from './dedupe/index.js';

