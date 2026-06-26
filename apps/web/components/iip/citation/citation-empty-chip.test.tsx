// target-path: apps/web/components/iip/citation/citation-empty-chip.test.tsx
// Story 1.8 Citation compound component (UX-DR9, AC-2 boundary)
// Refs: UX-DR9, AC-2, STR-8
// @rules AC-2, STR-8

import { describe, it, expect } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import { Citation, CitationContext } from '@/components/iip/citation';
import type { CitationProvenance } from '@iip/contracts';

const baseProvenance: CitationProvenance = {
  sourceDocId: '00000000-0000-4000-8000-000000000001',
  spanStart: 0,
  spanEnd: 30,
  contentHash: 'a'.repeat(64),
  sourceVerb: 'documents',
  sourceTier: 'primary',
  sourceTitle: 'Senate Roll Call 2024-001',
  url: 'https://example.com/source',
};

describe('Story 1.8 — <Citation> compound primitive (UX-DR9, AC-2 boundary)', () => {
  it('renders <Citation.Empty> by default when no provenance', () => {
    // AC-2 at component boundary: no provenance renders the Empty state.
    const { queryByTestId, getByTestId } = render(
      <CitationContext.Provider value={null}>
        <Citation />
      </CitationContext.Provider>,
    );
    expect(getByTestId('citation-empty')).toBeInTheDocument();
    expect(queryByTestId('citation-chip')).toBeNull();
  });

  it('promotes to <Citation.Chip> only when provenance resolves (incl. url)', () => {
    const { getByTestId, queryByTestId } = render(
      <CitationContext.Provider value={baseProvenance}>
        <Citation.Chip />
      </CitationContext.Provider>,
    );
    expect(getByTestId('citation-chip')).toBeInTheDocument();
    expect(queryByTestId('citation-empty')).toBeNull();
  });

  it('Chip renders as role=link with aria-label (WCAG 2.1 AA — never a <span>)', () => {
    const { getByRole } = render(
      <CitationContext.Provider value={baseProvenance}>
        <Citation.Chip />
      </CitationContext.Provider>,
    );
    const link = getByRole('link');
    expect(link.getAttribute('aria-label')).toMatch(/Source: documents Senate Roll Call 2024-001 \(primary\)/);
    expect(link.getAttribute('aria-haspopup')).toBe('dialog');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('Chip degrades to a non-interactive no-url stub when url is missing (UX-DR9 edge case)', () => {
    const { getByTestId, queryByTestId, queryByRole } = render(
      <CitationContext.Provider value={{ ...baseProvenance, url: undefined }}>
        <Citation.Chip />
      </CitationContext.Provider>,
    );
    const chip = getByTestId('citation-chip-no-url');
    expect(chip.getAttribute('aria-label')).toMatch(/\(link unavailable\)$/);
    expect(queryByTestId('citation-chip')).toBeNull();
    expect(queryByRole('link')).toBeNull();
  });

  it('<Citation.Modal> stub opens on chip click and surfaces title, badge, verb, passage, disabled doc link', () => {
    const { getByTestId, queryByTestId } = render(
      <CitationContext.Provider value={baseProvenance}>
        <Citation.Chip />
      </CitationContext.Provider>,
    );

    // Modal is absent until the chip is activated.
    expect(queryByTestId('citation-modal')).toBeNull();
    fireEvent.click(getByTestId('citation-chip'));

    const modal = getByTestId('citation-modal');
    expect(modal.textContent).toContain('Senate Roll Call 2024-001');
    const modalScope = within(modal);
    expect(modalScope.getByTestId('trust-badge')).toBeDefined();
    expect(modalScope.getByTestId('source-verb-tag')).toBeDefined();
    expect(modal.textContent).toMatch(/Passage text loads from document store/);

    const viewDoc = getByTestId('citation-modal-view-doc');
    expect(viewDoc.getAttribute('aria-disabled')).toBe('true');

    // Esc dismisses the modal.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(queryByTestId('citation-modal')).toBeNull();
  });
});
