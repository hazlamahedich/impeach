// target-path: apps/web/components/iip/citation/citation-empty-chip.test.tsx
// RED — Story 1.8 Citation compound component (UX-DR9, AC-2 boundary)
// Refs: UX-DR9, AC-2, STR-8
// @rules AC-2, STR-8

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Citation, CitationContext } from '@/components/iip/citation';

describe.skip('Story 1.8 — <Citation> compound primitive (UX-DR9, AC-2 boundary)', () => {
  // RED — components/iip/citation absent

  it('renders <Citation.Empty> by default when no provenance', () => {
    // AC-2 at component boundary: claim with no citation renders the Empty state, never the claim text bare
    const { queryByTestId, getByTestId } = render(
      <CitationContext.Provider value={undefined}>
        <Citation />
      </CitationContext.Provider>,
    );
    expect(getByTestId('citation-empty')).toBeDefined();
    expect(queryByTestId('citation-chip')).toBeNull();
  });

  it('promotes to <Citation.Chip> only when provenance resolves', () => {
    const provenance = {
      sourceDocId: '00000000-0000-4000-8000-000000000001',
      spanStart: 0, spanEnd: 30,
      sourceVerb: 'documents',
      sourceTier: 'primary' as const,
      sourceTitle: 'Senate Roll Call 2024-001',
    };
    const { getByTestId, queryByTestId } = render(
      <CitationContext.Provider value={provenance}>
        <Citation.Chip />
      </CitationContext.Provider>,
    );
    expect(getByTestId('citation-chip')).toBeDefined();
    expect(queryByTestId('citation-empty')).toBeNull();
  });

  it('Chip renders as role=link with aria-label (WCAG 2.1 AA — never a <span>)', () => {
    // Citation IS the verification path; a span strips it from screen readers + keyboard
    const { getByRole } = render(
      <CitationContext.Provider value={{
        sourceDocId: 'doc-1', spanStart: 0, spanEnd: 30,
        sourceVerb: 'documents', sourceTier: 'primary', sourceTitle: 'Title',
        url: 'https://example.com/source',
      }}>
        <Citation.Chip />
      </CitationContext.Provider>,
    );
    const link = getByRole('link');
    expect(link.getAttribute('aria-label')).toMatch(/Source: documents Title \(primary\)/);
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
  });
});
