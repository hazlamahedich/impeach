/**
 * Intake contract barrel (SEC-2).
 *
 * @rules SEC-2, AC-INTAKE
 */
export {
  DocumentStatusLiteral,
  DocumentStatus,
  Ed25519Signature,
  KeyId,
  IntakeContentHash,
} from './state.js';
export type {
  DocumentStatusLiteral as DocumentStatusLiteralType,
  DocumentStatus as DocumentStatusType,
  Ed25519Signature as Ed25519SignatureType,
  KeyId as KeyIdType,
  IntakeContentHash as IntakeContentHashType,
} from './state.js';

// Story 2.6a — AR-23 / VAL-2 G-2 retention/takedown contract types
export {
  RetentionPolicyLiteral,
  RetentionPolicy,
} from './retention.js';
export type {
  RetentionPolicyLiteral as RetentionPolicyLiteralType,
  RetentionPolicy as RetentionPolicyType,
} from './retention.js';

export {
  IntakeEventName,
  IntakeEvent,
  NoopIntakeEventLogger,
} from './IntakeEventLogger.js';
export type {
  IntakeEventName as IntakeEventNameType,
  IntakeEvent as IntakeEventType,
  IntakeEventLogger,
} from './IntakeEventLogger.js';

export {
  computeContentHash,
  signaturePayloadFromHash,
  CONTENT_HASH_REGEX,
} from './signature-payload.js';
