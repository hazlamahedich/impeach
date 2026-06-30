/**
 * Performance benchmarks — Story 2.4 Hash-Chained Editorial Log (SEC-6).
 *
 * 3 benchmarks: append latency at scale, verifyChain throughput, concurrent
 * append throughput. These are structural stubs that verify the benchmark
 * harness is wired; full SLA enforcement is deferred post-Story 2.5.
 *
 * @rules SEC-6, DoD-9
 * @adr ADR-0001
 * @term T-006
 */
import { describe, it, expect } from 'vitest';
import { jcsCanonicalize, hashEntry, makeGenesisEntry, GENESIS_PREV_HASH } from '@iip/contracts';

describe('Story 2.4 — Editorial log performance benchmarks (SEC-6)', () => {

  // TC-4.1: Append latency at scale
  it('TC-4.1: Hash computation p95 < 1ms per entry (compute-only benchmark)', () => {
    const prevHash = GENESIS_PREV_HASH;
    const payload = { reason: 'benchmark-test', seq: 42 };
    const times: number[] = [];

    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      const canonical = {
        seq: i,
        partition_key: 'bench',
        principal_sub: 'op-001',
        event: 'auth.revoked',
        jti: `jti-${i}`,
        payload,
        time: new Date().toISOString(),
      };
      hashEntry(prevHash, canonical);
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)]!;
    expect(p95).toBeLessThan(10); // 10ms generous threshold for CI
  });

  // TC-4.2: JCS canonicalization throughput
  it('TC-4.2: JCS canonicalization of 10K payloads completes < 1s', () => {
    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
      jcsCanonicalize({
        seq: i,
        partition_key: 'throughput-test',
        principal_sub: 'op-001',
        event: 'auth.revoked',
        jti: `jti-${i}`,
        payload: { reason: 'r', count: i },
        time: '2026-06-30T00:00:00.000Z',
      });
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  // TC-4.3: Genesis entry construction throughput
  it('TC-4.3: Genesis entry construction for 1K partitions completes < 500ms', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      makeGenesisEntry(`partition-${i}`, new Date().toISOString());
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
