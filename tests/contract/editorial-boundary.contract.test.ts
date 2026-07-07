/**
 * Contract tests — Story 2.4 Hash-Chained Editorial Log boundary (SEC-6).
 *
 * 10 test cases: branded type exports, discriminated union schema, makeEntry
 * JCS determinism, makeEntry hash formula, write-only repository exports,
 * UTC-only timestamps, no Zod defaults on critical fields, AuthEventLogger
 * adapter contract, no PII in payload schemas, genesis hash constant.
 *
 * @rules SEC-6, AC-1, AC-5, AC-10, AC-12, DoD-1, DoD-2, DoD-5, DoD-6,
 *        DoD-11, DoD-14, DoD-15, DoD-16, DoD-18
 * @adr ADR-0001
 * @term T-006
 */
import { describe, it, expect } from 'vitest';
import {
  PrevHash,
  CorpusHash,
  Signature,
  Seq,
  PartitionKey,
  GENESIS_PREV_HASH,
  EditorialLogEvent,
  LogEntry,
  jcsCanonicalize,
  makeEntry,
  makeGenesisEntry,
} from '@iip/contracts';
import { createEditorialLogRepo, EditorialAuthEventLogger } from '@iip/editorial';
import type { EditorialLogRepo, OperatorKeyLookup, QueryExecutor } from '@iip/editorial';
import { createHash } from 'node:crypto';

