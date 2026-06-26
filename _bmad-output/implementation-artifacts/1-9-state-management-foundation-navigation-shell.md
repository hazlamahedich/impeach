---
story_id: '1.9'
story_key: '1-9-state-management-foundation-navigation-shell'
epic: 'Epic 1: Foundation'
status: review
last_updated: '2026-06-26'
baseline_commit: '432f344'
---

# Story 1.9: State Management Foundation & Navigation Shell (UX-DR28-34, 43)

Status: done

## Story

As a developer,
I want the state management layer and navigation shell wired,
so that all future surfaces have URL-shareable state and ephemeral interaction patterns.

## Acceptance Criteria

1. **React Query 5.x Integration (UX-DR31)**:
   - Configured using a single custom HTTP fetch client wrapper `apps/web/lib/api.ts` supporting request cancellation (`AbortController`) and retry logic (3 retries with exponential backoff: 1s, 2s, 4s; retry on 5xx, 429, and network errors only; 4xx errors do NOT retry).
   - Direct raw `fetch` calls are banned in `apps/web/**` (the client workspace only — NOT in API server, workers, or scripts), enforced via an ESLint `no-restricted-syntax` boundary rule scoped to `apps/web/**/*.{ts,tsx}`.
   - `QueryClient` initialized in `apps/web/app/providers.tsx` with explicit defaults: `staleTime: 30_000` (30s), `retry: 3`, `retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000)`.
2. **Zustand 5.x Ephemeral Interaction Stores (UX-DR29, STR-9)**:
   - Separate stores created under `apps/web/lib/state/`:
     - `graph-store`: graph node selection, active node state. Uses shared types from `lib/graph/types.ts` (`GraphNode`, `GraphEdge`, `SelectionState`) per STR-9.
     - `timeline-store`: timeline scrubber date range selection, narrative-beat filters.
     - `chat-store`: current question/query draft inputs.
     - `citation-store`: clicked/active citation modal provenance and visibility. **Coexists with** the existing `CitationProvider` (React Context from Story 1.8): the Context provides resolved provenance data; the Zustand store tracks which citation is currently *active/clicked* in the UI. They serve different purposes and do not conflict.
   - Each store is typed and exports a `reset()` function to restore initial state between Vitest test runs. The `reset()` function is called in `vitest.setup.ts` `afterEach` or via a `beforeEach` in store-specific test files.
3. **`nuqs` 2.x URL State Management (UX-DR30, STR-10)**:
   - A single, centralized parameter registry established at `apps/web/lib/state/url-keys.ts` with no parameter name drift.
   - Tracks URL parameters with typed parsers and explicit defaults:
     - `seed` — `parseAsString.withDefault('')`
     - `renderer` — `parseAsString.withDefault('cytoscape')`
     - `active` — `parseAsString.withDefault('')`
     - `mode` — `parseAsString.withDefault('trace')`
     - `from` — `parseAsString.withDefault('')`
     - `to` — `parseAsString.withDefault('')`
     - `q` — `parseAsString.withDefault('')`
   - Exports typed `useQueryState` hooks (one per param) so consumers import only what they need.
4. **Responsive Navigation Shell Layout (UX-DR32, UX-DR43)**:
   - **Left Sidebar**:
     - Displays full icons and text labels on `xl` screens (1280px+).
     - Collapses to a compact icon-rail on `lg` screens (1024px-1279px).
     - Converts to a triggerable drawer Sheet on `md` and below (under 1024px).
   - **Top Bar**:
     - Houses the essence sentence truncated via CSS `line-clamp-1 text-ellipsis overflow-hidden` at all breakpoints. Full sentence: `"Every claim IIP shows you cites a source you can open — or IIP shows you nothing."`
     - Displays a dark-mode theme toggle using `next-themes` `ThemeProvider` with `attribute="class"` and `defaultTheme="system"`. Theme choice persisted to localStorage via `next-themes`.
     - Houses the search command palette trigger (cmdk-based `⌘K` palette). The palette searches: navigation commands (go to /chat, /graph, /timeline, /evidence, /senators), and accepts free-text queries that redirect to `/chat?q=<query>`.
   - **Accessibility & Skip-Link**:
     - A `skip-to-content` link must be the first focusable/tabbable element on every surface, visually hidden until focused (UX-DR43). Target: `<main id="content">`.
     - Keyboard shortcuts wired via a `useHotkeys` hook (or equivalent): `g c` → `/chat`, `g g` → `/graph`, `g t` → `/timeline`, `g e` → `/evidence`, `g s` → `/senators`, `⌘K` → command palette, `Esc` → close active modal, `/` → focus search input, `?` → toggle keyboard shortcut help overlay.
   - **Error & Loading Boundaries**:
     - A root `<ErrorBoundary>` wraps `<main id="content">` rendering a fallback UI on uncaught errors.
     - The sidebar and top bar render a skeleton placeholder while the client bundle hydrates (no flash of unstyled content).
