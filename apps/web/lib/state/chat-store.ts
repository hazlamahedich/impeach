/**
 * Chat store — ephemeral draft input for the Q&A chat surface (UX-DR29).
 *
 * @rules UX-DR29
 */

'use client';

import { create } from 'zustand';

interface ChatStore {
  draftInput: string;
  setDraft: (input: string) => void;
  clearDraft: () => void;
}

const useChatStore = create<ChatStore>((set) => ({
  draftInput: '',
  setDraft: (input: string) => set({ draftInput: input }),
  clearDraft: () => set({ draftInput: '' }),
}));

export default useChatStore;

/** Reset to initial state — called in vitest `afterEach` for test isolation. */
export function reset(): void {
  useChatStore.setState({ draftInput: '' });
}
