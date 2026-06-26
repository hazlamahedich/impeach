---
story_id: '1.8'
story_key: '1-8-stubbed-compound-components'
epic: 'Epic 1: Foundation'
status: review
last_updated: '2026-06-26'
baseline_commit: ffa73f9
amendments_applied: '2026-06-26-adversarial-review'
---

# Story 1.8: Stubbed Compound Components (UX-DR9-12, 18, 20)

Status: review

## Story

As a developer,
I want stubbed versions of the editorial-integrity compound components,
so that the citation-or-silence invariant has a rendering surface from day one.

*(This is the demoable spine of Epic 1 — a human can see the invariant surface for the first time.)*

## Acceptance Criteria

1. **`<Citation>`** compound components implemented (UX-DR9, AC-2):
   - Renders `<Citation.Empty>` by default when no provenance is resolved. `<Citation.Empty>` renders as a muted, greyed-out chip with text "No source" and `data-testid="citation-empty"` — visually distinct from a resolved citation so the user can see the difference between "no source yet" and "source available."
   - Promotes to `<Citation.Chip>` only when provenance resolves (all fields in `CitationContext` are non-null, including `url`).
   - `<Citation.Chip>` must render as a semantic `role="link"` (never a bare `<span>` or button) with `target="_blank"` and `rel="noopener noreferrer"`.
   - Has an `aria-label` matching standard format: `Source: {verb} {title} ({tier})` (e.g. `Source: documents Senate Roll Call 2024-001 (primary)`).
   - **Edge case:** If provenance resolves but `url` is missing, `<Citation.Chip>` renders as a non-interactive chip (no `role="link"`, no `href`) with `data-testid="citation-chip-no-url"` and an `aria-label` ending in `(link unavailable)`. This prevents a citation that claims provenance but can't link to it — which is worse than no citation.
   - **`<Citation.Modal>` stub (UX-DR9):** Clicking `<Citation.Chip>` opens a stubbed modal (`data-testid="citation-modal"`) containing: document title, `<TrustBadge>`, `<SourceVerbTag>`, a placeholder for the verbatim quoted passage (mono text "Passage text loads from document store"), and a "View full document" link (disabled in stub, `data-testid="citation-modal-view-doc"`). Modal closes on Esc or close button. Focus moves to modal title on open, returns to chip on close.
2. **`<Claim>`** component implemented with mechanical invariant checks (UX-DR10, UX-DR36, AC-2):
   - Renders variants:
     - `fact`: solid left border (`border-l-3 border-claim-fact text-claim-fact font-sans text-base`), full ink weight.
     - `attributed`: dashed left border (`border-l-3 border-dashed border-claim-attributed text-claim-attributed italic font-sans text-base`).
     - `dashed`: dashed left border (`border-l-3 border-dashed border-claim-dashed text-claim-dashed line-through font-sans text-base`).
   - Includes an `aria-label` prefix on the `<article>` wrapper (e.g. `Fact: ...`, `Attributed Claim: ...`, `Superseded Claim: ...`) for screen readers.
   - **Mechanical "no citation, no claim" enforcement (AC-2):** If `citations.length === 0`, it suppresses rendering the claim text (returns `null` or hides the text) and instead renders `<TrustBadge data-testid="trust-badge-insufficient" tier="insufficient" sourceCount={0}>No sources — not shown</TrustBadge>`.
3. **`<TrustBadge>`** component implemented with 3 redundant channels for accessibility (UX-DR11, WCAG 2.1 AA):
   - Surfaces verified/contradicted/caution/insufficient tiers.
   - Always pairs color, icon, and text label (never color-only).
   - Icons: `Check` (verified), `GitBranch`/`Split` (contradicted), `Eye` (caution).
   - Styles:
     - `verified`: teal background (`bg-trust-tier-verified text-white rounded-sm font-label-caps`).
     - `contradicted`: brick red background (`bg-trust-tier-contradicted text-white rounded-sm font-label-caps`).
     - `caution`: outline style (`bg-surface-sunken border border-trust-tier-caution text-trust-tier-caution rounded-sm font-label-caps`).
     - `insufficient`: fallback/warning icon, muted colors.
   - Set `role="img"` and `aria-label` e.g. `Verified — {sourceCount} sources`.
