/**
 * CitationProvider — minimal client wrapper for the root layout (UX-DR9, AC-8).
 *
 * Kept in a separate file so the root layout can import ONLY the provider
 * without pulling the full compound component surface (Chip, Modal, etc.) into
 * the layout client chunk.
 *
 * @rules AC-8, STR-8
 */

'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CitationProvenance } from '@iip/contracts';

export const CitationContext = createContext<CitationProvenance | null>(null);

export function useCitation(): CitationProvenance | null {
  return useContext(CitationContext);
}

export function CitationProvider({
  children,
  value = null,
}: {
  children: ReactNode;
  value?: CitationProvenance | null;
}): ReactNode {
  // Stable context value so memoized leaf surfaces don't re-render when the
  // provider re-renders with the same provenance object.
  const memoizedValue = useMemo(() => value, [value]);
  return <CitationContext.Provider value={memoizedValue}>{children}</CitationContext.Provider>;
}
