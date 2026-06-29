/**
 * ReplayDetector — atomic check-and-record for JWT jti replay prevention (SEC-1).
 *
 * `checkAndRecord(jti, exp)` returns `true` if the jti is new (first sighting)
 * and records it for future replay detection. Returns `false` if the jti has
 * already been seen — a replay attack indicator.
 *
 * The atomic guarantee is critical: a TOCTOU gap between "check" and "record"
 * allows two concurrent requests with the same token to both succeed.
 * Implementations MUST use `SETNX` (Redis) or a mutex-guarded `Map` (in-memory).
 *
 * @rules SEC-1
 * @adr ADR-0001
 */
import type { Jti } from '@iip/contracts';

/**
 * Interface for replay detection backends.
 *
 * Production uses Redis with key TTL = `exp - now`. Dev/testing uses
 * {@link InMemoryReplayDetector} with TTL-based eviction.
 *
 * @rules SEC-1
 */
export interface ReplayDetector {
  /**
   * Atomically check if `jti` has been seen and record it if not.
   *
   * @param jti  The JWT ID to check.
   * @param exp  Token expiry (Unix seconds) — used to compute cache TTL.
   * @returns    `true` if this is a new (valid) jti; `false` if replayed.
   */
  checkAndRecord(jti: Jti, exp: number): Promise<boolean>;
}

/**
 * In-memory replay detector for dev/testing.
 *
 * Uses a `Map<Jti, expiresAt>` with TTL-based eviction. Entries are
 * removed when `Date.now() > expiresAt` to keep the cache bounded by
 * the token TTL (≤1h).
 *
 * NOT suitable for multi-process production — use the Redis backend.
 *
 * @rules SEC-1
 */
export class InMemoryReplayDetector implements ReplayDetector {
  private readonly seen = new Map<string, number>();
  private readonly nowMs: () => number;

  constructor(nowMs: () => number = Date.now) {
    this.nowMs = nowMs;
  }

  async checkAndRecord(jti: Jti, exp: number): Promise<boolean> {
    const key = jti as string;
    const currentMs = this.nowMs();

    // Evict expired entries on every access (amortised cleanup).
    for (const [k, expiresAt] of this.seen) {
      if (expiresAt <= currentMs) {
        this.seen.delete(k);
      }
    }

    // Atomic check-and-insert: if the key exists (and hasn't expired), it's a replay.
    if (this.seen.has(key)) {
      return false;
    }

    // exp is in seconds; convert to milliseconds for the cache entry.
    this.seen.set(key, exp * 1000);
    return true;
  }
}
