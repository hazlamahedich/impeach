/**
 * Story 1.9 — State Management Foundation & Navigation Shell (UX-DR28-34, 43).
 *
 * ATDD scaffold rewritten from scratch (NOT copied from the pre-authored file,
 * which had critical ESM/CJS + API defects — see story Dev Notes). This file is
 * the executable specification: it drives the red→green cycle across all six
 * acceptance criteria.
 *
 * @rules STR-9, STR-10, UX-DR29, UX-DR30, UX-DR31, UX-DR32, UX-DR43
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// apps/web/  — used for source-file existence/content assertions.
const WEB_ROOT = join(__dirname, '..', '..');
// monorepo root — used for repo-level config checks (ESLint, CI).
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

function readWeb(rel: string): string {
  return readFileSync(join(WEB_ROOT, rel), 'utf8');
}

function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// AC #3 — nuqs URL parameter registry (UX-DR30, STR-10)
// ─────────────────────────────────────────────────────────────────────────────
describe('Story 1.9 — URL keys registry (UX-DR30, STR-10)', () => {
  it('lib/state/url-keys.ts is the single nuqs registry with all 7 params', () => {
    const registry = readWeb('lib/state/url-keys.ts');
    const requiredKeys = ['seed', 'renderer', 'active', 'mode', 'from', 'to', 'q'];
    for (const key of requiredKeys) {
      expect(registry).toContain(key);
    }
  });

  it('uses parseAsString.withDefault for typed defaults', () => {
    const registry = readWeb('lib/state/url-keys.ts');
    expect(registry).toContain('parseAsString');
    expect(registry).toContain('withDefault');
    // cytoscape is the default renderer
    expect(registry).toContain('cytoscape');
    // trace is the default mode
    expect(registry).toContain('trace');
  });

  it('exports one useQueryState hook per parameter', async () => {
    const mod = await import('@/lib/state/url-keys');
    const exports = mod as unknown as Record<string, unknown>;
    const hookNames = [
      'useSeedState',
      'useRendererState',
      'useActiveState',
      'useModeState',
      'useFromState',
      'useToState',
      'useQueryStateParam',
    ];
    for (const name of hookNames) {
      expect(typeof exports[name]).toBe('function');
    }
  });

  it('is marked as a client module', () => {
    expect(readWeb('lib/state/url-keys.ts').startsWith("'use client'")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC #1 — HTTP wrapper + fetch ban (UX-DR31)
// ─────────────────────────────────────────────────────────────────────────────
describe('Story 1.9 — lib/api.ts HTTP wrapper (UX-DR31)', () => {
  it('lib/api.ts exists with AbortController + retry logic', () => {
    const api = readWeb('lib/api.ts');
    expect(api).toMatch(/AbortController|AbortSignal/);
    expect(api).toMatch(/retry/i);
    expect(api).toMatch(/exponential|backoff/i);
  });

  it('apiFetch is the exported wrapper function', async () => {
    const mod = await import('@/lib/api');
    expect(typeof mod.apiFetch).toBe('function');
  });

  it('does NOT retry on 4xx client errors', async () => {
    const mod = await import('@/lib/api');
    // Simulate a 404 response — should NOT retry.
    const calls: number[] = [];
    const fake404 = (): Promise<Response> => {
      calls.push(calls.length);
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    };
    await expect(
      mod.apiFetch('https://example.com/test', {
        fetchImpl: fake404,
        retry: 3,
        retryDelay: () => 0,
      }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it('retries on 5xx server errors up to the limit', async () => {
    const mod = await import('@/lib/api');
    const calls: number[] = [];
    const fake500 = (): Promise<Response> => {
      calls.push(calls.length);
      return Promise.resolve(new Response('Server Error', { status: 500 }));
    };
    await expect(
      mod.apiFetch('https://example.com/test', {
        fetchImpl: fake500,
        retry: 3,
        retryDelay: () => 0,
      }),
    ).rejects.toThrow();
    // 1 initial + 3 retries = 4 total attempts.
    expect(calls).toHaveLength(4);
  });

  it('ESLint config bans raw fetch in apps/web (no-restricted-syntax)', () => {
    const eslint = readRepo('eslint.config.js');
    expect(eslint).toMatch(/no-restricted-syntax/);
    expect(eslint).toMatch(/fetch/);
    expect(eslint).toMatch(/web/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC #2 — Zustand ephemeral interaction stores (UX-DR29, STR-9)
// ─────────────────────────────────────────────────────────────────────────────
describe('Story 1.9 — Zustand stores (UX-DR29, STR-9)', () => {
  const stores = [
    { name: 'graph-store', state: ['selectedNodeId', 'activeNodeId'], actions: ['selectNode', 'clearSelection'] },
    { name: 'timeline-store', state: ['dateRange'], actions: ['setDateRange', 'clearFilters'] },
    { name: 'chat-store', state: ['draftInput'], actions: ['setDraft', 'clearDraft'] },
    { name: 'citation-store', state: ['activeCitationId', 'isModalOpen'], actions: ['openCitation', 'closeCitation'] },
  ] as const;

  it.each(stores)('$name exists as a Zustand store with getState + reset', async ({ name }) => {
    const mod = await import(`@/lib/state/${name}`);
    expect(mod.default).toBeDefined();
    expect(typeof mod.default.getState).toBe('function');
    expect(typeof mod.reset).toBe('function');
  });

  it.each(stores)('$name exposes expected state + actions', async ({ name, state, actions }) => {
    const mod = await import(`@/lib/state/${name}`);
    const storeState = mod.default.getState();
    for (const field of state) {
      expect(field in storeState).toBe(true);
    }
    for (const action of actions) {
      expect(typeof storeState[action]).toBe('function');
    }
  });

  it('graph-store uses shared types from lib/graph/types.ts (STR-9)', () => {
    const typesFile = readWeb('lib/graph/types.ts');
    expect(typesFile).toMatch(/GraphNode/);
    expect(typesFile).toMatch(/GraphEdge/);
    expect(typesFile).toMatch(/SelectionState/);
  });

  it('reset() restores initial state', async () => {
    const mod = await import('@/lib/state/chat-store');
    mod.default.getState().setDraft('hello');
    expect(mod.default.getState().draftInput).toBe('hello');
    mod.reset();
    expect(mod.default.getState().draftInput).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC #4 — Navigation shell (UX-DR32, UX-DR43)
// ─────────────────────────────────────────────────────────────────────────────
describe('Story 1.9 — Navigation shell (UX-DR32, UX-DR43)', () => {
  it('SkipToContent renders a visually-hidden skip link targeting #content', async () => {
    const { SkipToContent } = await import('@/components/layout/skip-to-content');
    const { container } = render(<SkipToContent />);
    const link = container.querySelector('a[href="#content"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toMatch(/skip to content/i);
    // Must be sr-only until focused.
    expect(link?.className).toMatch(/sr-only/);
  });

  it('sidebar.tsx has responsive breakpoints (xl labels, lg icon-rail, Sheet)', () => {
    const sidebar = readWeb('components/layout/sidebar.tsx');
    expect(sidebar).toMatch(/xl:/);
    expect(sidebar).toMatch(/Sheet|sheet/i);
  });

  it('sidebar links to /chat, /graph, /timeline, /evidence, /senators', () => {
    const sidebar = readWeb('components/layout/sidebar.tsx');
    for (const route of ['/chat', '/graph', '/timeline', '/evidence', '/senators']) {
      expect(sidebar).toContain(route);
    }
  });

  it('top-bar.tsx holds the essence sentence (truncated), theme toggle, command palette', () => {
    const topbar = readWeb('components/layout/top-bar.tsx');
    expect(topbar).toMatch(/line-clamp-1/);
    expect(topbar).toMatch(/Every claim IIP shows you/);
    expect(topbar).toMatch(/useTheme|next-themes|ThemeProvider/);
    expect(topbar).toMatch(/command|cmdk|CommandDialog/i);
  });

  it('navigation-shell.tsx composes TopBar + Sidebar + main#content + ErrorBoundary', () => {
    const shell = readWeb('components/layout/navigation-shell.tsx');
    expect(shell).toMatch(/TopBar/);
    expect(shell).toMatch(/Sidebar/);
    expect(shell).toMatch(/id="content"/);
    expect(shell).toMatch(/ErrorBoundary|errorBoundary/i);
  });

  it('keyboard-shortcuts.tsx wires g c / g g / g t / g e / g s + Cmd+K', () => {
    const kb = readWeb('components/layout/keyboard-shortcuts.tsx');
    expect(kb).toMatch(/\/chat/);
    expect(kb).toMatch(/\/graph/);
    expect(kb).toMatch(/\/timeline/);
    expect(kb).toMatch(/\/evidence/);
    expect(kb).toMatch(/\/senators/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC #1 + #5 — React Query 5.x providers (UX-DR31)
// ─────────────────────────────────────────────────────────────────────────────
describe('Story 1.9 — React Query 5.x wired (UX-DR31)', () => {
  it('providers.tsx configures QueryClient with staleTime + retry defaults', () => {
    const providers = readWeb('app/providers.tsx');
    expect(providers).toMatch(/QueryClient/);
    expect(providers).toMatch(/30_000|30000/);
    expect(providers).toMatch(/retry/);
  });

  it('providers.tsx is a client component wrapping QueryClientProvider', () => {
    const providers = readWeb('app/providers.tsx');
    expect(providers.startsWith("'use client'")).toBe(true);
    expect(providers).toMatch(/QueryClientProvider/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC #5 — layout.tsx remains a Server Component
// ─────────────────────────────────────────────────────────────────────────────
describe('Story 1.9 — layout composition (AC #5)', () => {
  it('layout.tsx imports Providers + NavigationShell + SkipToContent + KeyboardShortcuts', () => {
    const layout = readWeb('app/layout.tsx');
    expect(layout).toMatch(/Providers/);
    expect(layout).toMatch(/NavigationShell/);
    expect(layout).toMatch(/SkipToContent/);
    expect(layout).toMatch(/KeyboardShortcuts/);
  });

  it('layout.tsx has NO "use client" directive (stays a Server Component)', () => {
    const layout = readWeb('app/layout.tsx');
    expect(layout.startsWith("'use client'")).toBe(false);
  });
});