4. **`<SourceVerbTag>`** component implemented with dynamic registry lookup (UX-DR12, EI-3):
   - Renders preserved verb verbatim in uppercase (`label-caps` typography, `text-primary bg-transparent border-none`).
   - Uses the configuration registry in `lib/citation/source-verbs.ts`.
   - If the verb is unregistered, renders a fallback style (`text-muted-foreground fallback`) and triggers a `console.warn`.
   - If the verb variant is `risk`, uses defamation-risk styling (`text-defamation-risk-caution`).
5. **`<AnswerBlock>`** component implemented (UX-DR18, UX-DR21):
   - Renders `answer-block` with 3px primary border on the left (`border-l-3 border-primary bg-surface-raised p-5 rounded-md`).
   - `<AnswerBlock.Silence>` renders sunken block (`bg-surface-sunken border-l-3 border-muted-foreground`) with heading text "No sourced answer found".
   - `<AnswerBlock.Silence>` displays standard headline and text.
   - `<AnswerBlock.Essence>` renders italic caption (`text-xs text-muted-foreground italic mt-2`) showing the core IIP verification sentence.
   - **`<AnswerBlock.NoPrediction>` (UX-DR21):** Renders a distinct variant (`bg-surface-sunken border-l-3 border-accent`) with heading "IIP does not make predictions" and body text: "Here is what is on record: [placeholder for sourced statements]. Draw your own inference." Has `data-testid="answer-block-no-prediction"`.
6. **`<EmptyState>`** component implemented (UX-DR20):
   - Renders `display-sm` (serif) headline and `body-md` (sans) body.
7. **File layout compliance:**
   - All components live in `apps/web/components/iip/` (separate from shadcn `components/ui/`).
   - `CitationContext` provider is placed at the root layout (`apps/web/app/layout.tsx`).
   - `lib/citation/source-verbs.ts` lives at `apps/web/lib/citation/source-verbs.ts` (inside the web app, resolvable via `@/lib/citation/source-verbs`).
8. **`CitationContext` type contract (AC-4 alignment):**
   - `CitationContext` value type is defined in `@iip/contracts/src/citation.ts` as `CitationProvenance | null` (not `undefined`).
   - `CitationProvenance` includes all fields from the CitationTuple (Story 1.6): `sourceDocId`, `spanStart`, `spanEnd`, `contentHash`, plus UX fields: `sourceVerb`, `sourceTier`, `sourceTitle`, `url` (optional).
   - Components import the type from `@iip/contracts`, never define it locally.

## Tasks / Subtasks

- [x] **Task 0: Verify Test Infrastructure (Pre-flight)**
  - [x] Confirm `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom` are installed in `apps/web/package.json`.
  - [x] Confirm `apps/web/vitest.config.ts` (or workspace-level config) sets `environment: 'jsdom'` and includes `setupFiles` for `@testing-library/jest-dom`.
  - [x] Run `pnpm --filter @iip/web test` to verify the test harness works (at least one trivial test passes with jsdom).
