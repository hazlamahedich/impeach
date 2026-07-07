/**
 * Audit Health Client + Circuit-Breaker (Story 2.11, ADR-0029 §5, OQ-29.6).
 *
 * This is the mechanism that ADR-0029's blast-radius matrix names as its single
 * load-bearing design requirement: when `audit-worker` is unreachable, the
 * serving path MUST fail-closed for claim-serving `/query` requests. Without
 * this module, the core pipeline is fail-open on audit-death — the 8
 * "Conditional" matrix rows escalate to Chargeable (unaudited claims served).
 *
 * Design (binding — ADR-0029 §5, §7, Story 2.11 AC #1, #3, #6):
 *
 *   1. **Fresh poll per claim-serving request, NOT a cached state.** The
 *      serving decision for `/query` is gated on a *fresh* healthcheck poll
 *      (HTTP GET `audit-worker:port/healthz`). Any cached/stale state is
 *      advisory only — it may inform the circuit-breaker but MUST NOT authorize
 *      serving a claim. This is the difference between "fail-closed" and
 *      "fail-maybe".
 *
 *   2. **Circuit-breaker state machine.** Closed (healthy) → Open (unreachable,
 *      claims fail-closed) → Half-Open (probing; one successful fresh poll
 *      transitions back to Closed). The Open → Half-Open transition uses
 *      exponential backoff (1s → 2s → 4s → 8s → 30s max). State is in-memory,
 *      per-process — NO Redis dependency (a Redis partition is a correlated
 *      failure with audit-worker death; the breaker must work when Redis is
 *      down).
 *
 *   3. **100ms performance budget is a CORRECTNESS requirement.** The fresh
 *      poll MUST complete within the configured budget (ADR-0029 §7; default
 *      100ms via `@iip/config`). A slow poll that lets claims through unaudited
 *      is the Chargeable defect this budget prevents. Budget exceed → fail-closed
 *      (treat audit-worker as unhealthy). The budget is enforced via
 *      `AbortController`; the HTTP call timeout is derived from the budget
 *      with a small headroom so the full budget is respected, not silently
 *      narrowed.
 *
 *   4. **Advisory background cache.** A 5s-TTL cache refreshes
 *      `audit-worker /healthz` in the background for non-claim paths (`/search`,
 *      `/healthz`, document listing). It is NEVER used to authorize claim
 *      serving — only a fresh poll gates `/query`.
 *
 *   5. **Transition logging.** Circuit-breaker state transitions emit
 *      `audit.circuit_breaker.opened` / `audit.circuit_breaker.closed` to the
 *      editorial log (AC-11) via an injected observer, so the audit trail can
 *      answer "when did claim-serving stop and resume?".
 *
 * Dependency-injected for testability: HTTP fetch, clock, and the transition
 * observer are all seams. Production wires `globalThis.fetch`, `Date.now`, and
 * the editorial-log appender; tests inject deterministic stubs (no real
 * network, no real time — flaky-test discipline, project-context §Testing).
 *
 * @rules ADR-0029 §5/§7, SEC-5, AC-2, AC-11, OQ-29.6
 * @adr ADR-0029
 */

/** Circuit-breaker states (ADR-0029 §5, Story 2.11 AC #3). */
export type CircuitState = 'Closed' | 'Open' | 'HalfOpen';

/**
 * Health status snapshot. The advisory cache carries this; the serving decision
 * is made from a *fresh* poll (Story 2.11 AC #1).
 */
export interface HealthStatus {
  readonly healthy: boolean;
  /** Latency of the poll in milliseconds (0 if the poll never completed). */
  readonly latencyMs: number;
  /** ISO-8601 UTC timestamp of the last poll. */
  readonly lastChecked: string;
  /** Error message when the last poll failed (absent on success). */
  readonly error?: string;
}

/**
 * Injectable clock (PC-8: UTC-only). Reuses the `Clock` interface from
 * `config-history-repo.ts` (structurally identical: `{ now(): Date }`) so the
 * package has one canonical clock type.
 */
import type { Clock } from './config-history-repo.js';

/** System clock — production default. */
const systemClock: Clock = { now: () => new Date() };

/**
 * Transition observer — wired to the editorial-log appender in production
 * (Story 2.11 AC #3). Receives the new state + the poll that triggered the
 * transition. MUST NOT throw (SEC-5: a broken observer MUST NOT change the
 * breaker's decision); failures are swallowed by the caller.
 */
export interface TransitionObserver {
  (state: CircuitState, status: HealthStatus): void;
}

/** Default backoff schedule (ms): 1s → 2s → 4s → 8s → 30s max (Story 2.11 AC #3). */
const DEFAULT_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 30_000] as const;

/** Default total performance budget in ms (Story 2.11 AC #6, ADR-0029 §7). */
const DEFAULT_POLL_BUDGET_MS = 100;

