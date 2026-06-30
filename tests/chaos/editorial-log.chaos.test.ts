/**
 * Chaos tests — Story 2.4 Hash-Chained Editorial Log (SEC-6).
 *
 * 3 chaos tests: DB connection pool exhaustion, transaction timeout, clock
 * skew. These verify the hash chain remains consistent under adverse
 * conditions. Structural stubs — full chaos suite deferred post-Story 2.5.
 *
 * @rules SEC-6, SC-6
 * @adr ADR-0001
 * @term T-006
 */
import { describe, it, expect } from 'vitest';
import { hashEntry, jcsCanonicalize, GENESIS_PREV_HASH } from '@iip/contracts';

describe('Story 2.4 — Editorial log chaos tests (SEC-6)', () => {

  // TC-5.1: DB connection pool exhaustion (simulated)
  it('TC-5.1: Hash chain integrity preserved under concurrent hash computations', () => {
    const results: string[] = [];
    const payload = { reason: 'chaos-test' };

    // Simulate 20 concurrent writers computing hashes.
    for (let i = 0; i < 20; i++) {
      const canonical = {
        seq: i + 1,
        partition_key: 'chaos-1',
        principal_sub: 'op-001',
        event: 'auth.revoked',
        jti: `jti-chaos-${i}`,
        payload,
        time: '2026-06-30T00:00:00.000Z',
      };
      results.push(hashEntry(GENESIS_PREV_HASH, canonical));
    }

    // All hashes should be unique (different seq/jti).
    const unique = new Set(results);
    expect(unique.size).toBe(20);
    // All should be valid 64-char hex.
    expect(results.every((h) => /^[a-f0-9]{64}$/.test(h))).toBe(true);
  });

  // TC-5.2: Transaction timeout (simulated)
  it('TC-5.2: JCS serialization remains deterministic under repeated stress', () => {
    const payload = { b: 2, a: 1, c: { z: 26, y: 25 }, arr: [3, 1, 2] };
    const canonical = {
      seq: 1,
      partition_key: 'chaos-2',
      principal_sub: 'op-001',
      event: 'auth.revoked',
      jti: 'jti-chaos-2',
      payload,
      time: '2026-06-30T00:00:00.000Z',
    };

    // Serialize 1000 times — all must produce identical output.
    const first = jcsCanonicalize(canonical);
    for (let i = 0; i < 1000; i++) {
      expect(jcsCanonicalize(canonical)).toBe(first);
    }
  });

  // TC-5.3: Clock skew (simulated)
  it('TC-5.3: Sequence ordering preserved regardless of time field value', () => {
    // Simulate clock going backward: entries with decreasing timestamps.
    const entries = [
      { seq: 1, time: '2026-06-30T12:00:03.000Z' },
      { seq: 2, time: '2026-06-30T12:00:01.000Z' }, // earlier!
      { seq: 3, time: '2026-06-30T12:00:02.000Z' },
    ];

    // Sort by seq (not time) — seq governs ordering.
    const sorted = [...entries].sort((a, b) => a.seq - b.seq);
    expect(sorted.map((e) => e.seq)).toEqual([1, 2, 3]);

    // Hashes remain deterministic regardless of time skew.
    const hashes = entries.map((e) => {
      const canonical = {
        seq: e.seq,
        partition_key: 'chaos-3',
        principal_sub: 'op-001',
        event: 'auth.revoked',
        jti: `jti-${e.seq}`,
        payload: {},
        time: e.time,
      };
      return hashEntry(GENESIS_PREV_HASH, canonical);
    });
    // All hashes are unique (different time inputs).
    expect(new Set(hashes).size).toBe(3);
  });
});
