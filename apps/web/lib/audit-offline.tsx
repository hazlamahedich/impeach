/**
 * Audit-offline boundary — minimal wiring for `<AuditOfflineState>`
 * (Story 2.11, ADR-0029 §5, AC #5).
 *
 * Maps a `/query` 503 response with `reason: "audit_offline"` to the honest-non-claim
 * degraded UI. This is intentionally thin so Epic 5's query UI can reuse the same
 * boundary/hook without throwing away work.
 *
 * @rules ADR-0029 §5, ADR-001 §6, UX-DR56
 */

import type { ReactNode } from 'react';
import { AuditOfflineState } from '@/components/iip/audit-offline-state';

/** Shape of the structured 503 body emitted by `apps/api/src/routes/query.ts`. */
export interface AuditOfflineResponse {
  readonly error: {
    readonly code: 'degraded';
    readonly reason: 'audit_offline';
    readonly message: string;
    readonly poll_latency_ms: number;
  };
}

/** Type guard for the 503 audit-offline body. */
export function isAuditOfflineBody(body: unknown): body is AuditOfflineResponse {
  if (typeof body !== 'object' || body === null) return false;
  const record = body as Record<string, unknown>;
  const error = record['error'];
  if (typeof error !== 'object' || error === null) return false;
  return (error as Record<string, unknown>)['reason'] === 'audit_offline';
}

/** Props for the boundary component. */
export interface AuditOfflineBoundaryProps {
  /** Children rendered when audit is online. */
  readonly children: ReactNode;
  /**
   * The parsed JSON body of the `/query` response. When it carries
   * `reason: "audit_offline"`, the boundary renders `<AuditOfflineState>`.
   */
  readonly responseBody: unknown;
}

/**
 * Boundary that renders `<AuditOfflineState>` when the backend reports the
 * audit path is unreachable. Pass the parsed `/query` response body; anything
 * else falls through to `children`.
 */
export function AuditOfflineBoundary({
  children,
  responseBody,
}: AuditOfflineBoundaryProps): ReactNode {
  if (isAuditOfflineBody(responseBody)) {
    return (
      <AuditOfflineState pollLatencyMs={responseBody.error.poll_latency_ms} />
    );
  }
  return children;
}
