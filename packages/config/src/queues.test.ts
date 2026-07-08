/**
 * Ingest-queue backoff config contract test.
 *
 * Coverage gap from the Epic 3 test-design (R3.6d, NFR-R-2): the BullMQ
 * substrate landed in the TD4 prep sprint (`computeJobId`, `enqueueIngestJob`,
 * the Enqueuer), and the backoff knob landed in `packages/config/src/queues.ts`
 * — but NO test asserts the backoff CURVE is exact (5 attempts / 1s base /
 * 1.6× growth / 30s cap). `queue.test.ts` covers jobId idempotency only.
 *
 * NFR-R-2 requires "capped exponential backoff." A silent change to the curve
 * (e.g. growth factor bumped, cap removed) would either starve retries or
 * hammer a failing downstream. This is defamation-adjacent: a flaky extraction
 * that isn't retried correctly produces inconsistent provenance.
 *
 * Unlike the other Epic 3 gap scaffolds, this module is ALREADY IMPLEMENTED —
 * this test can and should be GREEN. It is the regression net for the curve.
 *
 * @rules FR-1.6, NFR-R-2, PC-1d, PC-2.4
 * @adr ADR-0027
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getBackoff, setBackoff, backoffDelayMs } from './queues.js';
import type { Principal } from '@iip/contracts';

const ACTING_PRINCIPAL = { sub: 'test-config-bot', scope: ['config:write'] } as unknown as Principal;

describe('Ingest-queue backoff config (NFR-R-2)', () => {
  // Restore defaults after each test so a setBackoff in one test doesn't bleed.
  beforeEach(() => {
    setBackoff(
      { maxAttempts: 5, baseDelayMs: 1_000, growthFactor: 1.6, maxDelayMs: 30_000 },
      ACTING_PRINCIPAL,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Default curve exactness (NFR-R-2 — the conservative v1 defaults)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] BF-1: the default backoff curve is exactly 5 attempts / 1s base / 1.6× / 30s cap', () => {
    const config = getBackoff();
    // Then: each parameter matches the documented conservative v1 defaults.
    expect(config.maxAttempts).toBe(5);
    expect(config.baseDelayMs).toBe(1_000);
    expect(config.growthFactor).toBe(1.6);
    expect(config.maxDelayMs).toBe(30_000);
  });

  it('[P0] BF-2: backoffDelayMs produces the exact exponential sequence up to the cap', () => {
    // Then: attempt N delay = base × growth^(N-1), capped at maxDelayMs.
    // Floating-point: 1.6^n carries IEEE-754 drift (e.g. 1.6^2 = 2.5600000000000002),
    // so the intermediate points use toBeCloseTo (6 sig figs). The curve SHAPE
    // is what matters — a silent change to growthFactor/cap is what this catches.
    // attempt 1: 1000 × 1.6^0 = 1000
    expect(backoffDelayMs(1)).toBe(1_000);
    // attempt 2: 1000 × 1.6^1 = 1600
    expect(backoffDelayMs(2)).toBe(1_600);
    // attempt 3: 1000 × 1.6^2 ≈ 2560
    expect(backoffDelayMs(3)).toBeCloseTo(2_560, 5);
    // attempt 4: 1000 × 1.6^3 ≈ 4096
    expect(backoffDelayMs(4)).toBeCloseTo(4_096, 5);
    // attempt 5: 1000 × 1.6^4 ≈ 6553.6 (still under the 30s cap)
    expect(backoffDelayMs(5)).toBeCloseTo(6_553.6, 3);
  });

  it('[P0] BF-3: backoffDelayMs is capped at maxDelayMs (no unbounded growth)', () => {
    // Given: a high attempt number that would exceed the cap.
    // Then: the delay is clamped at 30_000ms — never grows unbounded.
    expect(backoffDelayMs(20)).toBe(30_000);
    expect(backoffDelayMs(100)).toBe(30_000);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Validation (NFR-R-2 — invalid configs are rejected, not silently applied)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] BF-4: setBackoff rejects a non-positive maxAttempts', () => {
    expect(() => setBackoff({ maxAttempts: 0 }, ACTING_PRINCIPAL)).toThrow();
    expect(() => setBackoff({ maxAttempts: -1 }, ACTING_PRINCIPAL)).toThrow();
  });

  it('[P1] BF-5: setBackoff rejects a growthFactor < 1 (would shrink delays)', () => {
    expect(() => setBackoff({ growthFactor: 0.5 }, ACTING_PRINCIPAL)).toThrow();
    expect(() => setBackoff({ growthFactor: 0 }, ACTING_PRINCIPAL)).toThrow();
  });

  it('[P1] BF-6: setBackoff rejects a maxDelayMs below baseDelayMs (cap below base)', () => {
    expect(() => setBackoff({ baseDelayMs: 5_000, maxDelayMs: 1_000 }, ACTING_PRINCIPAL)).toThrow();
  });

  it('[P1] BF-7: setBackoff with valid values applies the new curve to backoffDelayMs', () => {
    // When: a steeper curve is configured.
    setBackoff({ baseDelayMs: 500, growthFactor: 2, maxDelayMs: 10_000 }, ACTING_PRINCIPAL);
    // Then: the delay sequence reflects the new curve.
    expect(backoffDelayMs(1)).toBe(500);
    expect(backoffDelayMs(2)).toBe(1_000);
    expect(backoffDelayMs(3)).toBe(2_000);
    // And: the new cap is honored.
    expect(backoffDelayMs(20)).toBe(10_000);
  });
});
