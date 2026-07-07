/**
 * @iip/ingest barrel — two-person intake state machine (SEC-2) + (future) fetch/dedupe.
 *
 * STR-1 consolidation: merged `packages/intake` (SEC-2 state machine) into
 * `packages/ingest`. The gate (this code) is the load-bearing part today;
 * `src/fetch/` (tiered crawlers) and `src/dedupe/` land with Epic 3 stories.
 *
 * @rules SEC-2, AC-INTAKE, STR-1
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