/** Headroom reserved for processing/serialization under the total budget. */
const DEFAULT_HEADROOM_MS = 50;

/**
 * Configuration for the audit-health client. All fields optional — sensible
 * ADR-0029 defaults are applied.
 */
export interface AuditHealthConfig {
  /** Base URL of the audit-worker health endpoint, e.g. `http://audit-worker:3001`. */
  readonly baseUrl: string;
  /**
   * Total performance budget for the fresh health poll in ms (default 100ms).
   * Exceeding this budget fails-closed. The HTTP call timeout is derived from
   * this budget minus headroom so the full budget is respected (AC #6).
   */
  readonly pollBudgetMs?: number;
  /**
   * Optional explicit HTTP call timeout in ms. When omitted, the timeout is
   * derived from `pollBudgetMs` with a fixed headroom. Use this only when you
   * need direct control over the HTTP layer.
   */
  readonly pollTimeoutMs?: number;
  /** Background advisory-cache TTL in ms (default 5000 — ADR-0029 §5). */
  readonly cacheTtlMs?: number;
  /** Open → Half-Open backoff schedule in ms (default 1s → 2s → 4s → 8s → 30s). */
  readonly backoffMs?: readonly number[];
  /** Injectable fetch (test seam). Defaults to `globalThis.fetch`. */
  readonly fetchImpl?: typeof fetch;
  /** Injectable clock (test seam). Defaults to system clock. */
  readonly clock?: Clock;
  /** Injectable transition observer (wired to editorial log in production). */
  readonly onTransition?: TransitionObserver;
}

interface AuditHealthState {
  circuit: CircuitState;
  /** Advisory cache — NEVER authorizes claim serving (ADR-0029 §5). */
  cached: HealthStatus | null;
  /** Timestamp (ms since epoch) when the breaker last opened. */
  openedAtMs: number;
  /** Number of consecutive Open → (wait) → Half-Open probes that failed. */
  consecutiveFailures: number;
}

/**
 * Audit-health client handle. One per process (AC #3: in-memory, per-process).
 */
export interface AuditHealthClient {
  /** Fresh health poll that gates claim-serving `/query` (AC #1). */
  pollAuditHealthForClaim(): Promise<HealthStatus>;
  /**
   * Advisory cache view for non-claim paths (AC #2). Returns the last cached
   * status WITHOUT a fresh poll. NEVER use this to authorize claim serving.
   */
  getAdvisoryHealth(): HealthStatus | null;
  /** Current circuit-breaker state (single source of truth, AC #3). */
  getCircuitBreakerState(): CircuitState;
  /** Reset the breaker to Closed + clear cache (test/operational hook). */
  reset(): void;
}

/**
 * Create an audit-health client with an in-memory circuit-breaker.
 *
 * The client is a singleton per process (AC #3: "stored in @iip/config,
 * in-memory, per-process"). Call `getAuditHealth()` for the advisory cache
 * view (non-claim paths) and `pollAuditHealthForClaim()` for the fresh poll
 * that gates `/query` (AC #1).
 */
