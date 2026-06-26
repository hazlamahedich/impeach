/**
 * Timeline store — ephemeral date-range and narrative-beat filter state
 * (UX-DR29).
 *
 * @rules UX-DR29
 */

'use client';

import { create } from 'zustand';

interface DateRange {
  from: string;
  to: string;
}

interface TimelineStore {
  dateRange: DateRange;
  narrativeBeatFilter: string | null;
  setDateRange: (range: DateRange) => void;
  setNarrativeBeatFilter: (beat: string | null) => void;
  clearFilters: () => void;
}

const useTimelineStore = create<TimelineStore>((set) => ({
  dateRange: { from: '', to: '' },
  narrativeBeatFilter: null,
  setDateRange: (range: DateRange) => set({ dateRange: range }),
  setNarrativeBeatFilter: (beat: string | null) => set({ narrativeBeatFilter: beat }),
  clearFilters: () =>
    set({ dateRange: { from: '', to: '' }, narrativeBeatFilter: null }),
}));

export default useTimelineStore;

/** Reset to initial state — called in vitest `afterEach` for test isolation. */
export function reset(): void {
  useTimelineStore.setState({ dateRange: { from: '', to: '' }, narrativeBeatFilter: null });
}
