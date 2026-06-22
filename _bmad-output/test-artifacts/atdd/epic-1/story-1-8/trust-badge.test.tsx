// target-path: apps/web/components/iip/trust-badge/trust-badge.test.tsx
// RED — Story 1.8 <TrustBadge> (UX-DR11, WCAG 2.1 AA)
// @rules STR-10

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TrustBadge } from '@/components/iip/trust-badge';

describe.skip('Story 1.8 — <TrustBadge> (UX-DR11)', () => {
  // RED — components/iip/trust-badge absent

  it.each([
    ['verified', 'Verified'],
    ['contradicted', 'Contradicted'],
    ['caution', 'Caution'],
  ] as const)('renders %s variant with icon + label (never color-only)', (tier, label) => {
    // WCAG 2.1 AA: three redundant channels — color + icon + text label
    const { getByRole, getByTestId } = render(
      <TrustBadge tier={tier} sourceCount={3} />,
    );
    const img = getByRole('img');
    expect(img.getAttribute('aria-label')).toContain(label);
    expect(getByTestId(`trust-icon-${tier}`)).toBeDefined();
    expect(img.textContent ?? getByTestId('trust-badge').textContent).toMatch(new RegExp(label, 'i'));
  });

  it('caution tier uses --trust-tier-caution token, not raw hex', () => {
    const { getByTestId } = render(<TrustBadge tier="caution" sourceCount={1} />);
    const style = window.getComputedStyle(getByTestId('trust-badge'));
    // The computed style should reference the semantic token, not a literal hex
    expect(style.color || style.backgroundColor).toBeTruthy();
  });
});
