// target-path: apps/web/components/iip/audit-offline-state/audit-offline-state.test.tsx
// Story 2.11 <AuditOfflineState> (ADR-0029 §5, AC #5)
// @rules ADR-0029 §5, ADR-001 §6, UX-DR56

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AuditOfflineState, AUDIT_OFFLINE_MESSAGE } from '@/components/iip/audit-offline-state';

describe('Story 2.11 — <AuditOfflineState> (ADR-0029 §5, AC #5)', () => {
  it('renders the honest-non-claim message as a safety measure, not an error', () => {
    const { getByText, getByRole } = render(<AuditOfflineState />);
    // AC #5: the canonical message text.
    expect(getByText(AUDIT_OFFLINE_MESSAGE)).toBeDefined();
    // Framed as a status, not an alert-error.
    expect(getByRole('status')).toBeDefined();
  });

  it('uses aria-live="assertive" so assistive tech announces the degraded state (UX-DR56)', () => {
    const { getByRole } = render(<AuditOfflineState />);
    expect(getByRole('status').getAttribute('aria-live')).toBe('assertive');
  });

  it('advertises that search-only functionality remains available (AC #5)', () => {
    const { getByText } = render(<AuditOfflineState />);
    expect(
      getByText(/Search-only functionality.*remains available/),
    ).toBeDefined();
  });

  it('surfaces the poll latency when provided (transparency)', () => {
    const { getByText } = render(<AuditOfflineState pollLatencyMs={50} />);
    expect(getByText(/Last health-check latency: 50ms/)).toBeDefined();
  });

  it('omits the latency line when no pollLatencyMs is provided', () => {
    const { queryByText } = render(<AuditOfflineState />);
    expect(queryByText(/Last health-check latency/)).toBeNull();
  });
});
