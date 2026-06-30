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
