/**
 * Co-located mutation test for the extraction worker guard (SEC-2, AC-6, DoD-2).
 *
 * Drives Stryker mutation testing of `src/worker.ts`. The worker is a thin
 * delegator: it asserts extractability (AC-6) then advances approved ->
 * extracting -> indexed (or resumes extracting -> indexed). These cases kill
 * the assert-call removal mutant (TC-3.1) and the idempotent-resume branch
 * mutant (TC-3.7).
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
} from '@iip/intake';
import type { IntakeGate, IntakeDocument } from '@iip/intake';
import { processIntakeDocument } from './worker.js';
import { createKeyPair } from '@iip/test-utils';
import type { TestKeyPair } from '@iip/test-utils';

const HASH = 'a'.repeat(64);
let systemKey: TestKeyPair;
let gate: IntakeGate;
const WORKER = { sub: 'intake-worker', kid: 'system-kid' };

function asDoc(status: string): IntakeDocument {
  return {
    id: crypto.randomUUID(),
    content_hash: HASH,
    status: status as IntakeDocument['status'],
    tier: 1,
    reviewer_sub: 'rev', reviewer_signature: null, reviewer_key_kid: null, reviewed_at: null,
    approver_sub: 'app', approver_signature: null, approver_key_kid: null, approved_at: null,
    partner_kid: null, partner_signature: null,
  } as IntakeDocument;
}

beforeEach(async () => {
  systemKey = await createKeyPair('sys');
  gate = createIntakeGate({
    operatorKeyring: await createOperatorKeyRegistry({}),
    partnerKeyring: await createPartnerKeyRegistry({}),
    eventLogger: { async log() {} },
    replayDetector: new InMemoryIntakeReplayDetector(),
    approvalWindowSeconds: 3600,
    minInterSignatureDelayMs: 60_000,
    now: () => new Date(),
    systemSignKey: systemKey.privateKey,
  });
});

describe('extraction worker guard — mutation drivers (SEC-2, AC-6)', () => {
  it('approved -> indexed (happy path)', async () => {
    const result = await processIntakeDocument(gate, asDoc('approved'), WORKER);
    expect(result.status).toBe('indexed');
  });

  it('extracting -> indexed (idempotent resume, TC-3.7)', async () => {
    const result = await processIntakeDocument(gate, asDoc('extracting'), WORKER);
    expect(result.status).toBe('indexed');
  });

  it('staging -> bypass_attempt (TC-3.1)', async () => {
    await expect(processIntakeDocument(gate, asDoc('staging'), WORKER))
      .rejects.toMatchObject({ code: 'intake.bypass_attempt' });
  });

  it('reviewed_once -> bypass_attempt', async () => {
    await expect(processIntakeDocument(gate, asDoc('reviewed_once'), WORKER))
      .rejects.toMatchObject({ code: 'intake.bypass_attempt' });
  });

  it('rejected -> bypass_attempt', async () => {
    await expect(processIntakeDocument(gate, asDoc('rejected'), WORKER))
      .rejects.toMatchObject({ code: 'intake.bypass_attempt' });
  });

  it('needs_revision -> bypass_attempt', async () => {
    await expect(processIntakeDocument(gate, asDoc('needs_revision'), WORKER))
      .rejects.toMatchObject({ code: 'intake.bypass_attempt' });
  });

  it('indexed -> bypass_attempt (already terminal)', async () => {
    await expect(processIntakeDocument(gate, asDoc('indexed'), WORKER))
      .rejects.toMatchObject({ code: 'intake.bypass_attempt' });
  });
});
