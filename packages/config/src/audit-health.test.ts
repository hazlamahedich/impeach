/**
 * Story 2.11 — Audit Health Client + Circuit-Breaker unit tests.
 *
 * Exercises the ADR-0029 §5 mechanism in isolation: fresh poll, 100ms budget,
 * Closed/Open/Half-Open transitions, exponential backoff, advisory cache, and
 * transition logging. All I/O is injected (no real network, no real clock —
 * flaky-test discipline, project-context §Testing).
 *
 * @rules ADR-0029 §5/§7, SEC-5, AC-11
 * @adr ADR-0029
 */
import { describe, it, expect } from 'vitest';
import { createAuditHealthClient } from './audit-health.js';
import type { HealthStatus } from './audit-health.js';
import type { Clock } from './config-history-repo.js';

/** Controllable clock for deterministic backoff testing. */
function fakeClock(startMs = 0): Clock & { advance(ms: number): void } {
  let t = startMs;
  return {
    now: () => new Date(t),
    advance: (ms: number) => {
      t += ms;
    },
  };
}

/** Fetch stub: returns a controllable healthy/unhealthy response. */
function makeFetch(opts: {
  ok: boolean;
  status?: number;
  latencyMs?: number;
  throwErr?: Error;
}): typeof fetch {
  return (async (_url: unknown, _init?: RequestInit) => {
    if (opts.throwErr) throw opts.throwErr;
    if (opts.latencyMs) await new Promise<void>((r) => setTimeout(r, opts.latencyMs));
    return {
      ok: opts.ok,
      status: opts.status ?? (opts.ok ? 200 : 503),
      statusText: opts.ok ? 'OK' : 'Service Unavailable',
    } as Response;
  }) as typeof fetch;
}

/**
 * Dynamic fetch stub: reads `ok` from a getter on each call so tests can flip
 * health (Closed → Open → recovery) without rebuilding the client.
 */
function dynamicFetch(getOk: () => boolean): typeof fetch {
  return (async (_url: unknown, _init?: RequestInit) => {
    const ok = getOk();
    return {
      ok,
      status: ok ? 200 : 503,
      statusText: ok ? 'OK' : 'Service Unavailable',
    } as Response;
  }) as typeof fetch;
}

