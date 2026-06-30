/**
 * Contract tests — Story 2.3 Two-Person Intake boundary (SEC-2).
 *
 * 6 test cases: branded type exports, state machine transition function
 * signature, IntakeEventLogger interface, operator + partner keyring config
 * resolution, and the signature payload format contract.
 *
 * @rules SEC-2, PC-4, DoD-1, DoD-4, DoD-6, DoD-9
 * @adr ADR-0001
 */
import { describe, it, expect } from 'vitest';
import {
  DocumentStatus,
  Ed25519Signature,
  NoopIntakeEventLogger,
  computeContentHash,
  signaturePayloadFromHash,
} from '@iip/contracts';
import type { IntakeEventLogger, IntakeEvent } from '@iip/contracts';
import {
  createIntakeGate,
  createOperatorKeyRegistry,
  createPartnerKeyRegistry,
} from '@iip/intake';
import type { IntakeGate, IntakeGateConfig } from '@iip/intake';
import { createKeyPair } from '@iip/test-utils';

describe('Story 2.3 — Intake boundary contracts (SEC-2)', () => {

  // TC-2.1: Ingestion state and signature type exports
  it('TC-2.1: @iip/contracts exports branded DocumentStatus and Ed25519Signature', () => {
    expect(DocumentStatus).toBeDefined();
    expect(Ed25519Signature).toBeDefined();

    // DocumentStatus accepts the 7 lifecycle values and rejects others.
    for (const s of ['staging', 'reviewed_once', 'approved', 'extracting', 'indexed', 'rejected', 'needs_revision']) {
      expect(DocumentStatus.safeParse(s).success).toBe(true);
    }
    expect(DocumentStatus.safeParse('frozen').success).toBe(false);

    // Ed25519Signature accepts a non-empty string (branded).
    expect(Ed25519Signature.safeParse('abc').success).toBe(true);
    expect(Ed25519Signature.safeParse('').success).toBe(false);
  });

  // TC-2.2: State transition function signature
  it('TC-2.2: packages/intake exports createIntakeGate returning the IntakeGate contract', async () => {
    expect(typeof createIntakeGate).toBe('function');
    const minimalConfig: IntakeGateConfig = {
      operatorKeyring: await createOperatorKeyRegistry({}),
      partnerKeyring: await createPartnerKeyRegistry({}),
      eventLogger: NoopIntakeEventLogger,
      replayDetector: { async checkAndRecord() { return true; } },
      approvalWindowSeconds: 3600,
      minInterSignatureDelayMs: 60_000,
      now: () => new Date(),
      systemSignKey: {} as CryptoKey,
    };
    const gate: IntakeGate = createIntakeGate(minimalConfig);
    expect(typeof gate.review).toBe('function');
    expect(typeof gate.approve).toBe('function');
    expect(typeof gate.reject).toBe('function');
    expect(typeof gate.revise).toBe('function');
    expect(typeof gate.assertExtractable).toBe('function');
    expect(typeof gate.beginExtraction).toBe('function');
    expect(typeof gate.completeIndexing).toBe('function');
    expect(typeof gate.issueAttestation).toBe('function');
  });

  // TC-2.3: IntakeEventLogger interface
  it('TC-2.3: IntakeEventLogger interface — NoopIntakeEventLogger implements log()', async () => {
    const logger: IntakeEventLogger = NoopIntakeEventLogger;
    expect(typeof logger.log).toBe('function');
    const event: IntakeEvent = {
      event: 'intake.reviewed_once',
      principal_sub: 'p1',
      key_kid: 'k1',
      document_id: 'd1',
      content_hash: 'h'.repeat(64),
      timestamp: new Date().toISOString(),
      previous_state: 'staging' as IntakeEvent['previous_state'],
      new_state: 'reviewed_once' as IntakeEvent['new_state'],
    };
    await expect(logger.log(event)).resolves.toBeUndefined();
  });

  // TC-2.4: Keyring config resolution (operator)
  it('TC-2.4: createOperatorKeyRegistry resolves base64 keys with active/revoked status', async () => {
    const key = await createKeyPair('op-1');
    const key2 = await createKeyPair('op-2');
    const registry = await createOperatorKeyRegistry({
      'op-1': { key: key.publicKeyBase64, status: 'active' },
      'op-2': { key: key2.publicKeyBase64, status: 'revoked', revokedAt: '2026-06-30T00:00:00Z' },
    });
    expect(registry.get('op-1')?.status).toBe('active');
    expect(registry.get('op-2')?.status).toBe('revoked');
    expect(registry.get('unknown')).toBeUndefined();
    // Resolved entry carries a CryptoKey.
    expect(registry.get('op-1')?.publicKey).toBeInstanceOf(CryptoKey);
  });

  // TC-2.5: Keyring config resolution (partner)
  it('TC-2.5: createPartnerKeyRegistry resolves base64 partner keys', async () => {
    const key = await createKeyPair('partner-1');
    const registry = await createPartnerKeyRegistry({ 'partner-1': key.publicKeyBase64 });
    expect(registry.get('partner-1')).toBeInstanceOf(CryptoKey);
    expect(registry.get('unknown')).toBeUndefined();
  });

  // TC-2.6: Signature payload format contract (DoD-6)
  it('TC-2.6: computeContentHash + signaturePayloadFromHash reproduce the DoD-6 pipeline', () => {
    const raw = Buffer.from('hello world', 'utf8');
    const hash = computeContentHash(raw, true);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    const payload = signaturePayloadFromHash(hash);
    expect(payload).toEqual(new TextEncoder().encode(hash));

    // Deterministic: same bytes -> same hash.
    expect(computeContentHash(raw, true)).toBe(hash);
  });
});
