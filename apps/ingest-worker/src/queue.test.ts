/**
 * Queue substrate contract tests — idempotency + dedupe (TD4, PC-2.4, FR-1.6).
 *
 * Unit tests for the deterministic jobId computation + dedupe-anchor logic.
 * These prove the idempotency contract: two jobs with the same dedupe anchor
 * produce the same jobId, so re-enqueue is a no-op (BullMQ deduplicates).
 *
 * The full resume-after-crash integration test (against real Redis via
 * Testcontainers) is documented in
 * `tests/contract/ingestion-idempotency-contract.md` and exercised in
 * `tests/integration/ingestion-resume.integration.test.ts` (Story 3.6 scope).
 *
 * @rules FR-1.6, PC-2.4, STR-3
 * @adr ADR-001
 */
import { describe, it, expect } from 'vitest';
import { computeJobId, fetchDedupeAnchor } from './queue.js';

describe('TD4 — queue idempotency contract (PC-2.4, FR-1.6)', () => {
  describe('computeJobId', () => {
    it('produces a 64-char lowercase hex SHA-256 for a dedupe anchor', () => {
      const jobId = computeJobId('fetch:abc123:src-1');
      expect(jobId).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic — the same anchor yields the same jobId', () => {
      const anchor = 'fetch:checksum-xyz:source-42';
      expect(computeJobId(anchor)).toBe(computeJobId(anchor));
    });

    it('differs for different anchors (no collision)', () => {
      const a = computeJobId('fetch:doc-a:src-1');
      const b = computeJobId('fetch:doc-b:src-1');
      const c = computeJobId('fetch:doc-a:src-2');
      expect(a).not.toBe(b);
      expect(a).not.toBe(c);
      expect(b).not.toBe(c);
    });

    it('matches the documented sha256(dedupe-anchor) formula (PC-2.4)', () => {
      // Pin against a known SHA-256 to catch a hashing-algorithm regression.
      // sha256('test') = 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
      expect(computeJobId('test')).toBe(
        '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      );
    });
  });

  describe('fetchDedupeAnchor', () => {
    it('composes anchor from content checksum + source id (FR-1.3, PC-1a)', () => {
      const checksum = 'a'.repeat(64);
      const anchor = fetchDedupeAnchor(checksum, 'src-1');
      expect(anchor).toBe(`fetch:${checksum}:src-1`);
    });

    it('same checksum + source → same anchor → same jobId (idempotent re-ingest)', () => {
      const checksum = 'b'.repeat(64);
      const jobId1 = computeJobId(fetchDedupeAnchor(checksum, 'src-1'));
      const jobId2 = computeJobId(fetchDedupeAnchor(checksum, 'src-1'));
      // The SAME document re-ingested from the SAME source produces the SAME
      // jobId — BullMQ treats the second enqueue as a duplicate (idempotent).
      expect(jobId1).toBe(jobId2);
    });

    it('different source → different anchor → different jobId (not a false dedupe)', () => {
      const checksum = 'c'.repeat(64);
      const jobId1 = computeJobId(fetchDedupeAnchor(checksum, 'src-1'));
      const jobId2 = computeJobId(fetchDedupeAnchor(checksum, 'src-2'));
      // The SAME content from a DIFFERENT source is a genuine separate job
      // (two independent provenance chains) — must NOT dedupe.
      expect(jobId1).not.toBe(jobId2);
    });
  });
});
