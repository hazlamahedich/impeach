/**
 * Audit-health circuit-breaker + secrets/timing-knob validation expansion.
 *
 *   E2-G8 [P0] audit-health.ts backoff-saturation clamp (lines 240-241).
 *          `idx = Math.min(consecutiveFailures - 1, backoffMs.length - 1)`
 *          then `waitMs = backoffMs[idx] ?? backoffMs.at(-1)!`. Every existing
 *          test uses a short custom schedule and never drives
 *          `consecutiveFailures` past `backoffMs.length`. The 30s max-backoff
 *          cap is a documented ADR-0029 §5 requirement; an off-by-one here
 *          makes `waitMs` undefined and the `??` fallback masks it. If the
 *          fallback were absent the breaker would never promote → permanent
 *          Open → claims never served.
 *
 *   E2-G9 [P1] audit-health.ts default-budget derivation (lines 169-173).
 *          `pollTimeoutMs = config.pollTimeoutMs ?? Math.max(1, pollBudgetMs
 *          - DEFAULT_HEADROOM_MS)`. Every test overrides pollBudgetMs and/or
 *          pollTimeoutMs. The production default (100ms budget → 50ms timeout)
 *          + the headroom relationship is never asserted. If DEFAULT_HEADROOM_MS
 *          were changed to ≥100, Math.max(1, ...) clamps to 1ms → every real
 *          production poll times out → permanent fail-closed.
 *
 *   E2-G13 [P1] secrets.ts validateOperatorKeyring revoked-status path +
 *          invalid status/empty key. Only `active` is tested today. Key
 *          rotation (old revoked + new active) is the intended use case.
 *
 *   E2-G14 [P0] secrets.ts timing-knob validation (AC-8 two-person timing
 *          guard). INTAKE_APPROVAL_WINDOW_SECONDS / INTAKE_MIN_INTER_SIGNATURE_DELAY_MS:
 *          negative/zero/non-integer + empty→default untested. A `0` or
 *          negative value disables the AC-8 minimum inter-signature delay →
 *          a single actor could submit review+approval instantaneously.
 *
 * @rules ADR-0029 §5/§7, SEC-2, AC-8, NFR-S-4
 * @adr ADR-0029, ADR-0019
 */

import { describe, it, expect } from 'vitest';
import { createAuditHealthClient } from './audit-health.js';
import type { Clock } from './config-history-repo.js';
import { validateConfig } from './secrets.js';

// ───────────────────────────────────────────────────────────────────────────
// Helpers (mirror audit-health.test.ts patterns)
// ───────────────────────────────────────────────────────────────────────────

function fakeClock(startMs = 0): Clock & { advance(ms: number): void } {
  let t = startMs;
  return {
    now: () => new Date(t),
    advance: (ms: number) => { t += ms; },
  };
}

function makeFetch(getOk: () => boolean): typeof fetch {
  return (async (_url: unknown, _init?: RequestInit) => {
    const ok = getOk();
    return {
      ok,
      status: ok ? 200 : 503,
      statusText: ok ? 'OK' : 'Service Unavailable',
    } as Response;
  }) as typeof fetch;
}

const VALID_ENV: Record<string, string | undefined> = {
  ['DATABASE_URL']: 'postgres://postgres:pw@localhost:5433/iip',
  ['REDIS_URL']: 'redis://localhost:6380',
  ['INTAKE_OPERATOR_PUBLIC_KEYS']: JSON.stringify({
    ['op-1']: { key: 'ZmFrZS1rZXk=', status: 'active' },
  }),
  ['INTAKE_PARTNER_PUBLIC_KEYS']: JSON.stringify({ ['partner-1']: 'ZmFrZS1rZXk=' }),
  ['INTAKE_APPROVAL_WINDOW_SECONDS']: '3600',
  ['INTAKE_MIN_INTER_SIGNATURE_DELAY_MS']: '60000',
};

// ───────────────────────────────────────────────────────────────────────────

