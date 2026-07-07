/**
 * Co-located mutation test suite for the intake gate (SEC-2, DoD-2).
 *
 * Drives Stryker mutation testing of `src/gate/state.ts`, `src/crypto/verify.ts`,
 * and `src/attestation.ts`. Mirrors the repo convention (render/auth run Stryker
 * against co-located tests). The formal story TCs live in tests/integration
 * and tests/contract; this file is the comprehensive Stryker driver covering
 * every transition, error path, and the 10 mutation target categories
 * (TC-3.1..TC-3.10) plus the crypto/attestation branches.
 *
 * @rules SEC-2, SEC-8, DoD-2
 * @adr ADR-0001
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createKeyPair, createSignature } from '@iip/test-utils';
import type { TestKeyPair } from '@iip/test-utils';
import { IntakeError, InMemoryIntakeReplayDetector } from './types.js';
import type { IntakeDocument, IntakeGate, ReviewInput } from './types.js';
import { createIntakeGate } from './gate/state.js';
import { createOperatorKeyRegistry, createPartnerKeyRegistry, verifyPartnerSignature } from './crypto/verify.js';
import {
  verifyAttestation,
  signAttestation,
  canonicalize,
} from './attestation.js';

const HASH = 'a'.repeat(64);
let reviewerKey: TestKeyPair;
let approverKey: TestKeyPair;
let altApproverKey: TestKeyPair;
let partnerKey: TestKeyPair;
let systemKey: TestKeyPair;
let operatorRecord: Record<string, { key: string; status: 'active' | 'revoked' }>;
let partnerRecord: Record<string, string>;
let clock: Date;
let events: { event: string; reason?: string }[];
let gate: IntakeGate;

function asDoc(overrides: Partial<Omit<IntakeDocument, 'status'>> & { status?: string } = {}): IntakeDocument {
  const { status, ...rest } = overrides;
  return {
    id: crypto.randomUUID(),
    content_hash: HASH,
    status: (status ?? 'staging') as IntakeDocument['status'],
    tier: 1,
    reviewer_sub: null,
    reviewer_signature: null,
    reviewer_key_kid: null,
    reviewed_at: null,
    approver_sub: null,
    approver_signature: null,
    approver_key_kid: null,
    approved_at: null,
    partner_kid: null,
    partner_signature: null,
    ...rest,
  } as IntakeDocument;
}

async function sig(key: TestKeyPair, hash = HASH): Promise<string> {
  return createSignature({ privateKey: key.privateKey, contentHash: hash });
}

async function buildGate(): Promise<IntakeGate> {
  return createIntakeGate({
    operatorKeyring: await createOperatorKeyRegistry(operatorRecord),
    partnerKeyring: await createPartnerKeyRegistry(partnerRecord),
    eventLogger: { async log(e) { events.push({ event: e.event, ...(e.reason !== undefined ? { reason: e.reason } : {}) }); } },
    replayDetector: new InMemoryIntakeReplayDetector(),
    approvalWindowSeconds: 3600,
    minInterSignatureDelayMs: 60_000,
    now: () => clock,
    systemSignKey: systemKey.privateKey,
  });
}

/** Produce a doc already in `reviewed_once` (reviewer signed, elapsed delay). */
function reviewedDoc(overrides: Partial<IntakeDocument> = {}): IntakeDocument {
  return asDoc({
    status: 'reviewed_once',
    reviewer_sub: 'rev',
    reviewer_key_kid: reviewerKey.kid,
    reviewed_at: new Date(clock.getTime() - 120_000),
    ...overrides,
  });
}

beforeEach(async () => {
  reviewerKey = await createKeyPair('r');
  approverKey = await createKeyPair('a');
  altApproverKey = await createKeyPair('a2');
  partnerKey = await createKeyPair('p');
  systemKey = await createKeyPair('sys');
  operatorRecord = {
    [reviewerKey.kid]: { key: reviewerKey.publicKeyBase64, status: 'active' },
    [approverKey.kid]: { key: approverKey.publicKeyBase64, status: 'active' },
    [altApproverKey.kid]: { key: altApproverKey.publicKeyBase64, status: 'active' },
  };
  partnerRecord = { [partnerKey.kid]: partnerKey.publicKeyBase64 };
  clock = new Date('2026-06-30T12:00:00Z');
  events = [];
  gate = await buildGate();
});

