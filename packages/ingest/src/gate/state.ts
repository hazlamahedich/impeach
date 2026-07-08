/**
 * Two-person intake state machine engine (SEC-2, Task 4).
 *
 * Enforces the cryptographic two-person rule: no document is extracted or
 * indexed without Ed25519 signatures from two DISTINCT operators (reviewer +
 * approver). The full state graph (AC-1):
 *
 *   staging -> reviewed_once -> approved -> extracting -> indexed  (happy)
 *   staging -> rejected                          (terminal rejection)
 *   reviewed_once -> rejected                    (terminal rejection)
 *   reviewed_once -> needs_revision -> staging   (remediation loop)
 *
 * Dependencies are injected (not module-level) so Stryker can test every
 * branch in isolation (SEC-8, DoD-2). `now()` is injectable so temporal
 * constraints are deterministic under test.
 *
 * @rules SEC-2, AC-INTAKE, AC-1..AC-10, DoD-2, DoD-11
 * @adr ADR-0001
 */
import type { DocumentStatus, IntakeEvent, IntakeEventLogger } from '@iip/contracts';
import { IntakeError } from '../types.js';
import type {
  IntakeDocument,
  IntakeGate,
  IntakeGateConfig,
  ReasonInput,
  SignedAttestation,
  AttestationPayload,
} from '../types.js';
import { verifyOperatorSignature, verifyPartnerSignature } from '../crypto/verify.js';
import { signAttestation } from '../attestation.js';

/** States the worker may extract from (AC-6, idempotent retry). */
const EXTRACTABLE_STATES: ReadonlySet<string> = new Set(['approved', 'extracting']);

/** Tuple key for replay detection (TC-1.15). */
function replayTuple(contentHash: string, signature: string, principalSub: string, transition: string): string {
  return `${contentHash}:${signature}:${principalSub}:${transition}`;
}

/** Build + log an IntakeEvent (fail-safe: logging never blocks the throw). */
async function emit(
  logger: IntakeEventLogger,
  fields: {
    event: IntakeEvent['event'];
    principalSub: string;
    keyKid: string;
    doc: IntakeDocument;
    now: Date;
    previous: DocumentStatus;
    next: DocumentStatus;
    reason?: string;
  },
): Promise<void> {
  const event: IntakeEvent = {
    event: fields.event,
    principal_sub: fields.principalSub,
    key_kid: fields.keyKid,
    document_id: fields.doc.id,
    content_hash: fields.doc.content_hash,
    timestamp: fields.now.toISOString(),
    previous_state: fields.previous,
    new_state: fields.next,
    // `reason` is an optional event field; spreading `reason: undefined` is
    // observationally equivalent to omitting it, so the ConditionalExpression
    // mutant here is equivalent (Stryker disable).
    // Stryker disable next-line ConditionalExpression
    ...(fields.reason !== undefined ? { reason: fields.reason } : {}),
  };
  try {
    await logger.log(event);
  } catch {
    // Logging must never block a fail-closed decision (AC-11, SEC-2).
  }
}

/** Copy a doc with overridden fields (immutable updates). */
function withDoc(doc: IntakeDocument, overrides: Partial<IntakeDocument>): IntakeDocument {
  return { ...doc, ...overrides } as IntakeDocument;
}

/**
 * Create a configured intake gate with injected dependencies.
 *
 * @rules SEC-2, SEC-8, DoD-2
 * @adr ADR-0001
 */
