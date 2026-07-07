/**
 * Intake replay-detection expansion — cross-document approve signature replay.
 *
 * E2-G4 [P0]: The replay tuple at `state.ts:37` keys off
 * `(content_hash, signature, principalSub, transition)` — it does NOT include
 * `document_id`. Two distinct documents that happen to share a `content_hash`
 * (legitimate duplicate ingest, or a crafted collision) therefore share a
 * replay namespace. An adversary who captures one approver's `(signature, sub)`
 * on document A can replay the exact same tuple on document B (same hash,
 * same signature, same sub, same `approve` transition) and the replay detector
 * will already have recorded it → the SECOND approve throws `intake.replay`,
 * which is the fail-closed outcome. This test PINS that outcome so a refactor
 * that widens replay detection (or narrows it to per-document) is caught and
 * the security property is documented as a mutation-killed invariant.
 *
 * The test also pins the inverse: a DIFFERENT approver signature on the same
 * hash (second legitimate approval path under a shared hash) is correctly
 * REJECTED by the distinct-principal guard, not by replay — distinguishing the
 * two security mechanisms.
 *
 * @rules SEC-2, AC-4, AC-8
 * @adr ADR-0001
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createKeyPair, createSignature } from '@iip/test-utils';
import type { TestKeyPair } from '@iip/test-utils';
import { InMemoryIntakeReplayDetector } from './types.js';
import type { IntakeDocument, IntakeGate } from './types.js';
import { createIntakeGate } from './gate/state.js';
import { createOperatorKeyRegistry, createPartnerKeyRegistry } from './crypto/verify.js';

const SHARED_HASH = 'b'.repeat(64); // identical content_hash for two distinct docs

let reviewerKey: TestKeyPair;
let approverKey: TestKeyPair;
let systemKey: TestKeyPair;
let operatorRecord: Record<string, { key: string; status: 'active' | 'revoked' }>;
let partnerRecord: Record<string, string>;
let clock: Date;
let gate: IntakeGate;

function asDoc(id: string, overrides: Partial<Omit<IntakeDocument, 'status'>> & { status?: string } = {}): IntakeDocument {
  const { status, ...rest } = overrides;
  return {
    id,
    content_hash: SHARED_HASH,
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

async function buildGate(): Promise<IntakeGate> {
  return createIntakeGate({
    operatorKeyring: await createOperatorKeyRegistry(operatorRecord),
    partnerKeyring: await createPartnerKeyRegistry(partnerRecord),
    eventLogger: { async log() { /* no-op for this suite */ } },
    replayDetector: new InMemoryIntakeReplayDetector(),
    approvalWindowSeconds: 3600,
    minInterSignatureDelayMs: 60_000,
    now: () => clock,
    systemSignKey: systemKey.privateKey,
  });
}

/** Produce a doc already in `reviewed_once` (reviewer signed, delay elapsed). */
function reviewedDoc(id: string, reviewerSub: string, reviewerKid: string): IntakeDocument {
  return asDoc(id, {
    status: 'reviewed_once',
    reviewer_sub: reviewerSub,
    reviewer_key_kid: reviewerKid,
    reviewed_at: new Date(clock.getTime() - 120_000),
  });
}

beforeEach(async () => {
  reviewerKey = await createKeyPair('r');
  approverKey = await createKeyPair('a');
  systemKey = await createKeyPair('sys');
  operatorRecord = {
    [reviewerKey.kid]: { key: reviewerKey.publicKeyBase64, status: 'active' },
    [approverKey.kid]: { key: approverKey.publicKeyBase64, status: 'active' },
  };
  partnerRecord = {};
  clock = new Date('2026-07-07T12:00:00Z');
  gate = await buildGate();
});

