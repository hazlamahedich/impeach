// target-path: apps/web/components/iip/claim/claim-variants.test.tsx
// Story 1.8 <Claim> primitive (UX-DR10, UX-DR36)
// @rules AC-2, STR-8, STR-10

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Claim } from '@/components/iip/claim';

describe('Story 1.8 — <Claim> variants (UX-DR10/UX-DR36)', () => {
  it('variant=fact renders solid border', () => {
    const { getByTestId } = render(
      <Claim variant="fact" citations={[{ sourceDocId: 'd1', spanStart: 0, spanEnd: 1, contentHash: 'x' }]}>
        text
      </Claim>,
    );
    const claim = getByTestId('claim');
    expect(claim.className).toMatch(/claim-fact/);
    expect(claim.className).not.toMatch(/dashed/);
  });

  it('variant=attributed renders dashed border + italic', () => {
    const { getByTestId } = render(
      <Claim variant="attributed" citations={[{ sourceDocId: 'd1', spanStart: 0, spanEnd: 1, contentHash: 'x' }]}>
        text
      </Claim>,
    );
    const claim = getByTestId('claim');
    expect(claim.className).toMatch(/claim-attributed|dashed/);
    expect(claim.className).toMatch(/italic/);
  });

  it('variant=dashed renders strikethrough', () => {
    const { getByTestId } = render(
      <Claim variant="dashed" citations={[{ sourceDocId: 'd1', spanStart: 0, spanEnd: 1, contentHash: 'x' }]}>
        text
      </Claim>,
    );
    const claim = getByTestId('claim');
    expect(claim.className).toMatch(/line-through|strikethrough/);
  });

  it('aria-label prefix tags variant for screen readers (UX-DR36)', () => {
    const { getByRole } = render(
      <Claim variant="fact" citations={[{ sourceDocId: 'd1', spanStart: 0, spanEnd: 1, contentHash: 'x' }]}>
        Senator voted yes
      </Claim>,
    );
    const article = getByRole('article');
    expect(article.getAttribute('aria-label')).toMatch(/^Fact:/);
  });

  it('REFUSES to render with zero citations (AC-2 — "no citation, no claim")', () => {
    // PD-1 essence: a Claim with zero citations is never served as bare text.
    const { getByTestId, queryByText, getByRole } = render(
      <Claim variant="fact" citations={[]}>Senator voted yes</Claim>,
    );
    expect(queryByText('Senator voted yes')).toBeNull();
    expect(getByTestId('trust-badge-insufficient')).toBeInTheDocument();
    expect(getByRole('article').getAttribute('aria-label')).toMatch(/^Fact: .*not shown — no sources/);
  });
});
