// target-path: apps/web/components/iip/trust-badge/trust-badge.test.tsx
// Story 1.8 <TrustBadge> (UX-DR11, WCAG 2.1 AA)
// @rules STR-10

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TrustBadge } from '@/components/iip/trust-badge';

describe('Story 1.8 — <TrustBadge> (UX-DR11)', () => {
  it.each([
    ['verified', 'Verified'],
    ['contradicted', 'Contradicted'],
    ['caution', 'Caution'],
  ] as const)('renders %s variant with icon + label (never color-only)', (tier, label) => {
    // WCAG 2.1 AA: three redundant channels — colour + icon + text label.
    const { getByRole, getByTestId } = render(
      <TrustBadge tier={tier} sourceCount={3} />,
    );
    const img = getByRole('img');
    expect(img.getAttribute('aria-label')).toMatch(new RegExp(`^${label} — `));
    expect(getByTestId(`trust-icon-${tier}`)).toBeInTheDocument();
    expect(img.textContent ?? getByTestId('trust-badge').textContent).toMatch(new RegExp(label, 'i'));
  });

  it('caution tier references the --trust-tier-caution token (no raw hex)', () => {
    const { getByTestId } = render(<TrustBadge tier="caution" sourceCount={1} />);
    // jsdom does not compute Tailwind classes into computed style; assert the
    // component references the semantic token utility rather than a raw hex.
    expect(getByTestId('trust-badge').className).toMatch(/trust-tier-caution/);
  });

  it('insufficient tier renders a muted badge with an icon (fallback channel)', () => {
    const { getByRole, getByTestId } = render(<TrustBadge tier="insufficient" sourceCount={0} />);
    expect(getByRole('img').getAttribute('aria-label')).toMatch(/^Insufficient — /);
    expect(getByTestId('trust-icon-insufficient')).toBeInTheDocument();
  });
});
