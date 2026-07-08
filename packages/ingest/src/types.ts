/**
 * Intake gate public types (SEC-2).
 *
 * Defines the contract surface consumed by the API routes (Task 5), the
 * worker guard (Task 6), and tests. Implementation lives in
 * `./gate/state.js` (state machine) and `./crypto/verify.js` (signature
 * verification).
 *
 * @rules SEC-2, AC-INTAKE, DoD-1, DoD-3
 * @adr ADR-0001
 */
import type { DocumentStatus, IntakeContentHash, IntakeEventLogger } from '@iip/contracts';

/**
 * IntakeError — closed set of intake failure variants (mirrors AuthError
 * discipline, Winston #17).
 *
 * `KEY_REVOKED` is a distinct code from `INVALID_SIGNATURE` so revocation
 * is observable separately from forgery (AC-10, DoD-11).
 *
 * @rules SEC-2, AC-10, DoD-11
 */
export type IntakeErrorCode =
  | 'intake.invalid_signature'
  | 'intake.key_revoked'
  | 'intake.invalid_transition'
  | 'intake.same_principal'
  | 'intake.signature_failed'
  | 'intake.approval_window_expired'
  | 'intake.inter_signature_delay'
  | 'intake.bypass_attempt'
  | 'intake.replay'
  | 'intake.tier5_partner_required'
  | 'intake.unknown_kid'
  | 'intake.insufficient_scope';

export class IntakeError extends Error {
  override readonly name = 'IntakeError';
  constructor(
    message: string,
    readonly code: IntakeErrorCode,
  ) {
    super(message);
  }
}

/**
 * IntakeDocument — the state-machine record (mirrors `intake_documents` table).
 *
 * Nullable fields are populated only at specific lifecycle stages (DoD-7
 * nullability discipline). `status` and `content_hash` are always present.
 *
 * @rules SEC-2, DoD-7
 */
export interface IntakeDocument {
  readonly id: string;
  readonly content_hash: IntakeContentHash;
  readonly status: DocumentStatus;
  readonly tier: number;
  readonly reviewer_sub: string | null;
  readonly reviewer_signature: string | null;
  readonly reviewer_key_kid: string | null;
  readonly reviewed_at: Date | null;
  readonly approver_sub: string | null;
  readonly approver_signature: string | null;
  readonly approver_key_kid: string | null;
  readonly approved_at: Date | null;
  readonly partner_kid: string | null;
  readonly partner_signature: string | null;
}

/**
 * OperatorKeyEntry — a resolved operator public key + its revocation status.
 *
 * `status` is read FRESH on every verification (DoD-11: no caching of
 * status; revocation is immediate).
 *
 * @rules SEC-2, DoD-4, DoD-11
 */
export interface OperatorKeyEntry {
  readonly publicKey: CryptoKey;
  readonly status: 'active' | 'revoked';
}

/**
 * OperatorKeyRegistry — resolves an operator kid to its key + status.
 *
 * The implementer reads `status` from the backing config on each `get()` so
 * revocation takes effect without a redeploy (DoD-11).
 *
 * @rules SEC-2, DoD-4, DoD-11
 */
export interface OperatorKeyRegistry {
  get(kid: string): OperatorKeyEntry | undefined;
}

/**
 * PartnerKeyRegistry — resolves a partner kid to its public key (Tier-5).
 *
 * @rules SEC-2, AC-5, DoD-4
 */
export interface PartnerKeyRegistry {
  get(kid: string): CryptoKey | undefined;
}

/**
 * ReplayDetector — idempotency guard on signature submission (TC-1.15).
 *
 * Mirrors {@link import('@iip/auth').ReplayDetector}. The tuple is
 * `${content_hash}:${signature}:${principalSub}:${transition}`; an exact
 * resubmission is rejected so a captured signature cannot be replayed.
 *
 * @rules SEC-2, TC-1.15
 */
export interface ReplayDetector {
  checkAndRecord(tuple: string): Promise<boolean>;
}

/** In-memory ReplayDetector for tests and single-process workers. */
export class InMemoryIntakeReplayDetector implements ReplayDetector {
  private readonly seen = new Set<string>();
  async checkAndRecord(tuple: string): Promise<boolean> {
    if (this.seen.has(tuple)) return false;
    this.seen.add(tuple);
    return true;
  }
}

/** A base64 Ed25519 signature plus the signing principal identity. */
export interface SignatureEnvelope {
  readonly principalSub: string;
  readonly principalKid: string;
  readonly signature: string;
}

/** A partner (Tier-5) provenance signature envelope. */
export interface PartnerSignatureEnvelope {
  readonly kid: string;
  readonly signature: string;
}

/** Input for the review/approve transitions (signature + optional partner). */
export interface ReviewInput extends SignatureEnvelope {
  readonly partnerSignature?: PartnerSignatureEnvelope;
}

/** Input for reject/revise transitions (no signature required). */
export interface ReasonInput {
  readonly principalSub: string;
  readonly principalKid: string;
  readonly reason: string;
}

/**
 * IntakeGateConfig — injected dependencies for the state machine.
 *
 * Dependencies are injected (not module-level) so Stryker can test every
 * branch in isolation (SEC-8, DoD-2). `now()` is injectable so temporal
 * constraints are deterministic under test.
 *
 * @rules SEC-2, SEC-8, DoD-2, DoD-4
 */
export interface IntakeGateConfig {
  readonly operatorKeyring: OperatorKeyRegistry;
  readonly partnerKeyring: PartnerKeyRegistry;
  readonly eventLogger: IntakeEventLogger;
  readonly replayDetector: ReplayDetector;
  readonly approvalWindowSeconds: number;
  readonly minInterSignatureDelayMs: number;
  readonly now: () => Date;
  readonly systemSignKey: CryptoKey;
}

/**
 * AttestationPayload — the externally-verifiable record (AC-9).
 *
 * @rules SEC-2, AC-9
 */
export interface AttestationPayload {
  readonly document_id: string;
  readonly content_hash: IntakeContentHash;
  readonly reviewer_sub: string | null;
  readonly reviewer_key_kid: string | null;
  readonly approver_sub: string | null;
  readonly approver_key_kid: string | null;
  readonly reviewed_at: string | null;
  readonly approved_at: string | null;
  readonly partner_kid: string | null;
}

/** A signed attestation (payload + Ed25519 signature by the system key). */
export interface SignedAttestation {
  readonly payload: AttestationPayload;
  readonly signature: string;
}

/**
 * IntakeGate — the two-person intake state machine interface.
 *
 * @rules SEC-2, AC-INTAKE
 */
export interface IntakeGate {
  review(doc: IntakeDocument, input: ReviewInput): Promise<IntakeDocument>;
  approve(doc: IntakeDocument, input: ReviewInput): Promise<IntakeDocument>;
  reject(doc: IntakeDocument, input: ReasonInput): Promise<IntakeDocument>;
  revise(doc: IntakeDocument, input: ReasonInput): Promise<IntakeDocument>;
  assertExtractable(doc: IntakeDocument, principal: { sub: string; kid: string }): Promise<void>;
  beginExtraction(doc: IntakeDocument, principal: { sub: string; kid: string }): Promise<IntakeDocument>;
  completeIndexing(doc: IntakeDocument): Promise<IntakeDocument>;
  issueAttestation(doc: IntakeDocument): Promise<SignedAttestation>;
}
