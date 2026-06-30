/**
 * @iip/intake barrel — two-person intake state machine (SEC-2).
 *
 * @rules SEC-2, AC-INTAKE
 */
export const packageName = '@iip/intake';

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
