/**
 * KpiLogger unit tests (Story 2.8, AR-25, DoD-2).
 *
 * Verifies the typed PD-2 KPI observation logger:
 *   - Every public method delegates to `repo.appendToPartition` (the sole
 *     construction-gate-adjacent primitive). DoD-2: direct object-literal
 *     construction of `EditorialLogEvent` is banned; the funnel is
 *     mechanically enforced by spying on `appendToPartition` and asserting no
 *     other repository primitive is touched.
 *   - Each method emits the correct event literal + payload shape.
 *   - All events use the `__pd2__` partition + `__system_pd2__` principal.
 *   - Signing-callback failure propagates as `EditorialError('SIGNING_CALLBACK_FAILED')`
 *     via the repository's normalisation (AC-11, Dev Notes).
 *
 * Mock-based (no DB): the repository is a test double so the test exercises
 * ONLY the KpiLogger's dispatch logic, not Postgres CAS behaviour (which is
 * covered by `tests/integration/editorial-log*.integration.test.ts`).
 *
 * @rules AR-25, G-6, AC-11, DoD-2, DoD-18, VAL-9
 * @adr ADR-0001
 */
import { describe, it, expect } from 'vitest';
import { createKpiLogger, PD2_PARTITION_KEY } from './kpi-logger.js';
import type { KpiLogger, KpiLoggerConfig } from './kpi-logger.js';
import type { EditorialLogRepo } from './types.js';
import { EditorialError } from '@iip/contracts';

// ─────────────────────────────────────────────────────────────────────────
// Mock harness
// ─────────────────────────────────────────────────────────────────────────

/** A counting spy on every EditorialLogRepo method. */
function makeMockRepo(behaviour: {
  appendToPartitionResult?: 'ok' | 'signing-failed' | 'exhausted';
} = {}): { repo: EditorialLogRepo; calls: ReturnType<typeof makeCallLog> } {
  const calls = makeCallLog();
  const seqCounter = { n: 0 };
  const repo: EditorialLogRepo = {
    async append(entry) {
      calls.record('append', entry);
      return { ok: true, seq: ++seqCounter.n as never };
    },
    async appendToPartition(params) {
      calls.record('appendToPartition', params);
      if (behaviour.appendToPartitionResult === 'signing-failed') {
        throw new EditorialError('boom', 'SIGNING_CALLBACK_FAILED');
      }
      if (behaviour.appendToPartitionResult === 'exhausted') {
        throw new EditorialError('boom', 'CONCURRENT_APPEND_EXHAUSTED');
      }
      return ++seqCounter.n as never;
    },
    async getTip(partitionKey) {
      calls.record('getTip', { partitionKey });
      return null;
    },
    async queryLog(filter) {
      calls.record('queryLog', filter);
      return [];
    },
    async verifyChain(partitionKey, fromSeq, toSeq) {
      calls.record('verifyChain', { partitionKey, fromSeq, toSeq });
      return {
        partitionKey: String(partitionKey),
        valid: true,
        entriesVerified: 0,
        failures: [],
        warnings: [],
        verifiedAt: new Date(),
      };
    },
  };
  return { repo, calls };
}

/** Records every call to every repo method, keyed by method name. */
function makeCallLog() {
  const log = new Map<string, unknown[]>();
  return {
    record(method: string, args: unknown) {
      const arr = log.get(method) ?? [];
      arr.push(args);
      log.set(method, arr);
    },
    count(method: string): number {
      return log.get(method)?.length ?? 0;
    },
    last(method: string): unknown {
      const arr = log.get(method);
      return arr?.[arr.length - 1];
    },
    all(method: string): unknown[] {
      return log.get(method) ?? [];
    },
  };
}

