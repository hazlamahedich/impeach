/**
 * <AuditOfflineState> — the honest-non-claim degraded state for audit-death
 * (Story 2.11, ADR-0029 §5, AC #5).
 *
 * When `/query` returns `503` with `reason: "audit_offline"`, the web frontend
 * renders this component instead of a claim surface. It is the user-facing half
 * of the fail-closed contract: no claim is served, and the audience is told
 * WHY — explicitly framed as a safety measure, not an error (ADR-001 §6:
 * honest non-claim > wrong claim).
 *
 * Search-only functionality (document listing without extracted claims)
 * remains available and is advertised here, because `/search` is a non-claim
 * path and is not gated by the fresh audit-health poll (AC #2).
 *
 * `aria-live="assertive"` (UX-DR56) so assistive tech announces the degraded
 * state immediately.
 *
 * @rules ADR-0029 §5, ADR-001 §6, UX-DR56, SEC-5
 * @adr ADR-0029
 */

import type { ReactNode } from 'react';

export interface AuditOfflineStateProps {
  /** Optional poll latency in ms from the 503 body, surfaced for transparency. */
  pollLatencyMs?: number;
}

const HEADLINE = 'Audit services unreachable';
const MESSAGE =
  'IIP cannot reach its audit services right now. No claims are being served — this is a safety measure, not an error.';
const SEARCH_NOTE =
  'Search-only functionality (document listing without extracted claims) remains available.';

export function AuditOfflineState({ pollLatencyMs }: AuditOfflineStateProps): ReactNode {
  return (
    <div
      role="status"
      aria-live="assertive"
      className="py-6"
      data-testid="audit-offline-state"
    >
      <h2 className="text-display-sm font-display text-defamation-risk-caution">
        {HEADLINE}
      </h2>
      <p className="mt-2 text-body-md font-sans text-muted-foreground">{MESSAGE}</p>
      <p className="mt-2 text-body-sm font-sans text-muted-foreground">{SEARCH_NOTE}</p>
      {pollLatencyMs !== undefined ? (
        <p className="mt-1 text-body-sm font-sans text-muted-foreground">
          Last health-check latency: {pollLatencyMs}ms.
        </p>
      ) : null}
    </div>
  );
}

export { HEADLINE as AUDIT_OFFLINE_HEADLINE, MESSAGE as AUDIT_OFFLINE_MESSAGE };