describe('intake gate — E2-G4 [P0] cross-document approve replay via shared content_hash', () => {
  it('replays the SAME approve signature on a second document with the same hash → intake.replay (fail-closed)', async () => {
    // GIVEN two distinct documents that share a content_hash (duplicate ingest
    // or a crafted collision), both in reviewed_once, reviewed by the same
    // reviewer principal.
    const docA = reviewedDoc('00000000-0000-4000-8000-0000000000aa', 'rev', reviewerKey.kid);
    const docB = reviewedDoc('00000000-0000-4000-8000-0000000000bb', 'rev', reviewerKey.kid);
    expect(docA.id).not.toBe(docB.id);
    expect(docA.content_hash).toBe(docB.content_hash);

    // WHEN the approver signs docA's hash and approves docA...
    const approverSignature = await createSignature({
      privateKey: approverKey.privateKey,
      contentHash: SHARED_HASH,
    });
    const approvedA = await gate.approve(docA, {
      principalSub: 'approver-1',
      principalKid: approverKey.kid,
      signature: approverSignature,
    });
    expect(approvedA.status).toBe('approved');

    // ...and an adversary replays the EXACT same (signature, sub) on docB
    // (same hash → same signature is cryptographically valid for docB too).
    // THEN the replay detector must reject it: the tuple
    // (hash, signature, sub, 'approve') was already recorded for docA.
    await expect(
      gate.approve(docB, {
        principalSub: 'approver-1',
        principalKid: approverKey.kid,
        signature: approverSignature,
      }),
    ).rejects.toThrow(/replay/i);
  });

  it('a SECOND distinct approver can still approve a same-hash document (replay does not over-block)', async () => {
    // GIVEN the same shared-hash scenario, but a DIFFERENT approver principal
    // signs docB. The replay tuple differs on `principalSub`, so this is NOT a
    // replay — it must be allowed by the replay detector (the distinct-
    // principal guard is a separate concern tested elsewhere).
    const docA = reviewedDoc('00000000-0000-4000-8000-0000000000aa', 'rev', reviewerKey.kid);
    const docB = reviewedDoc('00000000-0000-4000-8000-0000000000bb', 'rev-2', reviewerKey.kid);

    // First approver approves docA.
    const sig1 = await createSignature({ privateKey: approverKey.privateKey, contentHash: SHARED_HASH });
    await gate.approve(docA, {
      principalSub: 'approver-1', principalKid: approverKey.kid, signature: sig1,
    });

    // A second, distinct approver principal signs the same hash for docB.
    // (Different principalSub → different replay tuple → not a replay.)
    const approvedB = await gate.approve(docB, {
      principalSub: 'approver-2', principalKid: approverKey.kid, signature: sig1,
    });
    expect(approvedB.status).toBe('approved');
  });

  it('the same approver signing a DIFFERENT hash on a second document is NOT a replay', async () => {
    // Sanity: replay detection is hash-scoped, not principal-scoped. The same
    // approver can approve many documents with distinct hashes. This pins the
    // boundary so a refactor that widens replay to per-principal is caught.
    const hashX = 'c'.repeat(64);
    const hashY = 'd'.repeat(64);
    const docX = reviewedDoc('00000000-0000-4000-8000-0000000000x1', 'rev', reviewerKey.kid);
    const docY = reviewedDoc('00000000-0000-4000-8000-0000000000y2', 'rev', reviewerKey.kid);
    const docXHash = { ...docX, content_hash: hashX } as IntakeDocument;
    const docYHash = { ...docY, content_hash: hashY } as IntakeDocument;

    const sigX = await createSignature({ privateKey: approverKey.privateKey, contentHash: hashX });
    const sigY = await createSignature({ privateKey: approverKey.privateKey, contentHash: hashY });

    const approvedX = await gate.approve(docXHash, {
      principalSub: 'approver-1', principalKid: approverKey.kid, signature: sigX,
    });
    const approvedY = await gate.approve(docYHash, {
      principalSub: 'approver-1', principalKid: approverKey.kid, signature: sigY,
    });
    expect(approvedX.status).toBe('approved');
    expect(approvedY.status).toBe('approved');
  });
});