- [x] **Task 1: Establish `source-verbs.ts` Registry (AC: #4)**
  - [x] Create directory `apps/web/lib/citation/`.
  - [x] Create `apps/web/lib/citation/source-verbs.ts` file.
  - [x] Declare configurations for verbs: `documents` (bias: 'raise', variant: 'primary', floor: 'primary'), `alleges` (bias: 'neutral', variant: 'primary', floor: 'secondary'), `retracts` (bias: 'lower', variant: 'risk', floor: 'secondary'), plus other standard verbs (`alleged`, `testified`, `voted`, `denied`, `claimed`).
- [x] **Task 2: Define `CitationProvenance` Type in Contracts (AC: #8)**
  - [x] Add `CitationProvenance` type to `packages/contracts/src/citation.ts` with fields: `sourceDocId`, `spanStart`, `spanEnd`, `contentHash`, `sourceVerb`, `sourceTier`, `sourceTitle`, `url?`.
  - [x] Export `CitationProvenance` from `packages/contracts/src/index.ts`.
  - [x] Components import from `@iip/contracts` — no local type definitions.
- [x] **Task 3: Implement `<Citation>` Compound Component + Modal Stub (AC: #1, #7, #8)**
  - [x] Create `apps/web/components/iip/citation/index.tsx`.
  - [x] Export `CitationContext` (value type: `CitationProvenance | null`, default `null`) and custom hook `useCitation()`.
  - [x] Implement `Citation` wrapper that renders `<Citation.Empty>` by default, and promotes to `<Citation.Chip>` if context is non-null AND `url` is present.
  - [x] Implement `<Citation.Empty>` to render a muted greyed-out chip with text "No source" and `data-testid="citation-empty"`.
  - [x] Implement `<Citation.Chip>` to render as `role="link"` with `data-testid="citation-chip"`, proper screen-reader label, and click handler for modal.
  - [x] Implement `<Citation.Chip>` edge case: when `url` is missing, render non-interactive chip with `data-testid="citation-chip-no-url"` and aria-label ending in `(link unavailable)`.
  - [x] Implement `<Citation.Modal>` stub with `data-testid="citation-modal"`: document title, `<TrustBadge>`, `<SourceVerbTag>`, mono placeholder text, disabled "View full document" link. Esc/close-button dismisses. Focus trap on open, returns to chip on close.
  - [x] Wrap the `CitationContext.Provider` around children in `apps/web/app/layout.tsx`.
- [x] **Task 4: Implement `<Claim>` Component with Invariant Check (AC: #2, #7)**
  - [x] Create `apps/web/components/iip/claim/index.tsx`.
  - [x] Support `variant` and `citations` props.
  - [x] Enforce mechanical check: if `citations.length === 0`, omit claim text and render `<TrustBadge data-testid="trust-badge-insufficient" tier="insufficient" sourceCount={0} />`.
  - [x] Apply Tailwind v4 classes for variants: `claim-fact`, `claim-attributed`, `claim-dashed` (strikethrough).
  - [x] Include visually hidden / screen-reader-only labels (`Fact: `, `Attributed Claim: `, `Superseded Claim: `) matching `variant` values.
- [x] **Task 5: Implement `<TrustBadge>` Component (AC: #3, #7)**
  - [x] Create `apps/web/components/iip/trust-badge/index.tsx`.
  - [x] Render three redundant channels: color, icon (`Check`, `GitBranch` / `Split`, `Eye`), and text.
  - [x] Support `tier` (`verified`, `contradicted`, `caution`, `insufficient`) and `sourceCount` props.
  - [x] Use Tailwind v4 theme variables (e.g. `bg-trust-tier-verified` or custom properties) rather than hardcoded hex codes.
- [x] **Task 6: Implement `<SourceVerbTag>` Component (AC: #4, #7)**
  - [x] Create `apps/web/components/iip/source-verb-tag/index.tsx`.
  - [x] Import `sourceVerbs` from `@/lib/citation/source-verbs`.
  - [x] Implement upper-cased display with fallback logic and console warning on unknown verbs.
- [x] **Task 7: Implement `<AnswerBlock>` Component (AC: #5, #7)**
  - [x] Create `apps/web/components/iip/answer-block/index.tsx`.
  - [x] Implement base, `.Silence`, `.Essence`, and `.NoPrediction` subcomponents.
- [x] **Task 8: Implement `<EmptyState>` Component (AC: #6, #7)**
  - [x] Create `apps/web/components/iip/empty-state/index.tsx`.
  - [x] Render with `font-display display-sm` headline and `font-sans body-md` body.
- [x] **Task 9: Wire up and Activate ATDD Tests (AC: #1-#8)**
  - [x] Copy and split the 4 Vitest test files from `_bmad-output/test-artifacts/atdd/epic-1/story-1-8/` to their target directories under `apps/web/components/iip/`:
    - `citation-empty-chip.test.tsx` -> `apps/web/components/iip/citation/citation-empty-chip.test.tsx`
    - `claim-variants.test.tsx` -> `apps/web/components/iip/claim/claim-variants.test.tsx`
    - `trust-badge.test.tsx` -> `apps/web/components/iip/trust-badge/trust-badge.test.tsx`
    - `source-verb-answer-empty.test.tsx` — **SPLIT into 3 files:**
      - SourceVerbTag tests -> `apps/web/components/iip/source-verb-tag/source-verb-tag.test.tsx`
      - AnswerBlock tests -> `apps/web/components/iip/answer-block/answer-block.test.tsx`
      - EmptyState tests -> `apps/web/components/iip/empty-state/empty-state.test.tsx`
  - [x] Fix `source-verb-answer-empty.test.tsx` path references: change `ROOT` computation and `lib/citation/source-verbs.ts` read path to resolve from `apps/web/` (not monorepo root).
  - [x] Fix `trust-badge.test.tsx` line 31: replace `expect(style.color || style.backgroundColor).toBeTruthy()` with an assertion that checks the computed value of a CSS custom property (e.g., `getComputedStyle(el).getPropertyValue('--trust-tier-caution')`) or asserts the computed color matches the expected token.
  - [x] Add tests for new AC coverage: Citation.Empty visual treatment, Citation.Chip no-url edge case, Citation.Modal stub, AnswerBlock.NoPrediction variant.
  - [x] Activate tests by removing `.skip` from `describe(...)`.
  - [x] Run `pnpm --filter @iip/web test` and verify all tests pass GREEN.

## Dev Notes

### Scope Boundary

This story focuses purely on **implementing the stubbed compound components and configuring the source verb registry**. Integrating these components with the live RAG query flow (Story 5.3), building the interactive knowledge graph (Epic 6), or establishing full state-management sidebar navigation (Story 1.9) are out of scope.

### Enforcement Boundary

| Layer | What Story 1.8 ENFORCES | What Story 1.8 DOES NOT ENFORCE | Owned By |
|-------|------------------------|--------------------------------|----------|
| **Components** | UI primitives (`Citation`, `Citation.Modal`, `Claim`, `TrustBadge`, `SourceVerbTag`, `AnswerBlock`, `EmptyState`) in `apps/web/components/iip/` | Actual layout assembly, database storage, server-side APIs | Story 1.9 / Epic 2 |
| **Mechanical check** | Omission of claim text if citations array is empty; fallback to `insufficient` TrustBadge; Citation.Chip degrades gracefully when url is missing | Verification of cryptographic hash signatures | Story 2.1 |
| **Registry** | Preserved source-verbs configured in `apps/web/lib/citation/source-verbs.ts` | Integration with AI extraction pipeline | Epic 4 |
| **Types** | `CitationProvenance` type in `@iip/contracts` (aligned with CitationTuple from Story 1.6) | Runtime provenance resolution, RAG pipeline | Epic 5 |

### Amendment-to-Story Traceability

| AC | Binding Amendment(s) | What It Enforces |
|----|---------------------|------------------|
| AC #1 | UX-DR9 | `<Citation>` compound structure; `CitationContext`; Empty visual treatment; Chip no-url edge case; Modal stub |
| AC #2 | UX-DR10, UX-DR36, AC-2 | `<Claim>` styles + mechanical suppression of uncited text |
| AC #3 | UX-DR11, WCAG 2.1 AA | `<TrustBadge>` variants and 3-channel a11y |
| AC #4 | UX-DR12, EI-3 | `<SourceVerbTag>` verbatim preservation + registry |
| AC #5 | UX-DR18, UX-DR21 | `<AnswerBlock>` borders, essence banner, silence state, no-prediction state |
| AC #6 | UX-DR20 | `<EmptyState>` layouts |
| AC #7 | — | File layout: `apps/web/components/iip/`, `apps/web/lib/citation/`, `apps/web/app/layout.tsx` |
| AC #8 | AC-4, Story 1.6 | `CitationProvenance` type in `@iip/contracts` aligned with CitationTuple |

### Critical Architecture Guardrails

1. **No relative imports across package boundaries.**
   `apps/web/components/iip/` components must import types only from `@iip/contracts` or `@iip/config`, never using relative paths like `../../../../packages/contracts/src/...`.
2. **Branded and nominal types.**
   Citations use `CitationRef` and `CitationTuple` defined in `@iip/contracts` to enforce data schemas.
3. **Typography and corner alignment.**
   Ensure components leverage the tightened corner variables (`rounded-sm` = 3px, `rounded-md` = 5px, `rounded-lg` = 8px) and correct font variables (`font-display` for display serif headers, `font-mono` for citations/doc text).

### Previous Story Learning References

- **Story 1.7 (Design Tokens):** Composed fonts and colors through Tailwind CSS variables (no raw hex codes).
- **Story 1.4 (Eslint Boundaries):** Hard separation between UI packages and engine logic.

## Dev Agent Record

### Agent Model Used

Gemini 3.5 Flash (High) (as pairing partner)

### Debug Log References

- Initial run: 16/33 web tests failed with "Found multiple elements" — root cause was missing DOM cleanup between tests. Fixed by registering `afterEach(cleanup)` in `apps/web/vitest.setup.ts`.
- Modal test then failed: chip + modal each render a `<SourceVerbTag>`, so `getByTestId` was ambiguous. Fixed by scoping modal assertions with `within(modal)`.
- Smoke gate AC-F1-01 (`pnpm build`) regressed: root package `impeachment-watch` (a `.` workspace member) has `build: "turbo run build"`, which recursed infinitely once the root build cache was invalidated by the lockfile change. Web build itself compiled fine. Fixed by excluding the root from its own turbo delegation (see Change Log).

### Completion Notes List

- **Test infra (Task 0):** Added `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@vitejs/plugin-react`, `vitest` to `apps/web`; wired jsdom env + `@/` alias + jest-dom setup + per-test cleanup. Added `@iip/contracts` as a workspace dependency and to `next.config.ts` `transpilePackages`.
- **`source-verbs.ts` (Task 1):** Registry declares `bias`/`variant`/`floor` per verb (documents/alleges/retracts + alleged/testified/voted/denied/claimed). Verbatim verb preserved in UPPERCASE; unregistered verbs fall back + `console.warn`; risk-variant verbs carry defamation-risk styling.
- **`CitationProvenance` (Task 2):** Added to `@iip/contracts` as the camelCase UX projection of `CitationTuple` (+ `sourceVerb`/`sourceTier`/`sourceTitle`/`url?`). Storage-side branding stays on `CitationTuple`; the UI consumer is not re-branded (strict hashing is enforced upstream at ingestion). Exported from the barrel.
- **`<Citation>` (Task 3):** Compound primitive (`Empty`/`Chip`/`Modal`) marked `'use client'` (hooks). A client `CitationProvider` wraps the App Router root layout (Server Components cannot host a context Provider directly). Chip degrades to a non-interactive `citation-chip-no-url` when provenance lacks a url; modal focuses its title on open, returns focus to the chip on close, and dismisses on Esc / close button.
- **`<Claim>` (Task 4):** Mechanical AC-2 enforcement — zero citations suppresses the claim body and surfaces `trust-badge-insufficient`. Variants fact/attributed/dashed use semantic token classes (`text-claim-*`, `border-dashed`, `line-through`, `italic`) with `aria-label` prefixes for screen readers.
- **`<TrustBadge>` (Task 5):** Three redundant channels (semantic colour + inline-SVG icon + text label) with a single `role="img"` + descriptive `aria-label`. No icon library dependency (inline SVGs use `currentColor`, so the design-tokens "no raw hex in components/iip" gate stays green).
- **`<AnswerBlock>` / `<EmptyState>` (Tasks 7–8):** Compound answer surface (base/Silence/Essence/NoPrediction) and the empty-state surface. Required adding additive typography tokens (`--text-display-sm`, `--text-body-md`, `--font-label-caps`) to the Story 1.7 `@theme` block — additive only, does not alter existing Story 1.7 tokens or its tests.
- **Tests (Task 9):** Copied/split the 4 ATDD files into 6 co-located specs (24 original assertions + new coverage: no-url chip edge case, modal stub, AnswerBlock.NoPrediction, TrustBadge insufficient, SourceVerbTag risk variant). Documented fixes applied: source-verb `ROOT` path now resolves from `apps/web/`; trust-badge colour assertion switched from computed style (unreliable in jsdom) to a semantic-token class assertion; AnswerBlock border assertion switched to the `border-l-[3px]` utility for the same jsdom reason; `require()` → ESM `import`; `value={undefined}` → `value={null}` to match the `CitationProvenance | null` contract type. All `.skip` removed.
- **Result:** `pnpm --filter @iip/web test` → 33/33 GREEN; web typecheck + lint clean; `pnpm build` exits 0; full regression (`pnpm test`) → all packages GREEN, zero regressions.

## File List

**New — components (`apps/web/components/iip/`):**
- `citation/index.tsx` — `<Citation>` compound (`Empty`/`Chip`/`Modal`) + `CitationContext`, `useCitation`, `CitationProvider`
- `claim/index.tsx` — `<Claim>` with mechanical no-citation invariant
- `trust-badge/index.tsx` — `<TrustBadge>` (3-channel a11y)
- `source-verb-tag/index.tsx` — `<SourceVerbTag>` (registry-backed)
- `answer-block/index.tsx` — `<AnswerBlock>` (base/Silence/Essence/NoPrediction)
- `empty-state/index.tsx` — `<EmptyState>`

**New — registry + tests:**
- `apps/web/lib/citation/source-verbs.ts` — preserved source-verb registry (EI-3)
- `apps/web/components/iip/{citation,claim,trust-badge,source-verb-tag,answer-block,empty-state}/*.test.tsx` — 6 co-located component specs
- `apps/web/vitest.setup.ts` — jest-dom + per-test cleanup

**Modified:**
- `apps/web/package.json` — added test deps + `@iip/contracts` workspace dep
- `apps/web/vitest.config.ts` — jsdom env, react plugin, `@/` alias, setupFiles, component include globs
- `apps/web/next.config.ts` — `transpilePackages` += `@iip/contracts`
- `apps/web/app/layout.tsx` — wraps children in `<CitationProvider>`
- `apps/web/app/styles/iip-tokens.css` — additive typography tokens (`--text-display-sm`, `--text-body-md`, `--font-label-caps`)
- `packages/contracts/src/citation.ts` — added `SourceTier` + `CitationProvenance`
- `packages/contracts/src/index.ts` — exports the new types
- `package.json` (root) — fixed latent turbo self-recursion on `build`/`typecheck`/`test` (`--filter=!impeachment-watch`); exposed when the lockfile change invalidated the root build cache

## Change Log

- 2026-06-26 — Story 1.8 implemented: stubbed editorial-integrity compound components (`Citation`/`Claim`/`TrustBadge`/`SourceVerbTag`/`AnswerBlock`/`EmptyState`), source-verb registry, `CitationProvenance` contract type, CitationContext at root layout. 33 web component tests GREEN; full regression suite GREEN.
- 2026-06-26 — Fixed latent scaffold bug: root `build`/`typecheck`/`test` turbo-delegation self-recursion (root is a `.` workspace member); excluded root via `--filter=!impeachment-watch`. Restores AC-F1-01 build gate.

## QA Results

### Automated Test Runs

- `pnpm --filter @iip/web test` → **33 passed (33)** across 7 files (citation 5, claim 5, trust-badge 5, source-verb-tag 4, answer-block 4, empty-state 1, design-tokens 9).
- `pnpm --filter @iip/web typecheck` → clean. `pnpm --filter @iip/web lint` → 0 problems.
- `pnpm --filter @iip/contracts test` → 10 passed (10); typecheck clean.
- `pnpm build` → exit 0; 19/19 turbo tasks successful; `@iip/web` compiles.
- `pnpm test` (full regression) → exit 0; root projects 23/23; all package suites GREEN (contracts 10, web 33, citation 32, render 9, eval 11, db 9, …); turbo 15/15.

### Manual Verification Results

- AC #1–#8 each mapped to passing tests (see Amendment-to-Story Traceability). The defamation-load-bearing "no citation, no claim" invariant (AC #2) is mechanically enforced and asserted.
- Components use only semantic STR-10 tokens (no raw hex) — verified by the Story 1.7 `design-tokens.test.ts` "no raw hex in components/iip" gate, which remains GREEN.
