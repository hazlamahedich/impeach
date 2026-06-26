'use client';

/**
 * Central nuqs URL-parameter registry — UX-DR30, STR-10.
 *
 * The URL is a public API for journalists: every query parameter name and
 * parser lives in this single file so there is no drift across surfaces.
 * Adding a param is a one-line edit here; consumers import only the hook they
 * need.
 *
 * @rules STR-10, UX-DR30
 */

import { parseAsString, useQueryState } from 'nuqs';

// ─────────────────────────────────────────────────────────────────────────────
// Parser definitions (typed, with explicit defaults)
// ─────────────────────────────────────────────────────────────────────────────

/** `?seed=` — corpus seed / search anchor (empty = none). */
export const seedParser = parseAsString.withDefault('');

/** `?renderer=` — graph renderer tier (cytoscape | reactflow | sigma). */
export const rendererParser = parseAsString.withDefault('cytoscape');

/** `?active=` — active entity/claim id (empty = none). */
export const activeParser = parseAsString.withDefault('');

/** `?mode=` — graph exploration mode (trace | explore | query | temporal). */
export const modeParser = parseAsString.withDefault('trace');

/** `?from=` — timeline range start (ISO date, empty = unbounded). */
export const fromParser = parseAsString.withDefault('');

/** `?to=` — timeline range end (ISO date, empty = unbounded). */
export const toParser = parseAsString.withDefault('');

/** `?q=` — chat/search free-text query (empty = none). */
export const qParser = parseAsString.withDefault('');

// ─────────────────────────────────────────────────────────────────────────────
// Typed hooks (one per parameter — consumers import only what they need)
// ─────────────────────────────────────────────────────────────────────────────

/** `?seed=` — corpus seed / search anchor. */
export function useSeedState() {
  return useQueryState('seed', seedParser);
}

/** `?renderer=` — graph renderer tier. */
export function useRendererState() {
  return useQueryState('renderer', rendererParser);
}

/** `?active=` — active entity/claim id. */
export function useActiveState() {
  return useQueryState('active', activeParser);
}

/** `?mode=` — graph exploration mode. */
export function useModeState() {
  return useQueryState('mode', modeParser);
}

/** `?from=` — timeline range start. */
export function useFromState() {
  return useQueryState('from', fromParser);
}

/** `?to=` — timeline range end. */
export function useToState() {
  return useQueryState('to', toParser);
}

/** `?q=` — chat/search free-text query. */
export function useQueryStateParam() {
  return useQueryState('q', qParser);
}