describe('intake gate — mutation drivers (SEC-2)', () => {

  // ── review ──
  it('review happy path emits reviewed_once', async () => {
    const reviewed = await gate.review(asDoc(), {
      principalSub: 'rev', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
    });
    expect(reviewed.status).toBe('reviewed_once');
    expect(reviewed.reviewer_key_kid).toBe(reviewerKey.kid);
    expect(events.at(-1)?.event).toBe('intake.reviewed_once');
  });

  it('review invalid signature -> signature_failed event + throw', async () => {
    // Sign with approverKey but claim reviewer's kid -> signature won't verify.
    await expect(gate.review(asDoc(), {
      principalSub: 'rev', principalKid: reviewerKey.kid, signature: await sig(approverKey),
    })).rejects.toMatchObject({ code: 'intake.invalid_signature' });
    expect(events.some((e) => e.event === 'intake.signature_failed')).toBe(true);
  });

  it('review unknown kid -> invalid_signature', async () => {
    await expect(gate.review(asDoc(), {
      principalSub: 'rev', principalKid: 'missing-kid', signature: 'x',
    })).rejects.toMatchObject({ code: 'intake.invalid_signature' });
  });

  it('review wrong-state (reviewed_once) -> invalid_transition', async () => {
    await expect(gate.review(reviewedDoc(), {
      principalSub: 'rev', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
    })).rejects.toMatchObject({ code: 'intake.invalid_transition' });
    expect(events.some((e) => e.event === 'intake.invalid_transition')).toBe(true);
  });

  it('review replay -> replay', async () => {
    const input = { principalSub: 'rev', principalKid: reviewerKey.kid, signature: await sig(reviewerKey) };
    await gate.review(asDoc(), input);
    await expect(gate.review(asDoc(), input)).rejects.toMatchObject({ code: 'intake.replay' });
  });

  // ── Tier-5 partner ──
  it('tier-5 missing partner -> tier5_partner_required', async () => {
    await expect(gate.review(asDoc({ tier: 5 }), {
      principalSub: 'rev', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
    })).rejects.toMatchObject({ code: 'intake.tier5_partner_required' });
    expect(events.some((e) => e.event === 'intake.signature_failed')).toBe(true);
  });

  it('tier-5 unknown partner kid -> tier5_partner_required', async () => {
    await expect(gate.review(asDoc({ tier: 5 }), {
      principalSub: 'rev', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
      partnerSignature: { kid: 'nope', signature: await sig(partnerKey) },
    })).rejects.toMatchObject({ code: 'intake.tier5_partner_required' });
  });

  it('tier-5 bad partner signature -> tier5_partner_required', async () => {
    await expect(gate.review(asDoc({ tier: 5 }), {
      principalSub: 'rev', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
      partnerSignature: { kid: partnerKey.kid, signature: await sig(reviewerKey) },
    })).rejects.toMatchObject({ code: 'intake.tier5_partner_required' });
  });

  it('tier-5 valid partner -> reviewed_once with partner_kid', async () => {
    const reviewed = await gate.review(asDoc({ tier: 5 }), {
      principalSub: 'rev', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
      partnerSignature: { kid: partnerKey.kid, signature: await sig(partnerKey) },
    });
    expect(reviewed.status).toBe('reviewed_once');
    expect(reviewed.partner_kid).toBe(partnerKey.kid);
  });

  // ── approve ──
  it('approve happy path emits approved', async () => {
    const approved = await gate.approve(reviewedDoc(), {
      principalSub: 'app', principalKid: approverKey.kid, signature: await sig(approverKey),
    });
    expect(approved.status).toBe('approved');
    expect(approved.approver_key_kid).toBe(approverKey.kid);
    expect(events.at(-1)?.event).toBe('intake.approved');
  });

  it('approve same principal (diff key, same sub) -> same_principal', async () => {
    await expect(gate.approve(reviewedDoc({ reviewer_sub: 'same' }), {
      principalSub: 'same', principalKid: altApproverKey.kid, signature: await sig(altApproverKey),
    })).rejects.toMatchObject({ code: 'intake.same_principal' });
    expect(events.some((e) => e.event === 'intake.same_principal_rejected')).toBe(true);
  });

  it('approve invalid signature -> signature_failed', async () => {
    // Sign with reviewerKey but claim approver's kid -> won't verify.
    await expect(gate.approve(reviewedDoc(), {
      principalSub: 'app', principalKid: approverKey.kid, signature: await sig(reviewerKey),
    })).rejects.toMatchObject({ code: 'intake.invalid_signature' });
  });

  it('approve from wrong state -> invalid_transition', async () => {
    await expect(gate.approve(asDoc({ status: 'staging' }), {
      principalSub: 'app', principalKid: approverKey.kid, signature: await sig(approverKey),
    })).rejects.toMatchObject({ code: 'intake.invalid_transition' });
  });

  it('approve window expired -> approval_window_expired', async () => {
    await expect(gate.approve(reviewedDoc({ reviewed_at: new Date(clock.getTime() - 4_000_000) }), {
      principalSub: 'app', principalKid: approverKey.kid, signature: await sig(approverKey),
    })).rejects.toMatchObject({ code: 'intake.approval_window_expired' });
    expect(events.some((e) => e.event === 'intake.approval_window_expired')).toBe(true);
  });

  it('approve inter-signature delay -> inter_signature_delay', async () => {
    await expect(gate.approve(reviewedDoc({ reviewed_at: new Date(clock.getTime() - 1_000) }), {
      principalSub: 'app', principalKid: approverKey.kid, signature: await sig(approverKey),
    })).rejects.toMatchObject({ code: 'intake.inter_signature_delay' });
    expect(events.some((e) => e.event === 'intake.inter_signature_delay_violation')).toBe(true);
  });

  it('approve replay -> replay', async () => {
    const input = { principalSub: 'app', principalKid: approverKey.kid, signature: await sig(approverKey) };
    await gate.approve(reviewedDoc(), input);
    await expect(gate.approve(reviewedDoc(), input)).rejects.toMatchObject({ code: 'intake.replay' });
  });

  it('approve tier-5 missing partner -> tier5_partner_required', async () => {
    await expect(gate.approve(reviewedDoc({ tier: 5 }), {
      principalSub: 'app', principalKid: approverKey.kid, signature: await sig(approverKey),
    })).rejects.toMatchObject({ code: 'intake.tier5_partner_required' });
  });

  it('approve tier-5 valid partner -> approved', async () => {
    const approved = await gate.approve(reviewedDoc({ tier: 5 }), {
      principalSub: 'app', principalKid: approverKey.kid, signature: await sig(approverKey),
      partnerSignature: { kid: partnerKey.kid, signature: await sig(partnerKey) },
    });
    expect(approved.status).toBe('approved');
  });

  it('approve missing reviewed_at -> invalid_transition', async () => {
    await expect(gate.approve(asDoc({ status: 'reviewed_once', reviewed_at: null }), {
      principalSub: 'app', principalKid: approverKey.kid, signature: await sig(approverKey),
    })).rejects.toMatchObject({ code: 'intake.invalid_transition' });
  });

  // ── reject / revise ──
  it('reject from staging -> rejected with reason', async () => {
    const rejected = await gate.reject(asDoc(), {
      principalSub: 'rev', principalKid: reviewerKey.kid, reason: 'off-topic',
    });
    expect(rejected.status).toBe('rejected');
    expect(events.at(-1)?.event).toBe('intake.rejected');
    expect(events.at(-1)?.reason).toBe('off-topic');
  });

  it('reject from reviewed_once -> rejected', async () => {
    const rejected = await gate.reject(reviewedDoc(), {
      principalSub: 'rev', principalKid: reviewerKey.kid, reason: 'x',
    });
    expect(rejected.status).toBe('rejected');
  });

  it('reject from approved -> invalid_transition', async () => {
    await expect(gate.reject(asDoc({ status: 'approved' }), {
      principalSub: 'rev', principalKid: reviewerKey.kid, reason: 'x',
    })).rejects.toMatchObject({ code: 'intake.invalid_transition' });
  });

  it('revise from reviewed_once -> needs_revision', async () => {
    const revised = await gate.revise(reviewedDoc(), {
      principalSub: 'rev', principalKid: reviewerKey.kid, reason: 'sources',
    });
    expect(revised.status).toBe('needs_revision');
    expect(events.at(-1)?.event).toBe('intake.needs_revision');
  });

  it('revise from staging -> invalid_transition', async () => {
    await expect(gate.revise(asDoc(), {
      principalSub: 'rev', principalKid: reviewerKey.kid, reason: 'x',
    })).rejects.toMatchObject({ code: 'intake.invalid_transition' });
  });

  // ── worker gate ──
  it('assertExtractable rejects each non-extractable state', async () => {
    for (const status of ['staging', 'reviewed_once', 'rejected', 'needs_revision', 'indexed']) {
      await expect(gate.assertExtractable(asDoc({ status: status as IntakeDocument['status'] }), { sub: 'w', kid: 'w' }))
        .rejects.toMatchObject({ code: 'intake.bypass_attempt' });
    }
  });

  it('assertExtractable accepts approved + extracting', async () => {
    await expect(gate.assertExtractable(asDoc({ status: 'approved' }), { sub: 'w', kid: 'w' })).resolves.toBeUndefined();
    await expect(gate.assertExtractable(asDoc({ status: 'extracting' }), { sub: 'w', kid: 'w' })).resolves.toBeUndefined();
  });

  // ── beginExtraction / completeIndexing ──
  it('beginExtraction approved -> extracting', async () => {
    const ext = await gate.beginExtraction(asDoc({ status: 'approved' }), { sub: 'w', kid: 'w' });
    expect(ext.status).toBe('extracting');
    expect(events.at(-1)?.event).toBe('intake.extracting');
  });

  it('beginExtraction from extracting -> invalid_transition', async () => {
    await expect(gate.beginExtraction(asDoc({ status: 'extracting' }), { sub: 'w', kid: 'w' }))
      .rejects.toMatchObject({ code: 'intake.invalid_transition' });
  });

  it('completeIndexing extracting -> indexed', async () => {
    const indexed = await gate.completeIndexing(asDoc({ status: 'extracting' }));
    expect(indexed.status).toBe('indexed');
    expect(events.at(-1)?.event).toBe('intake.indexed');
  });

  it('completeIndexing from approved -> invalid_transition', async () => {
    await expect(gate.completeIndexing(asDoc({ status: 'approved' })))
      .rejects.toMatchObject({ code: 'intake.invalid_transition' });
  });

  // ── key revocation ──
  it('revoked reviewer key -> key_revoked event (distinct from invalid)', async () => {
    operatorRecord[reviewerKey.kid]!.status = 'revoked';
    await expect(gate.review(asDoc(), {
      principalSub: 'rev', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
    })).rejects.toMatchObject({ code: 'intake.key_revoked' });
    expect(events.some((e) => e.event === 'intake.key_revoked')).toBe(true);
  });

  it('revoked approver key -> key_revoked', async () => {
    operatorRecord[approverKey.kid]!.status = 'revoked';
    await expect(gate.approve(reviewedDoc(), {
      principalSub: 'app', principalKid: approverKey.kid, signature: await sig(approverKey),
    })).rejects.toMatchObject({ code: 'intake.key_revoked' });
  });

  // ── content-hash mismatch ──
  it('review signature over wrong hash -> invalid_signature', async () => {
    await expect(gate.review(asDoc(), {
      principalSub: 'rev', principalKid: reviewerKey.kid, signature: await sig(reviewerKey, 'b'.repeat(64)),
    })).rejects.toMatchObject({ code: 'intake.invalid_signature' });
  });

  // ── attestation ──
  it('attestation verifies + tamper fails', async () => {
    const doc = asDoc({
      status: 'indexed', reviewer_sub: 'rev', reviewer_key_kid: reviewerKey.kid,
      reviewed_at: new Date(clock.getTime() - 120_000),
      approver_sub: 'app', approver_key_kid: approverKey.kid,
      approved_at: new Date(clock.getTime() - 60_000),
      partner_kid: partnerKey.kid,
    });
    const att = await gate.issueAttestation(doc);
    expect(await verifyAttestation(att, systemKey.publicKey)).toBe(true);
    expect(att.payload.partner_kid).toBe(partnerKey.kid);
    const tampered = { payload: { ...att.payload, content_hash: 'c'.repeat(64) as IntakeDocument['content_hash'] }, signature: att.signature };
    expect(await verifyAttestation(tampered, systemKey.publicKey)).toBe(false);
  });

  it('attestation with null dates verifies', async () => {
    const att = await gate.issueAttestation(asDoc({ status: 'indexed' }));
    expect(await verifyAttestation(att, systemKey.publicKey)).toBe(true);
  });

  it('signAttestation + verifyAttestation roundtrip', async () => {
    const payload = { document_id: 'd', content_hash: 'h' as IntakeDocument['content_hash'], reviewer_sub: null, reviewer_key_kid: null, approver_sub: null, approver_key_kid: null, reviewed_at: null, approved_at: null, partner_kid: null };
    const signed = await signAttestation(payload, systemKey.privateKey);
    expect(await verifyAttestation(signed, systemKey.publicKey)).toBe(true);
  });

  // ── canonicalize ──
  it('canonicalize: object keys sorted, arrays preserved, primitives', () => {
    expect(canonicalize({ b: 1, a: { y: 2, x: 1 } })).toBe('{"a":{"x":1,"y":2},"b":1}');
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalize([{ b: 1, a: 0 }])).toBe('[{"a":0,"b":1}]');
    expect(canonicalize('s')).toBe('"s"');
    expect(canonicalize(null)).toBe('null');
    expect(canonicalize(42)).toBe('42');
  });

  // ── logger resilience ──
  it('a throwing eventLogger does not block the transition', async () => {
    const resilientGate = createIntakeGate({
      operatorKeyring: await createOperatorKeyRegistry(operatorRecord),
      partnerKeyring: await createPartnerKeyRegistry(partnerRecord),
      eventLogger: { async log() { throw new Error('log down'); } },
      replayDetector: new InMemoryIntakeReplayDetector(),
      approvalWindowSeconds: 3600,
      minInterSignatureDelayMs: 60_000,
      now: () => clock,
      systemSignKey: systemKey.privateKey,
    });
    const reviewed = await resilientGate.review(asDoc(), {
      principalSub: 'rev', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
    });
    expect(reviewed.status).toBe('reviewed_once');
  });

  it('IntakeError code surface is the closed set', () => {
    const codes = [
      'intake.invalid_signature', 'intake.key_revoked', 'intake.invalid_transition',
      'intake.same_principal', 'intake.signature_failed', 'intake.approval_window_expired',
      'intake.inter_signature_delay', 'intake.bypass_attempt', 'intake.replay',
      'intake.tier5_partner_required', 'intake.unknown_kid',
    ];
    for (const code of codes) {
      const e = new IntakeError('m', code as IntakeError['code']);
      expect(e.code).toBe(code);
      expect(e).toBeInstanceOf(Error);
    }
  });

  it('partner verify success path covered (reviewInput partnerSignature)', async () => {
    const input: ReviewInput = {
      principalSub: 'rev', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
      partnerSignature: { kid: partnerKey.kid, signature: await sig(partnerKey) },
    };
    const reviewed = await gate.review(asDoc({ tier: 5 }), input);
    expect(reviewed.partner_signature).toBeTruthy();
  });

  // ── boundary + tier-5 approve coverage (kill EqualityOperator + NoCoverage) ──
  it('approve at EXACTLY approvalWindowSeconds boundary -> succeeds (> not >=)', async () => {
    clock = new Date(clock.getTime() + 3_600_000);
    const reviewed = reviewedDoc({ reviewed_at: new Date(clock.getTime() - 3_600_000) });
    const approved = await gate.approve(reviewed, {
      principalSub: 'app', principalKid: approverKey.kid, signature: await sig(approverKey),
    });
    expect(approved.status).toBe('approved');
  });

  it('approve at EXACTLY minInterSignatureDelay boundary -> succeeds (< not <=)', async () => {
    const reviewed = reviewedDoc({ reviewed_at: new Date(clock.getTime() - 60_000) });
    const approved = await gate.approve(reviewed, {
      principalSub: 'app', principalKid: approverKey.kid, signature: await sig(approverKey),
    });
    expect(approved.status).toBe('approved');
  });

  it('approve tier-5 bad partner signature -> tier5_partner_required (covers approve catch)', async () => {
    await expect(gate.approve(reviewedDoc({ tier: 5 }), {
      principalSub: 'app', principalKid: approverKey.kid, signature: await sig(approverKey),
      partnerSignature: { kid: partnerKey.kid, signature: await sig(reviewerKey) },
    })).rejects.toMatchObject({ code: 'intake.tier5_partner_required' });
  });

  // ── attestation payload values (kill buildPayload ternary mutants) ──
  it('attestation payload carries ISO date strings for set dates', async () => {
    const revAt = new Date(clock.getTime() - 120_000);
    const appAt = new Date(clock.getTime() - 60_000);
    const doc = asDoc({
      status: 'indexed', reviewer_sub: 'rev', reviewer_key_kid: reviewerKey.kid,
      reviewed_at: revAt, approver_sub: 'app', approver_key_kid: approverKey.kid,
      approved_at: appAt, partner_kid: partnerKey.kid,
    });
    const att = await gate.issueAttestation(doc);
    expect(att.payload.reviewed_at).toBe(revAt.toISOString());
    expect(att.payload.approved_at).toBe(appAt.toISOString());
    expect(att.payload.partner_kid).toBe(partnerKey.kid);
    expect(att.payload.reviewer_key_kid).toBe(reviewerKey.kid);
    expect(att.payload.approver_key_kid).toBe(approverKey.kid);
  });

  // ── error message + event-name sweep (kill StringLiteral mutants) ──
  it('each error path throws a message carrying its distinguishing keyword', async () => {
    const cases: Array<[() => Promise<unknown>, RegExp]> = [
      [async () => gate.review(asDoc({ status: 'reviewed_once' }), {
        principalSub: 'r', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
      }), /invalid transition/i],
      [async () => gate.approve(asDoc({ status: 'staging' }), {
        principalSub: 'a', principalKid: approverKey.kid, signature: await sig(approverKey),
      }), /invalid transition/i],
      [async () => gate.completeIndexing(asDoc({ status: 'approved' })), /invalid transition/i],
      [async () => gate.beginExtraction(asDoc({ status: 'extracting' }), { sub: 'w', kid: 'w' }), /invalid transition/i],
      [async () => gate.assertExtractable(asDoc({ status: 'staging' }), { sub: 'w', kid: 'w' }), /extraction requires/i],
      [async () => gate.approve(reviewedDoc({ reviewer_sub: 'same' }), {
        principalSub: 'same', principalKid: approverKey.kid, signature: await sig(approverKey),
      }), /differ from reviewer/i],
      [async () => gate.approve(reviewedDoc({ reviewed_at: new Date(clock.getTime() - 9_000_000) }), {
        principalSub: 'a', principalKid: approverKey.kid, signature: await sig(approverKey),
      }), /approval window expired/i],
      [async () => gate.approve(reviewedDoc({ reviewed_at: new Date(clock.getTime() - 1_000) }), {
        principalSub: 'a', principalKid: approverKey.kid, signature: await sig(approverKey),
      }), /inter-signature delay/i],
    ];
    for (const [thunk, re] of cases) {
      await expect(thunk()).rejects.toThrow(re);
    }
  });

  it('revocation + unknown-key + invalid-sig messages carry keywords', async () => {
    operatorRecord[reviewerKey.kid]!.status = 'revoked';
    await expect(gate.review(asDoc(), {
      principalSub: 'r', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
    })).rejects.toThrow(/revoked/i);
    operatorRecord[reviewerKey.kid]!.status = 'active';

    await expect(gate.review(asDoc(), {
      principalSub: 'r', principalKid: 'unknown', signature: 'x',
    })).rejects.toThrow(/unknown operator key|invalid/i);

    // Sign with approverKey but claim reviewer's kid -> invalid operator signature.
    await expect(gate.review(asDoc(), {
      principalSub: 'r', principalKid: reviewerKey.kid, signature: await sig(approverKey),
    })).rejects.toThrow(/invalid operator signature/i);
  });

  it('replay error messages carry keyword for review + approve', async () => {
    const rInput = { principalSub: 'r', principalKid: reviewerKey.kid, signature: await sig(reviewerKey) };
    await gate.review(asDoc(), rInput);
    await expect(gate.review(asDoc(), rInput)).rejects.toThrow(/replay/i);
    const aInput = { principalSub: 'a', principalKid: approverKey.kid, signature: await sig(approverKey) };
    await gate.approve(reviewedDoc(), aInput);
    await expect(gate.approve(reviewedDoc(), aInput)).rejects.toThrow(/replay/i);
  });

  it('tier-5 error messages carry keyword (review + approve)', async () => {
    await expect(gate.review(asDoc({ tier: 5 }), {
      principalSub: 'r', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
    })).rejects.toThrow(/tier-5/i);
    await expect(gate.approve(reviewedDoc({ tier: 5 }), {
      principalSub: 'a', principalKid: approverKey.kid, signature: await sig(approverKey),
    })).rejects.toThrow(/tier-5/i);
  });

  it('every successful transition emits its canonical event name', async () => {
    events = [];
    const reviewed = await gate.review(asDoc(), {
      principalSub: 'r', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
    });
    expect(events.some((e) => e.event === 'intake.reviewed_once')).toBe(true);

    events = [];
    await gate.reject(asDoc({ status: 'staging' }), { principalSub: 'r', principalKid: reviewerKey.kid, reason: 'x' });
    expect(events.some((e) => e.event === 'intake.rejected')).toBe(true);

    events = [];
    await gate.revise(reviewed, { principalSub: 'r', principalKid: reviewerKey.kid, reason: 'x' });
    expect(events.some((e) => e.event === 'intake.needs_revision')).toBe(true);

    events = [];
    const ext = await gate.beginExtraction(asDoc({ status: 'approved' }), { sub: 'w', kid: 'w' });
    expect(events.some((e) => e.event === 'intake.extracting')).toBe(true);

    events = [];
    await gate.completeIndexing(ext);
    expect(events.some((e) => e.event === 'intake.indexed')).toBe(true);
  });

  // ── direct crypto verification messages (kill verify.ts StringLiteral mutants) ──
  it('verifyPartnerSignature surfaces unknown-key + invalid-signature messages', async () => {
    const partnerKeyring = await createPartnerKeyRegistry(partnerRecord);
    await expect(verifyPartnerSignature(partnerKeyring, 'nope', 'x', HASH))
      .rejects.toThrow(/unknown partner key/i);
    // Valid kid but signature produced by a different key -> invalid.
    const badSig = await sig(reviewerKey);
    await expect(verifyPartnerSignature(partnerKeyring, partnerKey.kid, badSig, HASH))
      .rejects.toThrow(/invalid partner signature/i);
  });

  // ── emit reason strings (kill state.ts reason-field StringLiteral mutants) ──
  it('failure events carry their canonical reason strings', async () => {
    // tier-5 partner missing (review) — operator reviewerKey
    await gate.review(asDoc({ tier: 5 }), {
      principalSub: 'r1', principalKid: reviewerKey.kid, signature: await sig(reviewerKey),
    }).catch(() => {});
    expect(events.find((e) => e.event === 'intake.signature_failed')?.reason).toBe('tier-5 partner signature missing');

    events = [];
    // tier-5 partner invalid (review) — distinct operator (approverKey) to avoid replay
    await gate.review(asDoc({ tier: 5 }), {
      principalSub: 'r2', principalKid: approverKey.kid, signature: await sig(approverKey),
      partnerSignature: { kid: partnerKey.kid, signature: await sig(reviewerKey) },
    }).catch(() => {});
    expect(events.find((e) => e.event === 'intake.signature_failed')?.reason).toBe('tier-5 partner signature invalid');

    events = [];
    // approval window expired reason — approver signs
    await gate.approve(reviewedDoc({ reviewed_at: new Date(clock.getTime() - 9_000_000) }), {
      principalSub: 'a1', principalKid: approverKey.kid, signature: await sig(approverKey),
    }).catch(() => {});
    expect(events.find((e) => e.event === 'intake.approval_window_expired')?.reason).toBe('approval window expired');

    events = [];
    // inter-signature delay reason — distinct approver (altApproverKey) to avoid replay
    await gate.approve(reviewedDoc({ reviewed_at: new Date(clock.getTime() - 1_000) }), {
      principalSub: 'a2', principalKid: altApproverKey.kid, signature: await sig(altApproverKey),
    }).catch(() => {});
    expect(events.find((e) => e.event === 'intake.inter_signature_delay_violation')?.reason).toBe('inter-signature delay not elapsed');

    events = [];
    // same principal reason
    await gate.approve(reviewedDoc({ reviewer_sub: 'same' }), {
      principalSub: 'same', principalKid: approverKey.kid, signature: await sig(approverKey),
    }).catch(() => {});
    expect(events.find((e) => e.event === 'intake.same_principal_rejected')?.reason).toBe('approver and reviewer are the same principal');

    events = [];
    // bypass attempt reason
    await gate.assertExtractable(asDoc({ status: 'staging' }), { sub: 'w', kid: 'w' }).catch(() => {});
    expect(events.find((e) => e.event === 'intake.bypass_attempt')?.reason).toBe('extraction attempted from staging');
  });
});
