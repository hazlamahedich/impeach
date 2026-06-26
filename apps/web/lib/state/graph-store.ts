/**
 * Graph store — ephemeral graph-node selection state (UX-DR29, STR-9).
 *
 * Tracks which node is currently selected/active in the graph explorer UI.
 * Uses shared types from `lib/graph/types.ts` (STR-9) so all three renderers
 * share the same selection contract.
 *
 * @rules STR-9, UX-DR29
 */

'use client';

import { create } from 'zustand';
import type { SelectionState } from '@/lib/graph/types';

interface GraphStore extends SelectionState {
  selectNode: (nodeId: string) => void;
  setActive: (nodeId: string) => void;
  clearSelection: () => void;
}

const initialState: SelectionState = {
  selectedNodeId: null,
  activeNodeId: null,
};

const useGraphStore = create<GraphStore>((set) => ({
  ...initialState,
  selectNode: (nodeId: string) => set({ selectedNodeId: nodeId }),
  setActive: (nodeId: string) => set({ activeNodeId: nodeId }),
  clearSelection: () => set({ selectedNodeId: null, activeNodeId: null }),
}));

export default useGraphStore;

/** Reset to initial state — called in vitest `afterEach` for test isolation. */
export function reset(): void {
  useGraphStore.setState(initialState);
}
