/**
 * Citation store — ephemeral UI interaction state for the citation modal
 * (UX-DR29).
 *
 * This store tracks *which* citation is currently active/clicked and whether
 * the modal is open. It coexists with the `CitationProvider` (React Context
 * from Story 1.8): the Context resolves *provenance data* for a citation id;
 * this store tracks the *interaction state* (which id is active, modal open).
 * They serve different purposes and do not conflict.
 *
 * @rules UX-DR29
 */

'use client';

import { create } from 'zustand';

interface CitationStore {
  activeCitationId: string | null;
  isModalOpen: boolean;
  openCitation: (citationId: string) => void;
  closeCitation: () => void;
}

const useCitationStore = create<CitationStore>((set) => ({
  activeCitationId: null,
  isModalOpen: false,
  openCitation: (citationId: string) =>
    set({ activeCitationId: citationId, isModalOpen: true }),
  closeCitation: () => set({ isModalOpen: false }),
}));

export default useCitationStore;

/** Reset to initial state — called in vitest `afterEach` for test isolation. */
export function reset(): void {
  useCitationStore.setState({ activeCitationId: null, isModalOpen: false });
}