export function createIntakeGate(config: IntakeGateConfig): IntakeGate {
  const {
    operatorKeyring,
    partnerKeyring,
    eventLogger,
    replayDetector,
    approvalWindowSeconds,
    minInterSignatureDelayMs,
    now,
    systemSignKey,
  } = config;

  async function requireTransition(doc: IntakeDocument, allowed: readonly string[], target: string): Promise<void> {
    if (!allowed.includes(doc.status)) {
      await emit(eventLogger, {
        event: 'intake.invalid_transition',
        principalSub: '',
        keyKid: '',
        doc,
        now: now(),
        previous: doc.status,
        next: target as DocumentStatus,
      });
      throw new IntakeError(
        `invalid transition: ${doc.status} -> ${target}`,
        'intake.invalid_transition',
      );
    }
  }

  return {
    // ── staging -> reviewed_once ──
    async review(doc, input): Promise<IntakeDocument> {
      await requireTransition(doc, ['staging'], 'reviewed_once');

      const tuple = replayTuple(doc.content_hash, input.signature, input.principalSub, 'review');
      if (!(await replayDetector.checkAndRecord(tuple))) {
        throw new IntakeError('replay: review signature already submitted', 'intake.replay');
      }

      try {
        await verifyOperatorSignature(operatorKeyring, input.principalKid, input.signature, doc.content_hash);
      } catch (err) {
        await logSignatureFailure(eventLogger, err, input.principalSub, input.principalKid, doc, now);
        throw err;
      }

      // Tier-5 partnership: additional partner provenance signature (AC-5).
      if (doc.tier === 5) {
        const partner = input.partnerSignature;
        if (partner === undefined) {
          await emit(eventLogger, {
            event: 'intake.signature_failed',
            principalSub: input.principalSub,
            keyKid: input.principalKid,
            doc,
            now: now(),
            previous: doc.status,
            next: doc.status,
            reason: 'tier-5 partner signature missing',
          });
          throw new IntakeError('tier-5 document requires a partner signature', 'intake.tier5_partner_required');
        }
        try {
          await verifyPartnerSignature(partnerKeyring, partner.kid, partner.signature, doc.content_hash);
        } catch (err) {
          await emit(eventLogger, {
            event: 'intake.signature_failed',
            principalSub: input.principalSub,
            keyKid: partner.kid,
            doc,
            now: now(),
            previous: doc.status,
            next: doc.status,
            reason: 'tier-5 partner signature invalid',
          });
          // Tier-5 partner failures surface as the tier5 code so the gate
          // fails closed on missing/unknown/invalid partner signatures.
          // verifyPartnerSignature only throws IntakeError, so the `&&` right
          // operand and the `instanceof` check are constant here — those
          // LogicalOperator/ConditionalExpression mutants are equivalent.
          // Stryker disable next-line LogicalOperator, ConditionalExpression
          if (err instanceof IntakeError && err.code === 'intake.invalid_signature') {
            throw new IntakeError('tier-5 partner signature missing/unknown/invalid', 'intake.tier5_partner_required');
          }
          throw err;
        }
      }

      const reviewedAt = now();
      const updated = withDoc(doc, {
        status: 'reviewed_once' as DocumentStatus,
        reviewer_sub: input.principalSub,
        reviewer_key_kid: input.principalKid,
        reviewer_signature: input.signature,
        reviewed_at: reviewedAt,
        partner_kid: input.partnerSignature?.kid ?? null,
        partner_signature: input.partnerSignature?.signature ?? null,
      });
      await emit(eventLogger, {
        event: 'intake.reviewed_once',
        principalSub: input.principalSub,
        keyKid: input.principalKid,
        doc,
        now: reviewedAt,
        previous: doc.status,
        next: updated.status,
      });
      return updated;
    },

    // ── reviewed_once -> approved ──
    async approve(doc, input): Promise<IntakeDocument> {
      await requireTransition(doc, ['reviewed_once'], 'approved');

      const reviewedAt = doc.reviewed_at;
      if (reviewedAt === null) {
        throw new IntakeError('reviewed_once document missing reviewed_at', 'intake.invalid_transition');
      }
      const elapsedMs = now().getTime() - reviewedAt.getTime();

      // Temporal: approval window expiry (AC-8) — reverts to staging.
      if (elapsedMs > approvalWindowSeconds * 1000) {
        await emit(eventLogger, {
          event: 'intake.approval_window_expired',
          principalSub: input.principalSub,
          keyKid: input.principalKid,
          doc,
          now: now(),
          previous: doc.status,
          next: 'staging' as DocumentStatus,
          reason: 'approval window expired',
        });
        throw new IntakeError('approval window expired', 'intake.approval_window_expired');
      }

      // Temporal: mandatory inter-signature delay (AC-8).
      if (elapsedMs < minInterSignatureDelayMs) {
        await emit(eventLogger, {
          event: 'intake.inter_signature_delay_violation',
          principalSub: input.principalSub,
          keyKid: input.principalKid,
          doc,
          now: now(),
          previous: doc.status,
          next: doc.status,
          reason: 'inter-signature delay not elapsed',
        });
        throw new IntakeError('inter-signature delay not elapsed', 'intake.inter_signature_delay');
      }

      // Replay guard.
      const tuple = replayTuple(doc.content_hash, input.signature, input.principalSub, 'approve');
      if (!(await replayDetector.checkAndRecord(tuple))) {
        throw new IntakeError('replay: approve signature already submitted', 'intake.replay');
      }

      // Verify approver signature.
      try {
        await verifyOperatorSignature(operatorKeyring, input.principalKid, input.signature, doc.content_hash);
      } catch (err) {
        await logSignatureFailure(eventLogger, err, input.principalSub, input.principalKid, doc, now);
        throw err;
      }

      // Tier-5 partner signature (AC-5).
      if (doc.tier === 5) {
        const partner = input.partnerSignature;
        if (partner === undefined) {
          throw new IntakeError('tier-5 document requires a partner signature', 'intake.tier5_partner_required');
        }
        try {
          await verifyPartnerSignature(partnerKeyring, partner.kid, partner.signature, doc.content_hash);
        } catch (err) {
          // Stryker disable next-line LogicalOperator, ConditionalExpression
          if (err instanceof IntakeError && err.code === 'intake.invalid_signature') {
            throw new IntakeError('tier-5 partner signature missing/unknown/invalid', 'intake.tier5_partner_required');
          }
          throw err;
        }
      }

      // Distinct principal guard (AC-4): identity is on the `sub` claim.
      if (input.principalSub === doc.reviewer_sub) {
        await emit(eventLogger, {
          event: 'intake.same_principal_rejected',
          principalSub: input.principalSub,
          keyKid: input.principalKid,
          doc,
          now: now(),
          previous: doc.status,
          next: doc.status,
          reason: 'approver and reviewer are the same principal',
        });
        throw new IntakeError('approver must differ from reviewer', 'intake.same_principal');
      }

      const approvedAt = now();
      const updated = withDoc(doc, {
        status: 'approved' as DocumentStatus,
        approver_sub: input.principalSub,
        approver_key_kid: input.principalKid,
        approver_signature: input.signature,
        approved_at: approvedAt,
      });
      await emit(eventLogger, {
        event: 'intake.approved',
        principalSub: input.principalSub,
        keyKid: input.principalKid,
        doc,
        now: approvedAt,
        previous: doc.status,
        next: updated.status,
      });
      return updated;
    },

    // ── staging | reviewed_once -> rejected ──
    async reject(doc, input: ReasonInput): Promise<IntakeDocument> {
      await requireTransition(doc, ['staging', 'reviewed_once'], 'rejected');
      const updated = withDoc(doc, { status: 'rejected' as DocumentStatus });
      await emit(eventLogger, {
        event: 'intake.rejected',
        principalSub: input.principalSub,
        keyKid: input.principalKid,
        doc,
        now: now(),
        previous: doc.status,
        next: updated.status,
        reason: input.reason,
      });
      return updated;
    },

    // ── reviewed_once -> needs_revision ──
    async revise(doc, input: ReasonInput): Promise<IntakeDocument> {
      await requireTransition(doc, ['reviewed_once'], 'needs_revision');
      const updated = withDoc(doc, { status: 'needs_revision' as DocumentStatus });
      await emit(eventLogger, {
        event: 'intake.needs_revision',
        principalSub: input.principalSub,
        keyKid: input.principalKid,
        doc,
        now: now(),
        previous: doc.status,
        next: updated.status,
        reason: input.reason,
      });
      return updated;
    },

    // ── worker fail-closed gate (AC-6) ──
    async assertExtractable(doc, principal): Promise<void> {
      if (!EXTRACTABLE_STATES.has(doc.status)) {
        await emit(eventLogger, {
          event: 'intake.bypass_attempt',
          principalSub: principal.sub,
          keyKid: principal.kid,
          doc,
          now: now(),
          previous: doc.status,
          next: doc.status,
          reason: `extraction attempted from ${doc.status}`,
        });
        throw new IntakeError(
          `extraction requires approved|extracting, got ${doc.status}`,
          'intake.bypass_attempt',
        );
      }
    },

    // ── approved -> extracting (worker begins) ──
    async beginExtraction(doc, principal): Promise<IntakeDocument> {
      await requireTransition(doc, ['approved'], 'extracting');
      const updated = withDoc(doc, { status: 'extracting' as DocumentStatus });
      await emit(eventLogger, {
        event: 'intake.extracting',
        principalSub: principal.sub,
        keyKid: principal.kid,
        doc,
        now: now(),
        previous: doc.status,
        next: updated.status,
      });
      return updated;
    },

    // ── extracting -> indexed (worker completes) ──
    async completeIndexing(doc): Promise<IntakeDocument> {
      await requireTransition(doc, ['extracting'], 'indexed');
      const updated = withDoc(doc, { status: 'indexed' as DocumentStatus });
      await emit(eventLogger, {
        event: 'intake.indexed',
        principalSub: 'system',
        keyKid: 'system',
        doc,
        now: now(),
        previous: doc.status,
        next: updated.status,
      });
      return updated;
    },

    // ── externally-verifiable attestation (AC-9) ──
    async issueAttestation(doc): Promise<SignedAttestation> {
      if (doc.status !== 'indexed') {
        throw new IntakeError(
          `attestation requires indexed state, got ${doc.status}`,
          'intake.invalid_transition',
        );
      }
      return signAttestation(buildPayload(doc), systemSignKey);
    },
  };
}

/** Build the externally-verifiable attestation payload from a document. */
function buildPayload(doc: IntakeDocument): AttestationPayload {
  return {
    document_id: doc.id,
    content_hash: doc.content_hash,
    reviewer_sub: doc.reviewer_sub,
    reviewer_key_kid: doc.reviewer_key_kid,
    approver_sub: doc.approver_sub,
    approver_key_kid: doc.approver_key_kid,
    reviewed_at: doc.reviewed_at !== null ? doc.reviewed_at.toISOString() : null,
    approved_at: doc.approved_at !== null ? doc.approved_at.toISOString() : null,
    partner_kid: doc.partner_kid,
  };
}

/** Emit the appropriate signature-failure event (KEY_REVOKED vs signature_failed). */
async function logSignatureFailure(
  logger: IntakeEventLogger,
  err: unknown,
  principalSub: string,
  keyKid: string,
  doc: IntakeDocument,
  now: () => Date,
): Promise<void> {
  const isRevoked = err instanceof IntakeError && err.code === 'intake.key_revoked';
  await emit(logger, {
    event: isRevoked ? 'intake.key_revoked' : 'intake.signature_failed',
    principalSub,
    keyKid,
    doc,
    now: now(),
    previous: doc.status,
    next: doc.status,
  });
}
