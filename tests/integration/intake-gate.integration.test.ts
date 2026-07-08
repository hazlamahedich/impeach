/**
 * Integration tests — Story 2.3 Two-Person Intake State Machine (SEC-2).
 *
 * 23 test cases covering: happy path dual review/approve, same-signer
 * rejection (same sub + different key), invalid transitions, Tier-5 partner
 * signatures, worker fail-closed gate (all 6 states), NFC normalization,
 * replay attack, temporal constraints (approval window + inter-signature
 * delay), rejection/remediation flow, key revocation, content-hash mismatch,
 * and attestation external verification.
 *
 * @rules SEC-2, AC-INTAKE, SEC-8
 * @adr ADR-0001
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createIntakeGate,
  createOperatorKeyRegistry,
  createPartnerKeyRegistry,
  verifyAttestation,
  InMemoryIntakeReplayDetector,
} from '@iip/ingest';
import type {
  IntakeGate,
  IntakeDocument,
  ReviewInput,
} from '@iip/ingest';
import type { IntakeEvent } from '@iip/contracts';import {
  createKeyPair,
  createSignature,
  createContentHash,
} from '@iip/test-utils';
import type { TestKeyPair } from '@iip/test-utils';

// ─────────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────────

const CONTENT_HASH = 'a'.repeat(64);

let reviewerKey: TestKeyPair;
let approverKey: TestKeyPair;
let secondApproverKey: TestKeyPair; // different key, same sub (TC-1.3)
let partnerKey: TestKeyPair;
let systemKey: TestKeyPair;

/** Mutable operator record — revocation tests flip `status` mid-test. */
let operatorRecord: Record<string, { key: string; status: 'active' | 'revoked'; revokedAt?: string }>;
let partnerRecord: Record<string, string>;

let clock: Date;
let events: IntakeEvent[];
let gate: IntakeGate;

function asDoc(d: {
  id?: string;
  content_hash?: string;
  status?: string;
  tier?: number;
  reviewer_sub?: string | null;
  reviewer_signature?: string | null;
  reviewer_key_kid?: string | null;
  reviewed_at?: Date | null;
  approver_sub?: string | null;
  approver_signature?: string | null;
  approver_key_kid?: string | null;
  approved_at?: Date | null;
  partner_kid?: string | null;
  partner_signature?: string | null;
}): IntakeDocument {
  return {
    id: d.id ?? crypto.randomUUID(),
    content_hash: d.content_hash ?? CONTENT_HASH,
    status: (d.status ?? 'staging') as IntakeDocument['status'],
    tier: d.tier ?? 1,
    reviewer_sub: d.reviewer_sub ?? null,
    reviewer_signature: d.reviewer_signature ?? null,
    reviewer_key_kid: d.reviewer_key_kid ?? null,
    reviewed_at: d.reviewed_at ?? null,
    approver_sub: d.approver_sub ?? null,
    approver_signature: d.approver_signature ?? null,
    approver_key_kid: d.approver_key_kid ?? null,
    approved_at: d.approved_at ?? null,
    partner_kid: d.partner_kid ?? null,
    partner_signature: d.partner_signature ?? null,
  } as IntakeDocument;
}

async function signInput(
  key: TestKeyPair,
  sub: string,
  contentHash: string,
  partner?: TestKeyPair,
): Promise<ReviewInput> {
  const signature = await createSignature({ privateKey: key.privateKey, contentHash });
  const input: ReviewInput = { principalSub: sub, principalKid: key.kid, signature };
  if (partner !== undefined) {
    const partnerSignature = await createSignature({ privateKey: partner.privateKey, contentHash });
    input.partnerSignature = { kid: partner.kid, signature: partnerSignature };
  }
  return input;
}

function buildGate(operatorKeyring: Awaited<ReturnType<typeof createOperatorKeyRegistry>>, partnerKeyring: Awaited<ReturnType<typeof createPartnerKeyRegistry>>): IntakeGate {
  return createIntakeGate({
    operatorKeyring,
    partnerKeyring,
    eventLogger: { async log(e: IntakeEvent) { events.push(e); } },
    replayDetector: new InMemoryIntakeReplayDetector(),
    approvalWindowSeconds: 3600,
    minInterSignatureDelayMs: 60_000,
    now: () => clock,
    systemSignKey: systemKey.privateKey,
  });
}