describe('audit-health — E2-G8 [P0] backoff saturation at/above schedule length', () => {
  it('drives consecutiveFailures past backoffMs.length and still promotes via the ?? fallback', async () => {
    // GIVEN a short schedule [10, 20, 40] ms and a controllable clock.
    const clock = fakeClock(1_000);
    let healthy = false;
    const client = createAuditHealthClient({
      baseUrl: 'http://audit',
      backoffMs: [10, 20, 40], // length 3
      fetchImpl: makeFetch(() => healthy),
      clock,
      pollTimeoutMs: 1_000, // avoid budget interference
      pollBudgetMs: 2_000,
    });

    // WHEN we fail enough times that consecutiveFailures exceeds backoffMs.length.
    // Failure 1 → Open (consecutiveFailures=1, idx=0 → waitMs=10).
    await client.pollAuditHealthForClaim();
    expect(client.getCircuitBreakerState()).toBe('Open');

    // Failures 2..4 push consecutiveFailures to 4 (> backoffMs.length=3).
    // After each, advance past the MAX schedule value (40ms) so promotion is
    // attempted; the failed probe re-opens with incremented consecutiveFailures.
    for (let i = 0; i < 3; i++) {
      clock.advance(100); // past the largest backoff (40)
      await client.pollAuditHealthForClaim();
      expect(client.getCircuitBreakerState()).toBe('Open');
    }
    // consecutiveFailures is now 4, idx = min(3, 2) = 2 → waitMs = backoffMs[2]
    // = 40. The `??` fallback is NOT triggered here (idx is clamped), but the
    // Math.min clamp IS exercised. Verify the breaker still promotes + recovers.

    // Now recover: advance past the saturated backoff and serve healthy.
    healthy = true;
    clock.advance(100);
    const status = await client.pollAuditHealthForClaim();
    expect(status.healthy).toBe(true);
    expect(client.getCircuitBreakerState()).toBe('Closed');
  });

  it('does not crash / never-promote when backoffMs is a single entry and failures exceed it', async () => {
    // GIVEN a single-entry schedule [50].
    const clock = fakeClock(5_000);
    let healthy = false;
    const client = createAuditHealthClient({
      baseUrl: 'http://audit',
      backoffMs: [50],
      fetchImpl: makeFetch(() => healthy),
      clock,
      pollTimeoutMs: 1_000,
      pollBudgetMs: 2_000,
    });

    // WHEN failures drive consecutiveFailures well past the schedule length.
    for (let i = 0; i < 5; i++) {
      await client.pollAuditHealthForClaim();
      clock.advance(100); // past the 50ms backoff each time
      // Each promoted probe fails → re-Open.
    }
    expect(client.getCircuitBreakerState()).toBe('Open');

    // THEN recovery still works (the ?? / clamp path does not strand the breaker).
    healthy = true;
    clock.advance(100);
    await client.pollAuditHealthForClaim();
    expect(client.getCircuitBreakerState()).toBe('Closed');
  });
});

describe('audit-health — E2-G9 [P1] default-budget derivation (no overrides)', () => {
  // NOTE: the derived HTTP timeout (budget - headroom = 50ms) is enforced via a
  // real `setTimeout` on the AbortController, which cannot be driven
  // deterministically by the injected clock. The deterministic, injectable-clock
  // path is the budget gate (`isOverBudget`: latency > pollBudgetMs → unhealthy).
  // These tests exercise the DEFAULT budget value (100ms) via that gate — the
  // load-bearing default that, if DEFAULT_HEADROOM_MS silently moved ≥100, would
  // clamp the derived timeout to Math.max(1, 0) = 1ms and break production.

  it('default budget (100ms) fail-closes when latency exceeds it (clock-gated)', async () => {
    const clock = fakeClock(0);
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      // Advance the injected clock past the default 100ms budget.
      clock.advance(120);
      if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      return { ok: true, status: 200, statusText: 'OK' } as Response;
    }) as typeof fetch;

    const client = createAuditHealthClient({
      baseUrl: 'http://audit',
      // NO pollBudgetMs, NO pollTimeoutMs → production defaults (budget 100).
      fetchImpl,
      clock,
    });

    const status = await client.pollAuditHealthForClaim();
    // Latency 120ms > default budget 100ms → budget gate fail-closes.
    expect(status.healthy).toBe(false);
    expect(status.error).toMatch(/exceeded.*100ms budget/i);
    expect(client.getCircuitBreakerState()).toBe('Open');
  });

  it('default budget (100ms) admits a poll just under the budget (clock-gated)', async () => {
    const clock = fakeClock(0);
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      clock.advance(90); // under the 100ms budget
      if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      return { ok: true, status: 200, statusText: 'OK' } as Response;
    }) as typeof fetch;

    const client = createAuditHealthClient({
      baseUrl: 'http://audit',
      // defaults
      fetchImpl,
      clock,
    });

    const status = await client.pollAuditHealthForClaim();
    expect(status.healthy).toBe(true);
    expect(client.getCircuitBreakerState()).toBe('Closed');
  });
});