/** Build a KpiLogger with deterministic clock + JTI. */
function buildKpi(behaviour: { appendToPartitionResult?: 'ok' | 'signing-failed' | 'exhausted' } = {}): {
  kpi: KpiLogger;
  calls: ReturnType<typeof makeCallLog>;
} {
  const { repo, calls } = makeMockRepo(behaviour);
  const config: KpiLoggerConfig = {
    repo,
    signer: async () => 'sig' as never,
    jti: () => 'jti-fixed',
  };
  return { kpi: createKpiLogger(config), calls };
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('KpiLogger (Story 2.8, AR-25, DoD-2)', () => {
  // ── DoD-2: sole construction gate ──────────────────────────────────────
  describe('DoD-2 — sole construction gate (makeEntry via appendToPartition)', () => {
    it('every public method delegates to appendToPartition and NO other repo primitive', async () => {
      const { kpi, calls } = buildKpi();
      await kpi.logVerificationObserved({
        partner_name: 'PRESS_FORUM_X',
        sample_size: 1,
        errors_found: 0,
      });
      await kpi.logEngagementRationale({
        partner_name: 'PRESS_FORUM_X',
        rationale_summary: 'x',
        provenance_cited: true,
      });
      await kpi.logDay90({
        outcome: 'question_donated',
        partner_name: 'PRESS_FORUM_X',
        document_count: 1,
      });
      await kpi.logGateBypassAttempt({ query: 'senator-vote-record-2024' });
      await kpi.logProceedingEarlyTermination({
        proceeding_id: 'proc-001',
        termination_date: '2026-07-06',
        kpi_status: { day30: true },
      });

      // 5 calls, all funnelled through appendToPartition.
      expect(calls.count('appendToPartition')).toBe(5);
      // No other repo primitive was touched.
      expect(calls.count('append')).toBe(0);
      expect(calls.count('getTip')).toBe(0);
      expect(calls.count('queryLog')).toBe(0);
      expect(calls.count('verifyChain')).toBe(0);
    });
  });

  // ── Event literal + payload shape per method ──────────────────────────
  describe('event literal + payload dispatch', () => {
    it('logVerificationObserved emits external.verification.observed with the payload', async () => {
      const { kpi, calls } = buildKpi();
      const payload = {
        partner_name: 'PRESS_FORUM_X',
        corpus_hash: 'a'.repeat(64),
        sample_size: 12,
        errors_found: 1,
        details: 'minor',
      };
      await kpi.logVerificationObserved(payload);
      const last = calls.last('appendToPartition') as {
        partitionKey: string;
        principalSub: string;
        event: string;
        payload: unknown;
      };
      expect(last.event).toBe('external.verification.observed');
      expect(last.payload).toEqual(payload);
      expect(last.partitionKey).toBe(PD2_PARTITION_KEY);
      expect(last.principalSub).toBe('__system_pd2__');
    });

    it('logEngagementRationale emits external.engagement.rationale', async () => {
      const { kpi, calls } = buildKpi();
      await kpi.logEngagementRationale({
        partner_name: 'PRESS_FORUM_X',
        rationale_summary: 'Cited provenance.',
        provenance_cited: true,
      });
      const last = calls.last('appendToPartition') as { event: string };
      expect(last.event).toBe('external.engagement.rationale');
    });

    it('logDay90 — question_donated variant emits external.pd2.day90', async () => {
      const { kpi, calls } = buildKpi();
      await kpi.logDay90({
        outcome: 'question_donated',
        partner_name: 'PRESS_FORUM_X',
        document_count: 5,
      });
      const last = calls.last('appendToPartition') as { event: string; payload: { outcome: string } };
      expect(last.event).toBe('external.pd2.day90');
      expect(last.payload.outcome).toBe('question_donated');
    });

    it('logDay90 — partnership_committed variant emits external.pd2.day90', async () => {
      const { kpi, calls } = buildKpi();
      await kpi.logDay90({
        outcome: 'partnership_committed',
        partner_name: 'PRESS_FORUM_X',
        commitment_type: 'pilot_access',
      });
      const last = calls.last('appendToPartition') as { event: string; payload: { outcome: string } };
      expect(last.event).toBe('external.pd2.day90');
      expect(last.payload.outcome).toBe('partnership_committed');
    });

    it('logGateBypassAttempt emits gate.bypass_attempt', async () => {
      const { kpi, calls } = buildKpi();
      await kpi.logGateBypassAttempt({ query: 'senator-vote-record-2024' });
      const last = calls.last('appendToPartition') as { event: string; payload: { query: string } };
      expect(last.event).toBe('gate.bypass_attempt');
      expect(last.payload.query).toBe('senator-vote-record-2024');
    });

    it('logProceedingEarlyTermination emits proceeding.early_termination', async () => {
      const { kpi, calls } = buildKpi();
      await kpi.logProceedingEarlyTermination({
        proceeding_id: 'proc-2024-001',
        termination_date: '2024-01-15',
        kpi_status: { day30: true, day60: false, day90: false },
      });
      const last = calls.last('appendToPartition') as { event: string };
      expect(last.event).toBe('proceeding.early_termination');
    });
  });

  // ── Partition + principal invariant ───────────────────────────────────
  describe('partition + principal invariant (AR-25, AC-11)', () => {
    it('all events use the __pd2__ partition and __system_pd2__ principal', async () => {
      const { kpi, calls } = buildKpi();
      await kpi.logVerificationObserved({
        partner_name: 'X',
        sample_size: 1,
        errors_found: 0,
      });
      await kpi.logDay90({
        outcome: 'partnership_committed',
        partner_name: 'X',
        commitment_type: 'funding_next_step',
      });
      const allCalls = calls.all('appendToPartition') as Array<{
        partitionKey: string;
        principalSub: string;
      }>;
      for (const c of allCalls) {
        expect(c.partitionKey).toBe('__pd2__');
        expect(c.principalSub).toBe('__system_pd2__');
      }
    });
  });

  // ── Signing failure propagation (AC-11, Dev Notes) ────────────────────
  describe('signing failure propagation (AC-11, Dev Notes)', () => {
    it('signing-callback failure propagates as EditorialError(SIGNING_CALLBACK_FAILED)', async () => {
      const { kpi } = buildKpi({ appendToPartitionResult: 'signing-failed' });
      await expect(
        kpi.logVerificationObserved({
          partner_name: 'X',
          sample_size: 1,
          errors_found: 0,
        }),
      ).rejects.toMatchObject({
        name: 'EditorialError',
        code: 'SIGNING_CALLBACK_FAILED',
      });
    });

    it('CAS exhaustion propagates as EditorialError(CONCURRENT_APPEND_EXHAUSTED)', async () => {
      const { kpi } = buildKpi({ appendToPartitionResult: 'exhausted' });
      await expect(
        kpi.logDay90({
          outcome: 'question_donated',
          partner_name: 'X',
          document_count: 1,
        }),
      ).rejects.toMatchObject({
        name: 'EditorialError',
        code: 'CONCURRENT_APPEND_EXHAUSTED',
      });
    });

    it('signing failure NEVER returns an unsigned or null result', async () => {
      // The method either resolves to a positive seq OR throws — it MUST NOT
      // resolve to 0 / null / undefined (Dev Notes: "never return unsigned or null").
      const { kpi } = buildKpi({ appendToPartitionResult: 'signing-failed' });
      const result = await kpi
        .logGateBypassAttempt({ query: 'q' })
        .then(() => 'resolved')
        .catch(() => 'rejected');
      expect(result).toBe('rejected');
    });
  });

  // ── Return value: the inserted seq ────────────────────────────────────
  describe('return value', () => {
    it('returns the inserted seq on success', async () => {
      const { kpi } = buildKpi();
      const seq1 = await kpi.logVerificationObserved({
        partner_name: 'X',
        sample_size: 1,
        errors_found: 0,
      });
      const seq2 = await kpi.logEngagementRationale({
        partner_name: 'X',
        rationale_summary: 'x',
        provenance_cited: true,
      });
      expect(seq1).toBeGreaterThan(0);
      expect(seq2).toBeGreaterThan(seq1);
    });
  });

  // ── JTI uniqueness ────────────────────────────────────────────────────
  describe('JTI uniqueness', () => {
    it('two calls produce distinct JTIs', async () => {
      // Use a counter-based JTI (default uses crypto.randomUUID, also unique,
      // but a counter is deterministic and unambiguous under test).
      let counter = 0;
      const { repo, calls } = makeMockRepo();
      const kpi = createKpiLogger({
        repo,
        signer: async () => 'sig' as never,
        jti: () => `jti-${++counter}`,
      });
      await kpi.logVerificationObserved({
        partner_name: 'X',
        sample_size: 1,
        errors_found: 0,
      });
      await kpi.logVerificationObserved({
        partner_name: 'Y',
        sample_size: 1,
        errors_found: 0,
      });
      const allCalls = calls.all('appendToPartition') as Array<{ jti: string }>;
      expect(allCalls[0]!.jti).not.toBe(allCalls[1]!.jti);
    });
  });
});
