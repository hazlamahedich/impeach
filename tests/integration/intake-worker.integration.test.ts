/**
 * Integration tests — Story 2.3 extraction worker state guard (SEC-2, AC-6).
 *
 * Exercises `processIntakeDocument` end-to-end through the real intake gate:
 * the fail-closed assertion (AC-6), the approved->indexed happy path, and
 * idempotent resume from `extracting`. These cases provide the Stryker
 * mutation surface for `apps/ingest-worker/src/worker.ts` (DoD-2: TC-3.1,
 * TC-3.7).
 *
 * @rules SEC-2, AC-6, DoD-2
 * @adr ADR-0001
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createIntakeGate,
  createOperatorKeyRegistry,
  createPartnerKeyRegistry,
  InMemoryIntakeReplayDetector,
} from '@iip/ingest';
import type { IntakeGate, IntakeDocument } from '@iip/ingest';
import { processIntakeDocument } from '@iip/ingest-worker/worker';
import { createKeyPair } from '@iip/test-utils';
import type { TestKeyPair } from '@iip/test-utils';

const CONTENT_HASH = 'a'.repeat(64);
let systemKey: TestKeyPair;
let gate: IntakeGate;

const WORKER = { sub: 'intake-worker', kid: 'system-kid' };

function asDoc(status: string): IntakeDocument {
  return {
    id: crypto.randomUUID(),
    content_hash: CONTENT_HASH,
    status: status as IntakeDocument['status'],
    tier: 1,
    reviewer_sub: status === 'approved' || status === 'extracting' || status === 'indexed' ? 'reviewer-sub' : null,
    reviewer_signature: null,
    reviewer_key_kid: null,
    reviewed_at: null,
    approver_sub: status === 'approved' || status === 'extracting' || status === 'indexed' ? 'approver-sub' : null,
    approver_signature: null,
    approver_key_kid: null,
    approved_at: null,
    partner_kid: null,
    partner_signature: null,
  } as IntakeDocument;
}

beforeEach(async () => {
  systemKey = await createKeyPair('system-kid');
  const operatorKeyring = await createOperatorKeyRegistry({});
  const partnerKeyring = await createPartnerKeyRegistry({});
  gate = createIntakeGate({
    operatorKeyring,
    partnerKeyring,
    eventLogger: { async log() {} },
    replayDetector: new InMemoryIntakeReplayDetector(),
    approvalWindowSeconds: 3600,
    minInterSignatureDelayMs: 60_000,
    now: () => new Date(),
    systemSignKey: systemKey.privateKey,
  });
});

describe('Story 2.3 — Extraction worker state guard (SEC-2, AC-6)', () => {

  it('approved document -> indexed (happy path)', async () => {
    const result = await processIntakeDocument(gate, asDoc('approved'), WORKER);
    expect(result.status).toBe('indexed');
  });

  it('extracting document -> indexed (idempotent resume)', async () => {
    const result = await processIntakeDocument(gate, asDoc('extracting'), WORKER);
    expect(result.status).toBe('indexed');
  });

  it('staging document -> throws bypass_attempt', async () => {
    await expect(processIntakeDocument(gate, asDoc('staging'), WORKER)).rejects.toMatchObject({
      code: 'intake.bypass_attempt',
    });
  });

  it('reviewed_once document -> throws bypass_attempt', async () => {
    await expect(processIntakeDocument(gate, asDoc('reviewed_once'), WORKER)).rejects.toMatchObject({
      code: 'intake.bypass_attempt',
    });
  });

  it('rejected document -> throws bypass_attempt', async () => {
    await expect(processIntakeDocument(gate, asDoc('rejected'), WORKER)).rejects.toMatchObject({
      code: 'intake.bypass_attempt',
    });
  });

  it('needs_revision document -> throws bypass_attempt', async () => {
    await expect(processIntakeDocument(gate, asDoc('needs_revision'), WORKER)).rejects.toMatchObject({
      code: 'intake.bypass_attempt',
    });
  });
});