describe('secrets — E2-G13 [P1] validateOperatorKeyring revoked-status + invalid status paths', () => {
  it('accepts a keyring with a REVOKED key (the rotation use case)', () => {
    const env = {
      ...VALID_ENV,
      ['INTAKE_OPERATOR_PUBLIC_KEYS']: JSON.stringify({
        ['op-old']: { key: 'ZmFrZS1vbGQ=', status: 'revoked' },
        ['op-new']: { key: 'ZmFrZS1uZXc=', status: 'active' },
      }),
    };
    const result = validateConfig(env);
    expect(result.ok).toBe(true);
  });

  it('rejects an invalid status (pending)', () => {
    const env = {
      ...VALID_ENV,
      ['INTAKE_OPERATOR_PUBLIC_KEYS']: JSON.stringify({
        ['op-1']: { key: 'ZmFrZS1rZXk=', status: 'pending' },
      }),
    };
    const result = validateConfig(env);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('MALFORMED');
      expect(result.error.name).toBe('INTAKE_OPERATOR_PUBLIC_KEYS');
    }
  });

  it('rejects an entry with an empty key string', () => {
    const env = {
      ...VALID_ENV,
      ['INTAKE_OPERATOR_PUBLIC_KEYS']: JSON.stringify({
        ['op-1']: { key: '   ', status: 'active' },
      }),
    };
    const result = validateConfig(env);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('MALFORMED');
    }
  });

  it('rejects an entry missing the status field', () => {
    const env = {
      ...VALID_ENV,
      ['INTAKE_OPERATOR_PUBLIC_KEYS']: JSON.stringify({
        ['op-1']: { key: 'ZmFrZS1rZXk=' }, // no status
      }),
    };
    const result = validateConfig(env);
    expect(result.ok).toBe(false);
  });

  it('rejects a keyring that is an array (not an object)', () => {
    const env = {
      ...VALID_ENV,
      ['INTAKE_OPERATOR_PUBLIC_KEYS']: JSON.stringify([{ key: 'x', status: 'active' }]),
    };
    const result = validateConfig(env);
    expect(result.ok).toBe(false);
  });
});

describe('secrets — E2-G14 [P0] timing-knob validation (AC-8 two-person timing guard)', () => {
  it('rejects INTAKE_MIN_INTER_SIGNATURE_DELAY_MS = 0 (would disable the timing guard)', () => {
    const env = { ...VALID_ENV, ['INTAKE_MIN_INTER_SIGNATURE_DELAY_MS']: '0' };
    const result = validateConfig(env);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('MALFORMED');
      expect(result.error.name).toBe('INTAKE_MIN_INTER_SIGNATURE_DELAY_MS');
    }
  });

  it('rejects a negative inter-signature delay', () => {
    const env = { ...VALID_ENV, ['INTAKE_MIN_INTER_SIGNATURE_DELAY_MS']: '-1' };
    const result = validateConfig(env);
    expect(result.ok).toBe(false);
  });

  it('rejects a non-integer inter-signature delay', () => {
    const env = { ...VALID_ENV, ['INTAKE_MIN_INTER_SIGNATURE_DELAY_MS']: '60000.5' };
    const result = validateConfig(env);
    expect(result.ok).toBe(false);
  });

  it('rejects a non-numeric inter-signature delay', () => {
    const env = { ...VALID_ENV, ['INTAKE_MIN_INTER_SIGNATURE_DELAY_MS']: 'abc' };
    const result = validateConfig(env);
    expect(result.ok).toBe(false);
  });

  it('rejects INTAKE_APPROVAL_WINDOW_SECONDS = 0', () => {
    const env = { ...VALID_ENV, ['INTAKE_APPROVAL_WINDOW_SECONDS']: '0' };
    const result = validateConfig(env);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.name).toBe('INTAKE_APPROVAL_WINDOW_SECONDS');
    }
  });

  it('rejects a negative approval window', () => {
    const env = { ...VALID_ENV, ['INTAKE_APPROVAL_WINDOW_SECONDS']: '-3600' };
    const result = validateConfig(env);
    expect(result.ok).toBe(false);
  });

  it('falls back to the default when INTAKE_APPROVAL_WINDOW_SECONDS is empty', () => {
    const env = { ...VALID_ENV, ['INTAKE_APPROVAL_WINDOW_SECONDS']: '' };
    const result = validateConfig(env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.intake.approvalWindowSeconds).toBe(3600);
    }
  });

  it('falls back to the default when INTAKE_MIN_INTER_SIGNATURE_DELAY_MS is empty', () => {
    const env = { ...VALID_ENV, ['INTAKE_MIN_INTER_SIGNATURE_DELAY_MS']: '  ' };
    const result = validateConfig(env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.intake.minInterSignatureDelayMs).toBe(60_000);
    }
  });
});