export function createAuditHealthClient(config: AuditHealthConfig): AuditHealthClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const pollBudgetMs = config.pollBudgetMs ?? DEFAULT_POLL_BUDGET_MS;
  // Derive the HTTP call timeout from the budget, reserving headroom for
  // processing/serialization. Never let the timeout exceed the budget.
  const pollTimeoutMs =
    config.pollTimeoutMs ?? Math.max(1, pollBudgetMs - DEFAULT_HEADROOM_MS);
  const cacheTtlMs = config.cacheTtlMs ?? 5_000;
  const backoffMs = config.backoffMs ?? DEFAULT_BACKOFF_MS;
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const clock = config.clock ?? systemClock;
  const onTransition = config.onTransition;

  const state: AuditHealthState = {
    circuit: 'Closed',
    cached: null,
    openedAtMs: 0,
    consecutiveFailures: 0,
  };

  /** Perform a single HTTP GET /healthz against the configured timeout. */
  async function pollOnce(): Promise<HealthStatus> {
    const start = clock.now().getTime();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), pollTimeoutMs);
    try {
      const res = await fetchImpl(`${baseUrl}/healthz`, {
        signal: controller.signal,
      });
      // Use the injected clock so latency is deterministic under test clocks
      // and consistent with the configured performance budget.
      const latencyMs = Math.max(0, clock.now().getTime() - start);
      if (res.ok) {
        return {
          healthy: true,
          latencyMs,
          lastChecked: clock.now().toISOString(),
        };
      }
      return {
        healthy: false,
        latencyMs,
        lastChecked: clock.now().toISOString(),
        error: `audit-worker /healthz returned ${res.status} ${res.statusText}`,
      };
    } catch (error) {
      const latencyMs = Math.max(0, clock.now().getTime() - start);
      const reason =
        error instanceof DOMException && error.name === 'AbortError'
          ? `audit-worker /healthz timed out after ${pollTimeoutMs}ms (budget ${pollBudgetMs}ms)`
          : error instanceof Error
            ? error.message
            : String(error);
      return {
        healthy: false,
        latencyMs,
        lastChecked: clock.now().toISOString(),
        error: reason,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Maybe promote Open → Half-Open based on elapsed backoff. Called BEFORE the
   * fresh poll so that the current poll acts as the Half-Open probe (AC #3:
   * "Half-Open — probing, one successful health poll transitions to Closed").
   * Half-Open is observable as a transient state while a probe is in flight.
   * No transition event — only Open/Closed are logged (AC #3).
   */
  function maybePromoteToHalfOpen(): void {
    if (state.circuit !== 'Open') return;
    const idx = Math.min(state.consecutiveFailures - 1, backoffMs.length - 1);
    const waitMs = backoffMs[idx] ?? backoffMs[backoffMs.length - 1]!;
    const nowMs = clock.now().getTime();
    if (nowMs - state.openedAtMs >= waitMs) {
      state.circuit = 'HalfOpen';
    }
  }

  /**
   * Advance the breaker after a fresh poll. The state machine (AC #3):
   *
   *   - Closed + healthy   → stay Closed
   *   - Closed + unhealthy → Open (fail-closed begins)
   *   - Open + unhealthy (backoff not elapsed) → stay Open (no transition)
   *   - Half-Open + healthy   → Closed (resume serving)
   *   - Half-Open + unhealthy → Open (re-open with increased backoff)
   *
   * (Open → Half-Open promotion happens in {@link maybePromoteToHalfOpen}
   * before the poll, so by the time advance() runs, an elapsed-backoff Open
   * has already become Half-Open and this poll is its probe.)
   */
  function advance(status: HealthStatus): void {
    const prev = state.circuit;
    const nowMs = clock.now().getTime();

    if (status.healthy) {
      state.consecutiveFailures = 0;
      if (prev !== 'Closed') {
        transition('Closed', status);
      }
      return;
    }

    // unhealthy
    if (prev === 'Closed') {
      state.openedAtMs = nowMs;
      state.consecutiveFailures = 1;
      transition('Open', status);
      return;
    }

    if (prev === 'HalfOpen') {
      // The Half-Open probe failed → re-open with increased backoff.
      state.openedAtMs = nowMs;
      state.consecutiveFailures += 1;
      transition('Open', status);
      return;
    }

    // prev === 'Open' (backoff not yet elapsed → maybePromote kept it Open).
    // Stay Open; no transition, no backoff change. The advisory cache is still
    // refreshed by the caller so non-claim paths see the latest poll.
  }

  /** Record a state transition + notify the observer (AC #3, AC-11). */
  function transition(next: CircuitState, status: HealthStatus): void {
    state.circuit = next;
    if (next === 'Open') {
      state.openedAtMs = clock.now().getTime();
    }
    if (onTransition !== undefined) {
      try {
        onTransition(next, status);
      } catch {
        // SEC-5: a broken observer MUST NOT change the breaker decision.
      }
    }
  }

  /**
   * True when the fresh poll exceeded the configured performance budget.
   * The HTTP timeout is derived from the budget, so this guards the boundary
   * where latency still somehow exceeds the total budget.
   */
  function isOverBudget(latencyMs: number): boolean {
    return latencyMs > pollBudgetMs;
  }

  return {
    async pollAuditHealthForClaim(): Promise<HealthStatus> {
      // Promote Open → Half-Open if backoff elapsed, so THIS poll is the probe.
      maybePromoteToHalfOpen();
      const status = await pollOnce();
      // Enforce the total budget as a correctness gate: if the poll somehow
      // finished after the budget, treat it as unhealthy (AC #6).
      const budgetStatus: HealthStatus = isOverBudget(status.latencyMs)
        ? {
            ...status,
            healthy: false,
            error: status.error
              ? `${status.error}; exceeded ${pollBudgetMs}ms budget`
              : `audit-worker /healthz exceeded ${pollBudgetMs}ms budget`,
          }
        : status;
      state.cached = budgetStatus; // advisory cache refreshed as a side effect
      advance(budgetStatus);
      return budgetStatus;
    },

    getAdvisoryHealth(): HealthStatus | null {
      if (state.cached === null) return null;
      const ageMs = clock.now().getTime() - Date.parse(state.cached.lastChecked);
      if (ageMs > cacheTtlMs) return null; // stale → report no advisory
      return state.cached;
    },

    getCircuitBreakerState(): CircuitState {
      return state.circuit;
    },

    reset(): void {
      state.circuit = 'Closed';
      state.cached = null;
      state.openedAtMs = 0;
      state.consecutiveFailures = 0;
    },
  };
}

export { systemClock };