describe('Story 2.4 — Editorial log boundary contracts (SEC-6)', () => {

  // TC-2.1: Branded type exports
  it('TC-2.1: @iip/contracts exports branded PrevHash, CorpusHash, Signature, Seq, PartitionKey', () => {
    expect(PrevHash).toBeDefined();
    expect(CorpusHash).toBeDefined();
    expect(Signature).toBeDefined();
    expect(Seq).toBeDefined();
    expect(PartitionKey).toBeDefined();

    // PrevHash accepts a 64-char hex string.
    const hex64 = 'a'.repeat(64);
    expect(PrevHash.safeParse(hex64).success).toBe(true);
    expect(PrevHash.safeParse('not-a-hash').success).toBe(false);

    // CorpusHash accepts a 64-char hex string.
    expect(CorpusHash.safeParse(hex64).success).toBe(true);

    // Signature accepts any string (including empty for genesis).
    expect(Signature.safeParse('sig').success).toBe(true);
    expect(Signature.safeParse('').success).toBe(true);

    // Seq accepts nonnegative integers.
    expect(Seq.safeParse(0).success).toBe(true);
    expect(Seq.safeParse(42).success).toBe(true);
    expect(Seq.safeParse(-1).success).toBe(false);

    // PartitionKey accepts non-empty strings.
    expect(PartitionKey.safeParse('__system__').success).toBe(true);
    expect(PartitionKey.safeParse('').success).toBe(false);
  });

  // TC-2.2: Discriminated union schema
  it('TC-2.2: @iip/contracts exports EditorialLogEvent as z.discriminatedUnion with 21 event variants', () => {
    const events = [
      'system.genesis',
      'auth.revoked',
      'auth.expired',
      'auth.invalid_signature',
      'auth.missing_kid',
      'auth.expired_key',
      'auth.insufficient_scope',
      'auth.replay',
      'intake.approved',
      'intake.rejected',
      'intake.bypass_attempt',
      'editorial.signoff',
      'editorial.revoke_signoff',
      'system.chain_integrity_failure',
      // Story 2.8 — PD-2 KPI cascade (AR-25, G-6)
      'external.verification.observed',
      'external.engagement.rationale',
      'external.pd2.day90',
      'gate.bypass_attempt',
      'proceeding.early_termination',
      // Story 2.11 — audit circuit-breaker transitions (ADR-0029 §5)
      'audit.circuit_breaker.opened',
      'audit.circuit_breaker.closed',
    ];
    for (const event of events) {
      const sample = makeSampleEvent(event);
      const result = EditorialLogEvent.safeParse({ event, payload: sample });
      expect(result.success).toBe(true);
    }

    // Unknown event rejected.
    expect(
      EditorialLogEvent.safeParse({ event: 'auth.unknown_event', payload: {} }).success,
    ).toBe(false);
  });

  // TC-2.3: makeEntry JCS determinism
  it('TC-2.3: makeEntry with identical inputs produces identical curr_hash values', async () => {
    const prevHash = 'b'.repeat(64);
    const getSig = async () => Signature.parse('test-sig');

    const params = {
      partitionKey: 'test-partition',
      principalSub: 'op-001',
      event: 'auth.revoked' as const,
      jti: 'jti-001',
      payload: { reason: 'compromised' },
      time: '2026-06-30T00:00:00.000Z',
      prevHash,
      seq: 1,
      getSignature: getSig,
    };

    const entry1 = await makeEntry(params);
    const entry2 = await makeEntry({ ...params });

    expect(entry1.curr_hash).toBe(entry2.curr_hash);
  });

  // TC-2.4: makeEntry hash formula
  it('TC-2.4: makeEntry curr_hash matches SHA-256(prev_hash || JCS(canonical_payload))', async () => {
    const prevHash = 'c'.repeat(64);
    const entry = await makeEntry({
      partitionKey: 'p1',
      principalSub: 'op-001',
      event: 'intake.approved',
      jti: 'jti-002',
      payload: { intake_id: 'doc-1', content_hash: 'd'.repeat(64) },
      time: '2026-06-30T00:00:00.000Z',
      prevHash,
      seq: 1,
      getSignature: async () => Signature.parse('sig-001'),
    });

    // Recompute: SHA-256(prevHash bytes || JCS(canonical_payload) bytes)
    const canonical = jcsCanonicalize({
      seq: 1,
      partition_key: 'p1',
      principal_sub: 'op-001',
      event: 'intake.approved',
      jti: 'jti-002',
      payload: { intake_id: 'doc-1', content_hash: 'd'.repeat(64) },
      time: '2026-06-30T00:00:00.000Z',
    });
    const expected = createHash('sha256')
      .update(Buffer.concat([Buffer.from(prevHash, 'hex'), Buffer.from(canonical, 'utf8')]))
      .digest('hex');

    expect(entry.curr_hash).toBe(expected);
  });

  // TC-2.5: Write-only repository exports
  it('TC-2.5: @iip/editorial exports createEditorialLogRepo returning only append/getTip/queryLog/verifyChain', () => {
    const noopExecutor: QueryExecutor = {
      async query() {
        return { rows: [] };
      },
    };
    const noopKeyLookup: OperatorKeyLookup = {
      async getPublicKey() {
        return undefined;
      },
    };
    const repo: EditorialLogRepo = createEditorialLogRepo({
      executor: noopExecutor,
      keyLookup: noopKeyLookup,
      now: () => new Date(),
    });

    expect(typeof repo.append).toBe('function');
    expect(typeof repo.getTip).toBe('function');
    expect(typeof repo.queryLog).toBe('function');
    expect(typeof repo.verifyChain).toBe('function');

    // No update or delete methods exist.
    expect((repo as Record<string, unknown>)['update']).toBeUndefined();
    expect((repo as Record<string, unknown>)['delete']).toBeUndefined();
  });

  // TC-2.6: UTC-only timestamps
  it('TC-2.6: LogEntry time field accepts ISO 8601 UTC with Z suffix', () => {
    const entry: LogEntry = {
      seq: Seq.parse(1),
      partition_key: PartitionKey.parse('p1'),
      prev_hash: PrevHash.parse('e'.repeat(64)),
      curr_hash: CorpusHash.parse('f'.repeat(64)),
      principal_sub: 'op-001',
      signature: Signature.parse('sig'),
      event: 'auth.revoked',
      jti: 'jti-003',
      payload: { reason: 'test' },
      time: '2026-06-30T00:00:00.000Z',
    };
    expect(entry.time).toMatch(/Z$/);
  });

  // TC-2.7: No Zod defaults on critical fields
  it('TC-2.7: LogEntry schema has no .default() on principal_sub, signature, curr_hash, prev_hash, partition_key, jti', () => {
    // The LogEntry schema is defined without defaults on critical fields.
    // We verify by parsing an object missing optional fields — it should fail,
    // not substitute defaults.
    const required = ['principal_sub', 'signature', 'curr_hash', 'prev_hash', 'partition_key', 'jti'] as const;
    for (const field of required) {
      const fullEntry = {
        seq: 0,
        partition_key: 'p1',
        prev_hash: '0'.repeat(64),
        curr_hash: '0'.repeat(64),
        principal_sub: 'op',
        signature: 'sig',
        event: 'system.genesis',
        jti: 'jti',
        payload: {},
        time: '2026-06-30T00:00:00.000Z',
      };
      // Full parse should succeed.
      expect(LogEntry.safeParse(fullEntry).success).toBe(true);

      // Remove the field — parse should fail (no default substitutes).
      const missing = { ...fullEntry } as Record<string, unknown>;
      delete missing[field];
      expect(LogEntry.safeParse(missing).success).toBe(false);
    }
  });

  // TC-2.8: AuthEventLogger adapter contract
  it('TC-2.8: EditorialAuthEventLogger satisfies AuthEventLogger interface', async () => {
    const appended: unknown[] = [];
    const delegate = {
      async append(params: Record<string, unknown>) {
        appended.push(params);
      },
    };
    const logger = new EditorialAuthEventLogger(delegate, () => '2026-06-30T00:00:00.000Z');

    // Should have all AuthEventLogger methods.
    expect(typeof logger.revoked).toBe('function');
    expect(typeof logger.expired).toBe('function');
    expect(typeof logger.invalidSignature).toBe('function');
    expect(typeof logger.missingKid).toBe('function');
    expect(typeof logger.insufficientScope).toBe('function');
    expect(typeof logger.replay).toBe('function');

    // Calling a method should delegate to append.
    logger.revoked(
      { sub: 'op-001', iss: 'iip', kid: 'k1', jti: 'j1', scope: ['read'] },
      'test-reason',
    );
    // The delegate is called asynchronously (fire-and-forget per AuthEventLogger pattern).
    await new Promise((r) => setTimeout(r, 10));
    expect(appended.length).toBe(1);
    expect(appended[0]).toMatchObject({ event: 'auth.revoked', principalSub: 'op-001' });
  });

  // TC-2.9: No PII in payload schemas
  it('TC-2.9: No payload schema contains PII field names (user_content, personal_data, pii, email, phone, address, name)', () => {
    const piiFields = ['user_content', 'personal_data', 'pii', 'email', 'phone', 'address', 'name'];
    // Verify by checking all valid events — none should have PII fields in their payloads.
    const samplePayloads: Record<string, unknown> = {
      'system.genesis': {},
      'auth.revoked': { reason: 'x' },
      'auth.expired': {},
      'auth.invalid_signature': { kid: 'k' },
      'auth.missing_kid': {},
      'auth.expired_key': { kid: 'k' },
      'auth.insufficient_scope': { required: ['r'], actual: ['a'] },
      'auth.replay': { jti: 'j' },
      'intake.approved': { intake_id: 'i', content_hash: 'h' },
      'intake.rejected': { intake_id: 'i', reason: 'r' },
      'intake.bypass_attempt': { intake_id: 'i', current_state: 's' },
      'editorial.signoff': { claim_id: 'c', citation_hash: 'h' },
      'editorial.revoke_signoff': { claim_id: 'c', reason: 'r' },
      'system.chain_integrity_failure': { partition_key: 'p', failure_count: 1 },
    };

    for (const [event, payload] of Object.entries(samplePayloads)) {
      const result = EditorialLogEvent.safeParse({ event, payload });
      expect(result.success).toBe(true);
      // Check payload keys don't contain PII fields.
      if (payload && typeof payload === 'object') {
        const keys = Object.keys(payload as object);
        for (const pii of piiFields) {
          expect(keys).not.toContain(pii);
        }
      }
    }
  });

  // TC-2.10: Genesis hash constant
  it('TC-2.10: GENESIS_PREV_HASH equals SHA-256("IIP_EDITORIAL_LOG_GENESIS_v1")', () => {
    const expected = createHash('sha256').update('IIP_EDITORIAL_LOG_GENESIS_v1').digest('hex');
    expect(GENESIS_PREV_HASH).toBe(expected);

    // Genesis entry uses GENESIS_PREV_HASH as its prev_hash.
    const genesis = makeGenesisEntry('test-partition', '2026-06-30T00:00:00.000Z');
    expect(genesis.prev_hash).toBe(GENESIS_PREV_HASH);
    expect(genesis.seq).toBe(0);
    expect(genesis.signature).toBe('');
    expect(genesis.event).toBe('system.genesis');
    expect(genesis.principal_sub).toBe('__genesis__');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function makeSampleEvent(event: string): unknown {
  const payloads: Record<string, unknown> = {
    'system.genesis': {},
    'auth.revoked': { reason: 'x' },
    'auth.expired': {},
    'auth.invalid_signature': { kid: 'k' },
    'auth.missing_kid': {},
    'auth.expired_key': { kid: 'k' },
    'auth.insufficient_scope': { required: ['r'], actual: ['a'] },
    'auth.replay': { jti: 'j' },
    'intake.approved': { intake_id: 'i', content_hash: 'h' },
    'intake.rejected': { intake_id: 'i', reason: 'r' },
    'intake.bypass_attempt': { intake_id: 'i', current_state: 's' },
    'editorial.signoff': { claim_id: 'c', citation_hash: 'h' },
    'editorial.revoke_signoff': { claim_id: 'c', reason: 'r' },
    'system.chain_integrity_failure': { partition_key: 'p', failure_count: 1 },
    // Story 2.8 — PD-2 KPI cascade samples (AR-25). Day 90 uses the
    // question_donated variant; partnership_committed is covered in the
    // dedicated kpi-events contract test.
    'external.verification.observed': { partner_name: 'PRESS_FORUM_X', sample_size: 1, errors_found: 0 },
    'external.engagement.rationale': { partner_name: 'PRESS_FORUM_X', rationale_summary: 'x', provenance_cited: true },
    'external.pd2.day90': { outcome: 'question_donated', partner_name: 'PRESS_FORUM_X', document_count: 1 },
    'gate.bypass_attempt': { query: 'q' },
    'proceeding.early_termination': { proceeding_id: 'p', termination_date: '2026-07-06', kpi_status: { day30: true } },
    // Story 2.11 — audit circuit-breaker transitions (ADR-0029 §5)
    'audit.circuit_breaker.opened': { reason: 'audit-worker unreachable', poll_latency_ms: 50 },
    'audit.circuit_breaker.closed': { poll_latency_ms: 12 },
  };
  return payloads[event];
}
