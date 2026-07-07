/**
 * Story 2.11 — `<AuditOfflineBoundary>` wiring test (ADR-0029 §5, AC #5).
 *
 * Verifies that the web UI maps a `/query` 503 response with
 * `reason: "audit_offline"` to the honest-non-claim degraded state.
 *
 * @rules ADR-0029 §5, ADR-001 §6, UX-DR56
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AuditOfflineBoundary, isAuditOfflineBody } from './audit-offline';

const AUDIT_OFFLINE_BODY = {
  error: {
    code: 'degraded' as const,
    reason: 'audit_offline' as const,
    message: 'IIP cannot reach its audit services right now.',
    poll_latency_ms: 42,
  },
};

describe('Story 2.11 — AuditOfflineBoundary (AC #5)', () => {
  it('renders AuditOfflineState when the response body is audit_offline', () => {
    const { getByTestId, queryByText } = render(
      <AuditOfflineBoundary responseBody={AUDIT_OFFLINE_BODY}>
        <div>Claim surface</div>
      </AuditOfflineBoundary>,
    );

    expect(getByTestId('audit-offline-state')).toBeDefined();
    expect(queryByText('Claim surface')).toBeNull();
  });

  it('passes poll_latency_ms through to the degraded state', () => {
    const { getByText } = render(
      <AuditOfflineBoundary responseBody={AUDIT_OFFLINE_BODY}>
        <div>Claim surface</div>
      </AuditOfflineBoundary>,
    );

    expect(getByText(/Last health-check latency: 42ms/)).toBeDefined();
  });

  it('renders children when the response body is not audit_offline', () => {
    const { getByText, queryByTestId } = render(
      <AuditOfflineBoundary responseBody={{ claims: [] }}>
        <div>Claim surface</div>
      </AuditOfflineBoundary>,
    );

    expect(getByText('Claim surface')).toBeDefined();
    expect(queryByTestId('audit-offline-state')).toBeNull();
  });

  it('renders children when the response body is null', () => {
    const { getByText, queryByTestId } = render(
      <AuditOfflineBoundary responseBody={null}>
        <div>Claim surface</div>
      </AuditOfflineBoundary>,
    );

    expect(getByText('Claim surface')).toBeDefined();
    expect(queryByTestId('audit-offline-state')).toBeNull();
  });

  it('isAuditOfflineBody rejects malformed bodies', () => {
    expect(isAuditOfflineBody(AUDIT_OFFLINE_BODY)).toBe(true);
    expect(isAuditOfflineBody({ error: { reason: 'other' } })).toBe(false);
    expect(isAuditOfflineBody(null)).toBe(false);
    expect(isAuditOfflineBody(undefined)).toBe(false);
  });
});
