/**
 * Lawful-access gate — the pure decision function over pre-computed signals
 * (FR-1.2, Story 3.2).
 *
 * The gate decides whether a source may be crawled automatically. It is a
 * PURE FUNCTION: it receives the five detection signals (robots.txt status,
 * paywall, login, CAPTCHA, ToS-forbidden flag) and returns an ALLOW or DISABLE
 * decision. The HTTP-fetching + HTML-scanning logic that POPULATES those
 * signals lives in Story 3.3's fetch adapter. This separation keeps the gate
 * trivially testable and free of network I/O.
 *
 * The gate is defamation-adjacent: crawling a paywalled / ToS-forbidden source
 * can contaminate the corpus with unlawfully-obtained evidence, undermining
 * every downstream citation (T1 invariant). The core property is **disable,
 * never bypass**: any single blocking signal disables crawling; only an
 * explicit operator override (AC-4, AC-11-logged) can re-enable a blocked
 * source.
 *
 * Decision matrix (evaluated in priority order — first match wins):
 *  1. robots disallowed        → DISABLE("robots_disallowed")
 *  2. paywall detected         → DISABLE("paywall")
 *  3. login required           → DISABLE("login_required")
 *  4. CAPTCHA required         → DISABLE("captcha")
 *  5. ToS forbids scraping     → DISABLE("tos_forbidden")
 *  6. none of the above        → ALLOW("public_source_robots_allowed")
 *
 * Note on `robots_status = 'unreachable'`: the fetch adapter (Story 3.3) maps
 * an unreachable robots.txt to `robotsCheck.allowed = false` AND reports
 * `robots_status = 'unreachable'` in the persisted result (AC-7 fail-closed).
 * This pure gate sees only `allowed = false`, so an unreachable robots.txt
 * disables via the "robots_disallowed" branch — the distinct `robots_status`
 * value is the provenance marker the route handler persists.
 *
 * @rules FR-1.2, NFR-L-1, SEC-5, AC-1, AC-4, AC-11
 * @adr ADR-0001, ADR-0007
 */
import type { LawfulAccessInput, SourceId } from '@iip/contracts';

/**
 * The gate's decision outcome (FR-1.2).
 *
 * - `'allowed'` — the source passed every check; crawling may be enabled.
 * - `'disable'` — at least one blocking signal fired; crawling is disabled
 *   until an operator override (AC-4).
 *
 * `reason` is the machine-readable reason code (`robots_disallowed`, `paywall`,
 * `login_required`, `captcha`, `tos_forbidden`, `public_source_robots_allowed`).
 * `recordedAt` is the UTC timestamp the decision was computed.
 */
export interface LawfulAccessDecision {
  readonly decision: 'allowed' | 'disable';
  readonly reason: string;
  readonly recordedAt: Date;
}

/**
 * Assess lawful access from pre-computed detection signals (FR-1.2, AC-1).
 *
 * Pure function — no I/O. The decision matrix is evaluated in priority order;
 * the first blocking signal wins (disable, never bypass). When no signal
 * blocks, the source is cleared for crawl.
 *
 * @param input - the five detection signals (see {@link LawfulAccessInput})
 * @returns the gate decision + reason + timestamp
 *
 * @rules FR-1.2, SEC-5, AC-1
 */
export function assessLawfulAccess(input: LawfulAccessInput): LawfulAccessDecision {
  const recordedAt = new Date();

  if (!input.robotsCheck.allowed) {
    return { decision: 'disable', reason: 'robots_disallowed', recordedAt };
  }
  if (input.paywallDetected) {
    return { decision: 'disable', reason: 'paywall', recordedAt };
  }
  if (input.loginRequired) {
    return { decision: 'disable', reason: 'login_required', recordedAt };
  }
  if (input.captchaRequired) {
    return { decision: 'disable', reason: 'captcha', recordedAt };
  }
  if (input.tosForbidden) {
    return { decision: 'disable', reason: 'tos_forbidden', recordedAt };
  }
  return { decision: 'allowed', reason: 'public_source_robots_allowed', recordedAt };
}

/**
 * The editorial-log entry shape emitted by a successful override (AC-4, AC-11).
 *
 * The route handler appends this to the hash-chained editorial log via
 * `makeEntry`; this pure function only DESCRIBES the entry — it does not perform
 * the append (that requires the signing callback, which lives in the route
 * layer). `url` is captured so the audit trail names exactly what was bypassed.
 */
export interface OverrideEditorialLogEntry {
  readonly event: 'source.access_override';
  readonly payload: { readonly source_id: SourceId; readonly url: string; readonly rationale: string };
}

/**
 * The outcome of an override attempt (AC-4).
 *
 * - `{ ok: false }` — the justification was empty; the override is rejected.
 *   An override MUST carry a non-empty rationale (AC-11 attributable bypass).
 * - `{ ok: true, editorialLogEntry }` — the override is accepted; the route
 *   handler persists the override fields + appends the editorial-log entry.
 */
export type OverrideOutcome =
  | { readonly ok: false }
  | { readonly ok: true; readonly editorialLogEntry: OverrideEditorialLogEntry };

/**
 * Override a lawful-access disable (AC-4, AC-11).
 *
 * Pure function — validates the justification and builds the editorial-log
 * entry descriptor. The editorial-log append is performed by the route handler
 * (Task 4), not by this function. The justification MUST be non-empty: an empty
 * justification is rejected (`{ ok: false }`) because an attributable bypass
 * requires a recorded reason (AC-11).
 *
 * @param sourceId - the branded source ID being overridden
 * @param params - `{ justification }` (non-empty) + the source `url` for the
 *   editorial-log payload
 * @returns the override outcome (rejected, or accepted with the log entry)
 *
 * @rules FR-1.2, AC-4, AC-11
 */
export function overrideDisable(
  sourceId: SourceId,
  params: { justification: string; url: string },
): OverrideOutcome {
  // An override bypasses a lawful-access block, so a non-empty justification is
  // mandatory (AC-11). Trim to reject whitespace-only strings.
  if (params.justification.trim() === '') {
    return { ok: false };
  }
  return {
    ok: true,
    editorialLogEntry: {
      event: 'source.access_override',
      payload: {
        source_id: sourceId,
        url: params.url,
        rationale: params.justification,
      },
    },
  };
}