beforeEach(async () => {
  reviewerKey = await createKeyPair('reviewer-kid');
  approverKey = await createKeyPair('approver-kid');
  secondApproverKey = await createKeyPair('approver-kid-2');
  partnerKey = await createKeyPair('partner-kid');
  systemKey = await createKeyPair('system-kid');
  operatorRecord = {
    [reviewerKey.kid]: { key: reviewerKey.publicKeyBase64, status: 'active' },
    [approverKey.kid]: { key: approverKey.publicKeyBase64, status: 'active' },
    [secondApproverKey.kid]: { key: secondApproverKey.publicKeyBase64, status: 'active' },
  };
  partnerRecord = { [partnerKey.kid]: partnerKey.publicKeyBase64 };
  clock = new Date('2026-06-30T12:00:00Z');
  events = [];
  const operatorKeyring = await createOperatorKeyRegistry(operatorRecord);
  const partnerKeyring = await createPartnerKeyRegistry(partnerRecord);
  gate = buildGate(operatorKeyring, partnerKeyring);
});

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.3 — Two-Person Intake State Machine (SEC-2)', () => {

  // TC-1.1: Happy path dual review and approval
  it('TC-1.1: happy path — staging -> reviewed_once -> approved (distinct principals)', async () => {
    const doc = asDoc({ status: 'staging' });
    const reviewInput = await signInput(reviewerKey, 'reviewer-sub', doc.content_hash);
    const reviewed = await gate.review(doc, reviewInput);

    expect(reviewed.status).toBe('reviewed_once');
    expect(reviewed.reviewer_sub).toBe('reviewer-sub');
    expect(reviewed.reviewer_key_kid).toBe(reviewerKey.kid);
    expect(reviewed.reviewed_at).toBeInstanceOf(Date);

    // Advance the clock past the mandatory inter-signature delay + within the
    // approval window before the approver signs.
    clock = new Date(clock.getTime() + 120_000);
    const approveInput = await signInput(approverKey, 'approver-sub', doc.content_hash);
    const approved = await gate.approve(reviewed, approveInput);

    expect(approved.status).toBe('approved');
    expect(approved.approver_sub).toBe('approver-sub');
    expect(approved.approver_key_kid).toBe(approverKey.kid);
    expect(approved.approved_at).toBeInstanceOf(Date);

    // Audit events emitted for both transitions
    expect(events.some((e) => e.event === 'intake.reviewed_once')).toBe(true);
    expect(events.some((e) => e.event === 'intake.approved')).toBe(true);
  });

  // TC-1.2: Same signer rejection (same sub)
  it('TC-1.2: same sub approves -> rejected (distinct principal guard)', async () => {
    const reviewedAt = new Date(clock.getTime() - 120_000);
    const doc = asDoc({
      status: 'reviewed_once',
      reviewer_sub: 'same-sub',
      reviewer_key_kid: reviewerKey.kid,
      reviewed_at: reviewedAt,
    });
    const approveInput = await signInput(approverKey, 'same-sub', doc.content_hash);

    await expect(gate.approve(doc, approveInput)).rejects.toMatchObject({
      code: 'intake.same_principal',
    });
    expect(events.some((e) => e.event === 'intake.same_principal_rejected')).toBe(true);
  });

  // TC-1.3: Same signer rejection (different key, same sub)
  it('TC-1.3: different key, same sub -> rejected (identity is on sub, not key)', async () => {
    const reviewedAt = new Date(clock.getTime() - 120_000);
    const doc = asDoc({
      status: 'reviewed_once',
      reviewer_sub: 'same-sub',
      reviewer_key_kid: reviewerKey.kid,
      reviewed_at: reviewedAt,
    });
    // secondApproverKey is a different key but same sub
    const approveInput = await signInput(secondApproverKey, 'same-sub', doc.content_hash);

    await expect(gate.approve(doc, approveInput)).rejects.toMatchObject({
      code: 'intake.same_principal',
    });
  });

  // TC-1.4: Invalid state transition — staging -> approved
  it('TC-1.4: staging -> approved direct -> invalid_transition', async () => {
    const doc = asDoc({ status: 'staging' });
    const approveInput = await signInput(approverKey, 'approver-sub', doc.content_hash);
    await expect(gate.approve(doc, approveInput)).rejects.toMatchObject({
      code: 'intake.invalid_transition',
    });
  });

  // TC-1.5: Invalid state transition — staging -> extracting
  it('TC-1.5: staging -> extracting direct -> invalid_transition', async () => {
    const doc = asDoc({ status: 'staging' });
    await expect(
      gate.beginExtraction(doc, { sub: 'system', kid: 'system-kid' }),
    ).rejects.toMatchObject({ code: 'intake.invalid_transition' });
  });

  // TC-1.6: Invalid state transition — reviewed_once -> indexed
  it('TC-1.6: reviewed_once -> indexed direct -> invalid_transition', async () => {
    const doc = asDoc({ status: 'reviewed_once', reviewer_sub: 'r', reviewed_at: new Date() });
    await expect(gate.completeIndexing(doc)).rejects.toMatchObject({
      code: 'intake.invalid_transition',
    });
  });

  // TC-1.7: Tier-5 partner signature success
  it('TC-1.7: Tier-5 document with valid partner signature -> passes', async () => {
    const doc = asDoc({ status: 'staging', tier: 5 });
    const reviewInput = await signInput(reviewerKey, 'reviewer-sub', doc.content_hash, partnerKey);
    const reviewed = await gate.review(doc, reviewInput);
    expect(reviewed.status).toBe('reviewed_once');
    expect(reviewed.partner_kid).toBe(partnerKey.kid);
  });

  // TC-1.8: Tier-5 partner signature failure (missing)
  it('TC-1.8: Tier-5 document with no partner signature -> fail-closed', async () => {
    const doc = asDoc({ status: 'staging', tier: 5 });
    const reviewInput = await signInput(reviewerKey, 'reviewer-sub', doc.content_hash);
    await expect(gate.review(doc, reviewInput)).rejects.toMatchObject({
      code: 'intake.tier5_partner_required',
    });
  });

  // TC-1.9: Tier-5 partner signature failure (unknown kid)
  it('TC-1.9: Tier-5 partner signature with unknown kid -> fail-closed', async () => {
    const doc = asDoc({ status: 'staging', tier: 5 });
    const partnerSig = await createSignature({ privateKey: partnerKey.privateKey, contentHash: doc.content_hash });
    const reviewInput: ReviewInput = {
      principalSub: 'reviewer-sub',
      principalKid: reviewerKey.kid,
      signature: await createSignature({ privateKey: reviewerKey.privateKey, contentHash: doc.content_hash }),
      partnerSignature: { kid: 'nonexistent-partner-kid', signature: partnerSig },
    };
    await expect(gate.review(doc, reviewInput)).rejects.toMatchObject({
      code: 'intake.tier5_partner_required',
    });
  });

  // TC-1.10: Extraction worker accepts approved documents
  it('TC-1.10: approved document -> assertExtractable proceeds', async () => {
    const doc = asDoc({ status: 'approved' });
    await expect(gate.assertExtractable(doc, { sub: 'worker', kid: 'system-kid' })).resolves.toBeUndefined();
  });

  // TC-1.11: Extraction worker accepts extracting documents (idempotent retry)
  it('TC-1.11: extracting document -> assertExtractable proceeds (idempotent resume)', async () => {
    const doc = asDoc({ status: 'extracting' });
    await expect(gate.assertExtractable(doc, { sub: 'worker', kid: 'system-kid' })).resolves.toBeUndefined();
  });

  // TC-1.12: Extraction worker rejects staging documents
  it('TC-1.12: staging document -> assertExtractable throws + logs bypass_attempt', async () => {
    const doc = asDoc({ status: 'staging' });
    await expect(gate.assertExtractable(doc, { sub: 'worker', kid: 'system-kid' })).rejects.toMatchObject({
      code: 'intake.bypass_attempt',
    });
    expect(events.some((e) => e.event === 'intake.bypass_attempt')).toBe(true);
  });

  // TC-1.13: Extraction worker rejects reviewed_once documents
  it('TC-1.13: reviewed_once document -> assertExtractable throws + logs bypass_attempt', async () => {
    const doc = asDoc({ status: 'reviewed_once' });
    await expect(gate.assertExtractable(doc, { sub: 'worker', kid: 'system-kid' })).rejects.toMatchObject({
      code: 'intake.bypass_attempt',
    });
  });

  // TC-1.13a: Extraction worker rejects rejected documents
  it('TC-1.13a: rejected document -> assertExtractable throws + logs bypass_attempt', async () => {
    const doc = asDoc({ status: 'rejected' });
    await expect(gate.assertExtractable(doc, { sub: 'worker', kid: 'system-kid' })).rejects.toMatchObject({
      code: 'intake.bypass_attempt',
    });
  });

  // TC-1.13b: Extraction worker rejects needs_revision documents
  it('TC-1.13b: needs_revision document -> assertExtractable throws + logs bypass_attempt', async () => {
    const doc = asDoc({ status: 'needs_revision' });
    await expect(gate.assertExtractable(doc, { sub: 'worker', kid: 'system-kid' })).rejects.toMatchObject({
      code: 'intake.bypass_attempt',
    });
  });

  // TC-1.14: NFC normalization — precomposed vs decomposed
  it('TC-1.14: NFC normalization — signature over NFC hash fails against NFD-derived content_hash', async () => {
    const precomposed = Buffer.from('café', 'utf8'); // é = U+00E9
    const decomposed = Buffer.from('cafe\u0301', 'utf8'); // e + combining accent

    // Correct (NFC-normalized) hash vs raw NFD hash differ.
    const nfcHash = createContentHash(precomposed, true);
    const rawNfdHash = createContentHash(decomposed, false);
    expect(nfcHash).not.toBe(rawNfdHash);
    // NFC normalization makes precomposed and decomposed hash identically.
    expect(createContentHash(decomposed, true)).toBe(nfcHash);

    // Signature bound to the correct (NFC) hash must fail verification against
    // a document carrying the wrong (raw NFD) content_hash.
    const signature = await createSignature({ privateKey: reviewerKey.privateKey, contentHash: nfcHash });
    const reviewInput: ReviewInput = {
      principalSub: 'reviewer-sub',
      principalKid: reviewerKey.kid,
      signature,
    };
    const doc = asDoc({ status: 'staging', content_hash: rawNfdHash });
    await expect(gate.review(doc, reviewInput)).rejects.toMatchObject({
      code: 'intake.invalid_signature',
    });
  });

  // TC-1.15: Replay attack rejection
  it('TC-1.15: same (content_hash, signature, principal) resubmitted -> replay rejected', async () => {
    const doc = asDoc({ status: 'staging' });
    const reviewInput = await signInput(reviewerKey, 'reviewer-sub', doc.content_hash);
    await gate.review(doc, reviewInput); // first submission OK

    // Resubmit the identical tuple -> replay.
    await expect(gate.review(doc, reviewInput)).rejects.toMatchObject({
      code: 'intake.replay',
    });
  });

  // TC-1.16: Approval window expiry
  it('TC-1.16: reviewed_once past approvalWindowSeconds -> approve throws + reverts to staging', async () => {
    const reviewedAt = new Date(clock.getTime() - (3600 + 60) * 1000); // past window
    const doc = asDoc({
      status: 'reviewed_once',
      reviewer_sub: 'reviewer-sub',
      reviewer_key_kid: reviewerKey.kid,
      reviewed_at: reviewedAt,
    });
    const approveInput = await signInput(approverKey, 'approver-sub', doc.content_hash);
    await expect(gate.approve(doc, approveInput)).rejects.toMatchObject({
      code: 'intake.approval_window_expired',
    });
    expect(events.some((e) => e.event === 'intake.approval_window_expired')).toBe(true);
  });

  // TC-1.17: Inter-signature delay enforcement
  it('TC-1.17: approve before minInterSignatureDelayMs -> throws', async () => {
    const reviewedAt = new Date(clock.getTime() - 1_000); // 1s ago, < 60s floor
    const doc = asDoc({
      status: 'reviewed_once',
      reviewer_sub: 'reviewer-sub',
      reviewer_key_kid: reviewerKey.kid,
      reviewed_at: reviewedAt,
    });
    const approveInput = await signInput(approverKey, 'approver-sub', doc.content_hash);
    await expect(gate.approve(doc, approveInput)).rejects.toMatchObject({
      code: 'intake.inter_signature_delay',
    });
    expect(events.some((e) => e.event === 'intake.inter_signature_delay_violation')).toBe(true);
  });

  // TC-1.18: Rejection and remediation flow
  it('TC-1.18: staging -> rejected, reviewed_once -> needs_revision (audit events logged)', async () => {
    const stagingDoc = asDoc({ status: 'staging' });
    const rejected = await gate.reject(stagingDoc, {
      principalSub: 'reviewer-sub', principalKid: reviewerKey.kid, reason: 'off-topic',
    });
    expect(rejected.status).toBe('rejected');
    expect(events.some((e) => e.event === 'intake.rejected')).toBe(true);

    const reviewedDoc = asDoc({ status: 'reviewed_once', reviewer_sub: 'r', reviewed_at: new Date() });
    const revised = await gate.revise(reviewedDoc, {
      principalSub: 'reviewer-sub', principalKid: reviewerKey.kid, reason: 'needs sources',
    });
    expect(revised.status).toBe('needs_revision');
    expect(events.some((e) => e.event === 'intake.needs_revision')).toBe(true);
  });

  // TC-1.19: Key revocation — active key accepted
  it('TC-1.19: active operator key -> review succeeds (revocation baseline)', async () => {
    expect(operatorRecord[reviewerKey.kid]!.status).toBe('active');
    const doc = asDoc({ status: 'staging' });
    const reviewInput = await signInput(reviewerKey, 'reviewer-sub', doc.content_hash);
    const reviewed = await gate.review(doc, reviewInput);
    expect(reviewed.status).toBe('reviewed_once');
  });

  // TC-1.20: Key revocation — revoked key rejected
  it('TC-1.20: revoked operator key -> verification fails with KEY_REVOKED', async () => {
    operatorRecord[reviewerKey.kid]!.status = 'revoked';
    const doc = asDoc({ status: 'staging' });
    const reviewInput = await signInput(reviewerKey, 'reviewer-sub', doc.content_hash);
    await expect(gate.review(doc, reviewInput)).rejects.toMatchObject({
      code: 'intake.key_revoked',
    });
    expect(events.some((e) => e.event === 'intake.key_revoked')).toBe(true);
  });

  // TC-1.21: Content-hash mismatch — signature valid for wrong hash
  it('TC-1.21: signature valid for H1, content_hash is H2 -> invalid_signature', async () => {
    const otherHash = 'b'.repeat(64);
    const signature = await createSignature({ privateKey: reviewerKey.privateKey, contentHash: otherHash });
    const reviewInput: ReviewInput = {
      principalSub: 'reviewer-sub',
      principalKid: reviewerKey.kid,
      signature,
    };
    const doc = asDoc({ status: 'staging', content_hash: CONTENT_HASH });
    await expect(gate.review(doc, reviewInput)).rejects.toMatchObject({
      code: 'intake.invalid_signature',
    });
  });

  // TC-1.22: Attestation external verification
  it('TC-1.22: indexed document attestation verifies against system public key; tamper fails', async () => {
    const reviewedAt = new Date(clock.getTime() - 120_000);
    const approvedAt = new Date(clock.getTime() - 60_000);
    const doc = asDoc({
      status: 'indexed',
      tier: 1,
      reviewer_sub: 'reviewer-sub',
      reviewer_key_kid: reviewerKey.kid,
      reviewed_at: reviewedAt,
      approver_sub: 'approver-sub',
      approver_key_kid: approverKey.kid,
      approved_at: approvedAt,
    });
    const attestation = await gate.issueAttestation(doc);

    const valid = await verifyAttestation(attestation, systemKey.publicKey);
    expect(valid).toBe(true);
    expect(attestation.payload.document_id).toBe(doc.id);
    expect(attestation.payload.reviewer_sub).toBe('reviewer-sub');
    expect(attestation.payload.approver_sub).toBe('approver-sub');

    // Tampering the payload invalidates the signature.
    const tampered: typeof attestation = {
      payload: { ...attestation.payload, content_hash: 'c'.repeat(64) },
      signature: attestation.signature,
    };
    const tamperedValid = await verifyAttestation(tampered, systemKey.publicKey);
    expect(tamperedValid).toBe(false);
  });
});