describe('Story 2.11 — Audit Health Client (ADR-0029 §5)', () => {
  it('AC #1: fresh poll on Closed/healthy returns healthy + stays Closed', async () => {
    const transitions: Array<{ state: string; status: HealthStatus }> = [];
    const client = createAuditHealthClient({
      baseUrl: 'http://audit-worker:3001',
      fetchImpl: makeFetch({ ok: true }) as typeof fetch,
      onTransition: (state, status) => transitions.push({ state, status }),
    });

    const status = await client.pollAuditHealthForClaim();
    expect(status.healthy).toBe(true);
    expect(client.getCircuitBreakerState()).toBe('Closed');
    // No transition emitted (already Closed).
    expect(transitions).toHaveLength(0);
  });

  it('AC #1: fresh poll unhealthy (503) opens the breaker', async () => {
    const transitions: Array<{ state: string }> = [];
    const client = createAuditHealthClient({
      baseUrl: 'http://audit-worker:3001',
      fetchImpl: makeFetch({ ok: false, status: 503 }) as typeof fetch,
      onTransition: (s) => transitions.push({ state: s }),
    });

    const status = await client.pollAuditHealthForClaim();
    expect(status.healthy).toBe(false);
    expect(status.error).toMatch(/503/);
    expect(client.getCircuitBreakerState()).toBe('Open');
    expect(transitions).toEqual([{ state: 'Open' }]);
  });

  it('AC #6: fetch timeout (>50ms default) is treated as unhealthy → Open', async () => {
    const client = createAuditHealthClient({
      baseUrl: 'http://audit-worker:3001',
      pollTimeoutMs: 30,
      // Simulate a hang: never resolves on its own; the AbortController fires
      // after pollTimeoutMs and we reject on the abort signal.
      fetchImpl: ((_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        })) as typeof fetch,
    });

    const status = await client.pollAuditHealthForClaim();
    expect(status.healthy).toBe(false);
    expect(status.error).toMatch(/timed out/);
    expect(client.getCircuitBreakerState()).toBe('Open');
  });

  it('AC #1: network error (connection refused) → unhealthy → Open', async () => {
    const client = createAuditHealthClient({
      baseUrl: 'http://audit-worker:3001',
      fetchImpl: (async () => {
        throw new TypeError('fetch failed: ECONNREFUSED');
      }) as typeof fetch,
    });

    const status = await client.pollAuditHealthForClaim();
    expect(status.healthy).toBe(false);
    expect(status.error).toMatch(/ECONNREFUSED/);
    expect(client.getCircuitBreakerState()).toBe('Open');
  });

  it('AC #3: Closed → Open → (backoff) → Half-Open → Closed on recovery', async () => {
    const clock = fakeClock(1_000_000);
    let healthy = false;
    const client = createAuditHealthClient({
      baseUrl: 'http://audit-worker:3001',
      clock,
      backoffMs: [1_000], // short for test speed
      fetchImpl: dynamicFetch(() => healthy),
    });

    // 1. Poll unhealthy → Open.
    await client.pollAuditHealthForClaim();
    expect(client.getCircuitBreakerState()).toBe('Open');

    // 2. Immediately poll again — still within backoff window, stays Open.
    clock.advance(100);
    await client.pollAuditHealthForClaim();
    expect(client.getCircuitBreakerState()).toBe('Open');

    // 3. Advance past backoff; healthy now. Half-Open probe succeeds → Closed.
    clock.advance(1_500);
    healthy = true;
    await client.pollAuditHealthForClaim();
    expect(client.getCircuitBreakerState()).toBe('Closed');
  });

  it('AC #3: Half-Open probe failure re-opens with increased backoff', async () => {
    const clock = fakeClock(1_000_000);
    let healthy = false;
    const client = createAuditHealthClient({
      baseUrl: 'http://audit-worker:3001',
      clock,
      backoffMs: [500, 1_000, 2_000],
      fetchImpl: dynamicFetch(() => healthy),
    });

    // Open the breaker.
    await client.pollAuditHealthForClaim();
    expect(client.getCircuitBreakerState()).toBe('Open');

    // Advance past first backoff → Half-Open, then probe fails → Open again.
    clock.advance(600);
    await client.pollAuditHealthForClaim();
    expect(client.getCircuitBreakerState()).toBe('Open');

    // Second backoff is 1000ms; advancing only 600 should NOT promote to Half-Open.
    clock.advance(600);
    await client.pollAuditHealthForClaim();
    expect(client.getCircuitBreakerState()).toBe('Open');

    // Advance past second backoff (1000ms total from re-open) → Half-Open.
    clock.advance(500);
    healthy = true;
    await client.pollAuditHealthForClaim();
    expect(client.getCircuitBreakerState()).toBe('Closed');
  });

  it('AC #2: advisory cache is populated by a fresh poll and TTL-expires', async () => {
    const clock = fakeClock(1_000_000);
    const client = createAuditHealthClient({
      baseUrl: 'http://audit-worker:3001',
      clock,
      cacheTtlMs: 1_000,
      fetchImpl: makeFetch({ ok: true }) as typeof fetch,
    });

    // Before any poll, no advisory.
    expect(client.getAdvisoryHealth()).toBeNull();

    await client.pollAuditHealthForClaim();
    const advisory = client.getAdvisoryHealth();
    expect(advisory?.healthy).toBe(true);

    // Advance past TTL → advisory goes stale.
    clock.advance(1_500);
    expect(client.getAdvisoryHealth()).toBeNull();
  });

  it('AC #3: transition observer failures are swallowed (SEC-5)', async () => {
    const client = createAuditHealthClient({
      baseUrl: 'http://audit-worker:3001',
      fetchImpl: makeFetch({ ok: false, status: 503 }) as typeof fetch,
      onTransition: () => {
        throw new Error('observer explosion');
      },
    });

    // Must NOT throw despite the broken observer.
    const status = await client.pollAuditHealthForClaim();
    expect(status.healthy).toBe(false);
    expect(client.getCircuitBreakerState()).toBe('Open');
  });

  it('AC #6: poll budget default is 100ms and exceeding it fails-closed', async () => {
    const clock = fakeClock(1_000_000);
    const client = createAuditHealthClient({
      baseUrl: 'http://audit-worker:3001',
      pollBudgetMs: 50,
      pollTimeoutMs: 1_000, // let the call succeed; budget is the gate
      clock,
      fetchImpl: (async () => {
        clock.advance(60);
        return { ok: true, status: 200, statusText: 'OK' } as Response;
      }) as typeof fetch,
    });

    const status = await client.pollAuditHealthForClaim();
    expect(status.latencyMs).toBe(60);
    expect(status.healthy).toBe(false);
    expect(status.error).toMatch(/exceeded 50ms budget/);
    expect(client.getCircuitBreakerState()).toBe('Open');
  });

  it('AC #6: poll within the configured budget is healthy', async () => {
    const clock = fakeClock(1_000_000);
    const client = createAuditHealthClient({
      baseUrl: 'http://audit-worker:3001',
      pollBudgetMs: 100,
      pollTimeoutMs: 1_000,
      clock,
      fetchImpl: (async () => {
        clock.advance(80);
        return { ok: true, status: 200, statusText: 'OK' } as Response;
      }) as typeof fetch,
    });

    const status = await client.pollAuditHealthForClaim();
    expect(status.latencyMs).toBe(80);
    expect(status.healthy).toBe(true);
    expect(client.getCircuitBreakerState()).toBe('Closed');
  });

  it('reset() restores Closed + clears cache', async () => {
    const client = createAuditHealthClient({
      baseUrl: 'http://audit-worker:3001',
      fetchImpl: makeFetch({ ok: false }) as typeof fetch,
    });
    await client.pollAuditHealthForClaim();
    expect(client.getCircuitBreakerState()).toBe('Open');
    expect(client.getAdvisoryHealth()).not.toBeNull();

    client.reset();
    expect(client.getCircuitBreakerState()).toBe('Closed');
    expect(client.getAdvisoryHealth()).toBeNull();
  });
});
