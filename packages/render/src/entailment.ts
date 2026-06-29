/**
 * Entailment checker implementations for the render gate (AC #5).
 *
 * Story 2.1 ships {@link StubEntailmentChecker} — a no-op pass-through. A
 * model-backed NLI cross-encoder / LLM check swaps in later (no gate refactor
 * required) by implementing the same {@link EntailmentChecker} interface.
 *
 * @rules AC-2, EI-1
 * @adr ADR-001
 */

import type { EntailmentChecker } from '@iip/contracts';

/**
 * No-op entailment checker — always returns `entailed: true`.
 *
 * The substring exact-match prefilter (AC #5) is the load-bearing check in 2.1;
 * this stub satisfies the structural interface so the gate chain is complete.
 */
export class StubEntailmentChecker implements EntailmentChecker {
  async check(): Promise<{ entailed: boolean; score?: number }> {
    return { entailed: true };
  }
}