5. **`use client` Directive Placement**:
   - `'use client'` directive on: all Zustand store files, `app/providers.tsx`, `components/layout/sidebar.tsx`, `components/layout/top-bar.tsx`, `lib/state/url-keys.ts`, and any component that consumes hooks from these modules.
   - `app/layout.tsx` remains a Server Component. It imports `<Providers>` and `<NavigationShell>` (both client components) as children.

## Dependencies to Add

Add the following to `apps/web/package.json` before starting implementation:

| Package | Version | Purpose |
|---------|---------|---------|
| `zustand` | `^5.0.0` | Ephemeral interaction stores (AC #2) |
| `@tanstack/react-query` | `^5.62.0` | Server state management (AC #1) |
| `@tanstack/react-query-devtools` | `^5.62.0` | DevTools for React Query (dev only) |
| `nuqs` | `^2.3.0` | URL state management (AC #3) |
| `cmdk` | `^1.0.0` | Command palette component (AC #4) |
| `next-themes` | `^0.4.0` | Dark mode theme persistence (AC #4) |
| `@radix-ui/react-dialog` | `^1.1.0` | Required by shadcn Sheet component (AC #4) |

Run: `pnpm --filter @iip/web add zustand @tanstack/react-query nuqs cmdk next-themes @radix-ui/react-dialog && pnpm --filter @iip/web add -D @tanstack/react-query-devtools`

## Tasks / Subtasks

- [x] **Task 0: Rewrite ATDD Test Scaffold (do NOT copy the pre-authored file as-is)**
  - [x] Create `apps/web/lib/state/state-navigation.test.tsx` from scratch (renamed to .tsx for JSX support). The pre-authored test was NOT copied verbatim — used as specification only.
  - [x] **CI Gate Resolution**: No `.skip` used anywhere. All 29 tests run directly without skip modifiers. No CI exclusion needed.
  - [x] **Path Fix**: Used `WEB_ROOT` (apps/web/) and `REPO_ROOT` (monorepo root) computed from `import.meta.url` via `fileURLToPath`.
  - [x] **ESM Compatibility**: All imports use `import()` (dynamic import). `__dirname` computed from `import.meta.url`.
  - [x] **Remove `execa` dependency**: No execa import. ESLint check reads the CI file in-process via `readFileSync` + `String.prototype.match()`.
  - [x] **Fix layout import**: Layout tested via file-content assertions, not rendered (Server Component with next/font). SkipToContent rendered in isolation.
  - [x] **Fix url-keys API expectation**: Tests verify exported hook function names (`useSeedState`, etc.) rather than `urlKeys.q.parse()`.
  - [x] **Server Component rendering**: `<SkipToContent>` rendered in isolation; layout.tsx verified via file-content assertions only.
  - [x] Verify the rewritten test suite is recognized by Vitest and all tests are in a runnable state (red phase confirmed, then green).
- [x] **Task 1: Implement `url-keys.ts` Registry (AC: #3)**
  - [x] Create `apps/web/lib/state/url-keys.ts` (marked `'use client'`) using `nuqs`.
  - [x] Register all 7 query parameter keys with typed parsers and explicit defaults:
    - `seed` — `parseAsString.withDefault('')`
    - `renderer` — `parseAsString.withDefault('cytoscape')`
    - `active` — `parseAsString.withDefault('')`
    - `mode` — `parseAsString.withDefault('trace')`
    - `from` — `parseAsString.withDefault('')`
    - `to` — `parseAsString.withDefault('')`
    - `q` — `parseAsString.withDefault('')`
  - [x] Export one `useQueryState` hook per param (`useSeedState`, `useRendererState`, `useActiveState`, `useModeState`, `useFromState`, `useToState`, `useQueryStateParam`) so consumers import only what they need.
- [x] **Task 2: Configure React Query 5.x & HTTP Client (AC: #1)**
  - [x] Create custom HTTP fetch client `apps/web/lib/api.ts` with:
    - `AbortController` integration (accepts an optional `AbortSignal` parameter).
    - Retry logic: 3 retries with exponential backoff (1s, 2s, 4s). Retry on 5xx, 429, and `TypeError` (network failure). Do NOT retry on 4xx (client errors). Includes test seam `fetchImpl` for DI.
    - Export `apiFetch(input: RequestInfo, init?: RequestInit & { retry?: number }): Promise<Response>`.
  - [x] Create `apps/web/app/providers.tsx` (marked `'use client'`):
    - Initialize `QueryClient` with `defaultOptions: { queries: { staleTime: 30_000, retry: 3, retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000) } }`.
    - Wrap children in `<QueryClientProvider>`.
    - Include `<ReactQueryDevtools>` in dev mode.
    - Export `<Providers>` as a named export.
  - [x] Integrate `<Providers>` in `apps/web/app/layout.tsx` by wrapping children: `<Providers><CitationProvider>{children}</CitationProvider></Providers>`.
- [x] **Task 3: Implement Zustand Ephemeral Interaction Stores (AC: #2)**
  - [x] Implement stores under `apps/web/lib/state/` (each marked `'use client'`):
    - `graph-store.ts` — uses shared types from `lib/graph/types.ts` (`GraphNode`, `GraphEdge`, `SelectionState`) per STR-9. State: `selectedNodeId`, `activeNodeId`. Actions: `selectNode`, `clearSelection`.
    - `timeline-store.ts` — State: `dateRange` (`{ from: string; to: string }`), `narrativeBeatFilter`. Actions: `setDateRange`, `clearFilters`.
    - `chat-store.ts` — State: `draftInput`. Actions: `setDraft`, `clearDraft`.
    - `citation-store.ts` — State: `activeCitationId`, `isModalOpen`. Actions: `openCitation`, `closeCitation`. Coexists with `CitationProvider` (React Context from Story 1.8).
  - [x] Each store exports a `reset()` function that restores the initial state. `reset()` called in `vitest.setup.ts` `afterEach` to guarantee isolation.
- [x] **Task 4: Create Navigation Shell Components (AC: #4, #5)**
  - [x] Create `apps/web/components/layout/sidebar.tsx` (marked `'use client'`): full labels on xl, icon-rail on lg, Sheet drawer on md/below; nav links to /chat, /graph, /timeline, /evidence, /senators via Next.js Link.
  - [x] Create `apps/web/components/layout/top-bar.tsx` (marked `'use client'`): essence sentence truncated via line-clamp-1, dark-mode toggle via next-themes useTheme(), command palette via cmdk Command with navigation + free-text search redirect to /chat?q=.
  - [x] Create `apps/web/components/layout/navigation-shell.tsx` (marked `'use client'`): composes TopBar + Sidebar + main#content in flex layout; ErrorBoundary wraps main; skeleton placeholders during hydration via useMounted pattern.
  - [x] Create `apps/web/components/layout/skip-to-content.tsx`: sr-only skip link targeting #content, first focusable element.
  - [x] Create `apps/web/components/layout/keyboard-shortcuts.tsx` (marked `'use client'`): g c/g g/g t/g e/g s navigation via g-prefix sequence, Esc closes citation modal, / focuses search, ? toggles help overlay. Also created UI primitives: components/ui/sheet.tsx, command.tsx, button.tsx, skeleton.tsx.
  - [x] Update `apps/web/app/layout.tsx`: Server Component importing Providers + SkipToContent + NavigationShell + KeyboardShortcuts + CitationProvider. Layout composition matches AC #5 — all imported layout components are client components.
- [x] **Task 5: Enforce Fetch-Banning ESLint Boundary**
  - [x] Added `no-restricted-syntax` rule to `eslint.config.js` scoped to `apps/web/**/*.{ts,tsx}` (excludes `apps/web/lib/api.ts`). API server, workers, and scripts unaffected.
  - [x] Verified the lint rule catches raw `fetch()` calls in `apps/web/` via a temporary probe file — confirmed `pnpm lint` reports the violation with correct message.
- [x] **Task 6: Unskip and Pass ATDD Tests**
  - [x] No `.skip` calls anywhere in the rewritten test — all 29 tests run unconditionally. No CI exclusion needed.
  - [x] No CI exclusion was added (no `.skip` used), so nothing to remove.
  - [x] `pnpm --filter @iip/web test` — 62 tests pass GREEN (29 new + 33 existing, zero regressions).
  - [x] `pnpm lint` — fetch-ban rule active and passing across the full monorepo.
  - [x] `pnpm typecheck` — zero type errors across all 19 workspace tasks.

## Dev Notes

### Scope Boundary

This story establishes the **state management infrastructure and layout shells only**. It does not build the actual RAG chat queries, cytoscape graph visualization rendering logic, or database model migrations.

### Enforcement Boundary

| Layer | What Story 1.9 ENFORCES | What Story 1.9 DOES NOT ENFORCE | Owned By |
|-------|------------------------|--------------------------------|----------|
| **State Registry** | Central `url-keys.ts` with all 7 URL query keys | Binding URL state to specific sub-surface routes | Epics 5-7 |
| **HTTP Wrapper** | Banning raw `fetch` in `apps/web/**`, wrapping via `lib/api.ts` | Backend endpoint implementation or mock routers | Epic 2 / Ingestion |
| **Zustand** | Interaction stores initialized with test-resets | Fully interactive graph node degree calculations | Epic 6 |

### `use client` Directive Placement

This story introduces the first client components to the app. The existing `layout.tsx` is a Server Component and must remain one. The pattern is:

```
layout.tsx (Server Component)
  └─ <Providers> (Client — QueryClientProvider)
       └─ <CitationProvider> (Client — existing from Story 1.8)
            └─ <NavigationShell> (Client — sidebar + top bar + main)
                 └─ <KeyboardShortcuts /> (Client)
                 └─ {children} (Server or Client pages)
```

Files requiring `'use client'`:
- `app/providers.tsx`
- `lib/state/*.ts` (all store files + url-keys.ts)
- `components/layout/*.tsx` (sidebar, top-bar, navigation-shell, skip-to-content, keyboard-shortcuts)
- `lib/api.ts` does NOT need `'use client'` (it's a plain function, no hooks)

### CitationProvider vs citation-store

Story 1.8 placed `CitationProvider` (React Context) at the root layout. Story 1.9 adds `citation-store` (Zustand). These serve different purposes:

- **CitationProvider (Context)**: Resolves and provides *provenance data* — given a citation ID, it returns the full citation record (source document, content hash, trust tier, etc.). This is the "data layer."
- **citation-store (Zustand)**: Tracks *UI interaction state* — which citation is currently active/clicked, whether the citation modal is open. This is the "interaction layer."

They coexist without conflict: a component reads `activeCitationId` from the Zustand store, then reads the resolved provenance from CitationContext using that ID.

### Pre-authored Test Defects (DO NOT COPY AS-IS)

> [!WARNING]
> **The pre-authored test at `_bmad-output/test-artifacts/atdd/epic-1/story-1-9/state-navigation.test.ts` has critical defects and must NOT be copied verbatim.** Use it as a specification of *what* to test, not as runnable code. Known defects:

1. **ESM/CJS conflict**: Uses `require()` and `__dirname` in a `"type": "module"` package — will crash on import.
2. **Wrong API expectation**: Expects `urlKeys.q.parse()` but nuqs exports `useQueryState` hooks, not a static object.
3. **Wrong export name**: Expects `{ Page }` from layout but layout exports `RootLayout` as default.
4. **Server Component in jsdom**: Tries to `render()` a Server Component that imports `next/font/google` — will crash.
5. **Missing dependency**: Imports `execa` which is not in `package.json`.
6. **CI gate conflict**: Uses `.skip` but CI forbids `.skip` in test files.
7. **ROOT path bug**: Single ROOT variable can't resolve both `apps/web/` files and monorepo root files.

Task 0 provides the corrected approach. **Rewrite the test from scratch** following the corrected patterns.

### Implementation Order

1. Add all dependencies to `package.json` first (see Dependencies table above).
2. Task 1 (url-keys) → Task 2 (api.ts + providers) → Task 3 (stores) → Task 4 (layout components) → Task 5 (ESLint) → Task 6 (unskip tests).
3. Tasks 1-3 can be done in parallel since they have no cross-dependencies.
4. Task 4 depends on Tasks 1-3 (components consume stores, url-keys, and providers).
5. Task 5 can be done anytime after Task 2 (the fetch wrapper must exist before the lint rule is meaningful).

### References

- Zustand 5.x and React Query 5.x alignment: [Source: architecture.md#L251-L253](file:///Volumes/One%20Touch/impeach/_bmad-output/planning-artifacts/architecture.md#L251-L253)
- URL Param Registry & Spacing: [Source: architecture.md#L398-L399](file:///Volumes/One%20Touch/impeach/_bmad-output/planning-artifacts/architecture.md#L398-L399)
- STR-9 shared graph model: [Source: architecture.md#L398](file:///Volumes/One%20Touch/impeach/_bmad-output/planning-artifacts/architecture.md#L398)
- STR-10 state layout: [Source: architecture.md#L399](file:///Volumes/One%20Touch/impeach/_bmad-output/planning-artifacts/architecture.md#L399)
- Previous component stubbing patterns: [Source: 1-8-stubbed-compound-components.md](file:///Volumes/One%20Touch/impeach/_bmad-output/implementation-artifacts/1-8-stubbed-compound-components.md)

## Dev Agent Record

### Agent Model Used

GLM-5.2 (zai-coding-plan)

### Debug Log References

- `pnpm --filter @iip/web add` resolved zustand, @tanstack/react-query, nuqs, cmdk, next-themes, @radix-ui/react-dialog, tslib (tslib required by Radix transitive dep use-sidecar; was missing from pnpm store — fixed via `pnpm install --force`).
- Pre-authored ATDD test had 7 critical defects (ESM/CJS, require in module, execa dep, wrong API expectations, Server Component in jsdom, .skip, single-ROOT path). Rewritten from scratch as `.test.tsx` (JSX requires tsx extension).
- `exactOptionalPropertyTypes: true` required making CommandInput/CommandItem props non-optional (pass-through to cmdk primitives).
- Radix Dialog `asChild` on SheetClose required conditional rendering to satisfy `exactOptionalPropertyTypes`.

### Completion Notes List

- **AC #1 (React Query)**: `lib/api.ts` exports `apiFetch()` with AbortController + 3-retry exponential backoff (1s/2s/4s, retry on 5xx/429/TypeError, NOT 4xx). Includes `fetchImpl` test seam. `app/providers.tsx` configures QueryClient with staleTime:30_000, retry:3, retryDelay exponential. ReactQueryDevtools in dev mode.
- **AC #2 (Zustand stores)**: Four typed stores (graph-store, timeline-store, chat-store, citation-store) with `reset()` exports. graph-store uses shared `lib/graph/types.ts` (STR-9). citation-store coexists with CitationProvider from Story 1.8. `vitest.setup.ts` resets all stores in `afterEach`.
- **AC #3 (nuqs URL state)**: `lib/state/url-keys.ts` is the single registry with 7 typed parsers (seed, renderer=cytoscape, active, mode=trace, from, to, q) and 7 exported hooks.
- **AC #4 (Navigation shell)**: Responsive sidebar (xl full, lg icon-rail, md/below Sheet drawer), top bar (essence sentence truncated, next-themes toggle, cmdk palette), skip-to-content link, keyboard shortcuts (g-prefix navigation, Esc, /, ?, help overlay), ErrorBoundary, skeleton hydration placeholders.
- **AC #5 (use client)**: `'use client'` on all client modules. `layout.tsx` remains a Server Component.
- **Task 5 (ESLint)**: `no-restricted-syntax` fetch ban scoped to `apps/web/**` (excludes `lib/api.ts`). Verified with temporary probe file.
- Created UI primitives: `components/ui/sheet.tsx`, `command.tsx`, `button.tsx`, `skeleton.tsx` (shadcn-style, Tailwind v4, React 19).
- All gates green: build ✓, typecheck 19/19 ✓, lint ✓, test 62/62 ✓ (29 new + 33 existing, zero regressions).

### File List

- `apps/web/package.json` — added zustand, @tanstack/react-query, @tanstack/react-query-devtools, nuqs, cmdk, next-themes, @radix-ui/react-dialog, tslib
- `apps/web/lib/state/url-keys.ts` — NEW: nuqs URL parameter registry (7 params, 7 hooks)
- `apps/web/lib/state/graph-store.ts` — NEW: Zustand store for graph node selection (STR-9)
- `apps/web/lib/state/timeline-store.ts` — NEW: Zustand store for timeline date range + filters
- `apps/web/lib/state/chat-store.ts` — NEW: Zustand store for chat draft input
- `apps/web/lib/state/citation-store.ts` — NEW: Zustand store for citation modal interaction
- `apps/web/lib/state/state-navigation.test.tsx` — NEW: 29 ATDD tests (all ACs)
- `apps/web/lib/graph/types.ts` — NEW: shared GraphNode/GraphEdge/SelectionState types (STR-9)
- `apps/web/lib/api.ts` — NEW: apiFetch HTTP wrapper with AbortController + retry
- `apps/web/app/providers.tsx` — NEW: QueryClientProvider with React Query 5.x defaults
- `apps/web/app/layout.tsx` — MODIFIED: Server Component composing Providers + CitationProvider + NavigationShell + SkipToContent + KeyboardShortcuts
- `apps/web/vitest.setup.ts` — MODIFIED: added store reset() in afterEach
- `apps/web/components/layout/sidebar.tsx` — NEW: responsive sidebar (xl/lg/Sheet)
- `apps/web/components/layout/top-bar.tsx` — NEW: essence sentence + theme toggle + command palette
- `apps/web/components/layout/navigation-shell.tsx` — NEW: TopBar + Sidebar + main#content + ErrorBoundary + skeletons
- `apps/web/components/layout/skip-to-content.tsx` — NEW: sr-only skip link (UX-DR43)
- `apps/web/components/layout/keyboard-shortcuts.tsx` — NEW: global keyboard handler
- `apps/web/components/ui/sheet.tsx` — NEW: Radix Dialog-based Sheet primitive
- `apps/web/components/ui/command.tsx` — NEW: cmdk-based Command palette primitive
- `apps/web/components/ui/button.tsx` — NEW: Button primitive
- `apps/web/components/ui/skeleton.tsx` — NEW: Skeleton loading placeholder
- `eslint.config.js` — MODIFIED: added iip/web-fetch-ban no-restricted-syntax rule
- `pnpm-lock.yaml` — MODIFIED: new dependencies resolved

## Change Log

- 2026-06-26 — Story 1.9 created: State Management Foundation & Navigation Shell requirements established.
- 2026-06-26 — Story 1.9 implementation complete: all 6 tasks done, 29 ATDD tests GREEN, build/typecheck/lint/test all passing.

## Review Findings

Code review completed 2026-06-26. Agents reached consensus: `citation-store.closeCitation()` preserves `activeCitationId` (modal visibility and selected citation are distinct interaction states). All patches applied and verified.

### Decision Needed (resolved)

- [x] [Review][Decision] `citation-store.closeCitation` should preserve `activeCitationId` — agents (Sally/UX, Winston/architect, Murat/QA) agreed the modal-open flag and the active citation ID are separate concerns. Keeping the ID supports re-open, scroll-to-citation, and last-viewed behaviors in later epics.

### Patch findings (applied)

- [x] [Review][Patch] Missing `next-themes` `<ThemeProvider>` wrapper in `layout.tsx` — AC #4 violation. Added `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>` around the app shell. [`apps/web/app/layout.tsx`]
- [x] [Review][Patch] Missing `⌘K` / `Ctrl+K` command palette keyboard shortcut — AC #4 violation. Added keyboard handler dispatching `iip:open-command-palette` event; `TopBar` listens and opens the Sheet. [`apps/web/components/layout/keyboard-shortcuts.tsx`, `apps/web/components/layout/top-bar.tsx`]
- [x] [Review][Patch] `g` prefix `setTimeout` leaked on unmount — stored timer in `useRef` and cleared it in `useEffect` cleanup. [`apps/web/components/layout/keyboard-shortcuts.tsx`]
- [x] [Review][Patch] `vitest.setup.ts` silently swallowed store import failures — now logs a warning so test isolation issues are visible. [`apps/web/vitest.setup.ts`]
- [x] [Review][Patch] `apiFetch` retried on any `TypeError` — narrowed to network-specific TypeErrors (message contains `fetch`/`network`/`failed to fetch`) and kept AbortError handling separate. [`apps/web/lib/api.ts`]

## QA Results

### Automated Test Runs

- `pnpm --filter @iip/web test`: **62 passed** (8 files) — 29 new Story 1.9 ATDD tests + 33 existing, zero regressions.
- `pnpm typecheck`: **19/19 tasks successful** (zero type errors across all workspaces).
- `pnpm lint`: **clean** (zero errors, fetch-ban rule active and verified).
- `pnpm build`: **@iip/web compiled successfully** (Static prerender 4/4 pages, 102 kB First Load JS).
- `pnpm test` (full monorepo): **15/15 tasks successful**.

### Manual Verification Results

- Fetch-ban ESLint rule verified via temporary probe file (`apps/web/lib/fetch-ban-probe.ts`) — `fetch('/test')` correctly reported as violation with UX-DR31 message, then probe removed.
- `apiFetch` retry behavior unit-tested: confirms NO retry on 404 (1 call), retries on 500 (4 calls = 1 + 3 retries).
