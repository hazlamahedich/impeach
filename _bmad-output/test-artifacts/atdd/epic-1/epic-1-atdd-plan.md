---
workflowType: 'testarch-atdd'
epicId: '1'
epicTitle: 'Foundation'
date: '2026-06-22'
lastSaved: '2026-06-22'
author: 'anti lustay'
detectedStack: 'fullstack'
generationMode: 'ai-generation'
testFramework:
  unit: 'vitest@2.x'
  component: '@testing-library/react + @testing-library/user-event'
  e2e: 'playwright@1.50.x'
  integration: 'testcontainers@10.x'
  contract: 'fast-check@3.x + zod round-trip'
  backendPython: 'pytest + hypothesis'
ciPlatform: 'github-actions-self-hosted-isolated'
status: 'red-phase-scaffolds'
---

# Epic 1 — Foundation: ATDD Master Plan

**Project:** Impeachment Intelligence Platform (IIP)
**Epic:** 1 — Foundation (Stories 1.1–1.12)
**Mode:** Red-phase scaffolds before implementation (TDD red phase)
**Date:** 2026-06-22

> Authority: AC-1 (eval = 8th plane), AC-2 (hard gates non-relaxable), SC-1/2/3 (polyglot/citation/render-separation), SEC-4 (isolated runner), PC-3/4/5/9 (ADRs/glossary/xref/property tests), VAL-4 (ADR-019), NFR-O-2 (hard CI gates). All rule IDs are binding in `architecture.md`; this plan never restates them as prose — it operationalizes them as executable red-phase tests.

---

## 1. Preflight Summary

### 1.1 Stack Detection
- **Detected stack:** `fullstack` (TS Next.js 15 frontend + TS Fastify 5 backend + Python `tools/eval` + polyglot subprocess bridge).
- **Override source:** `project-context.md` (Technology Stack); `config.test_stack_type: auto` resolved to fullstack.

### 1.2 Prerequisites State (greenfield — critical finding)
The repository is **greenfield** at ATDD time. None of these exist yet:
- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.npmrc`, `.nvmrc`
- `apps/*`, `packages/*`, `tools/*`
- `playwright.config.ts`, `vitest.workspace.ts`
- `infra/docker-compose.yml`, custom PG+AGE+pgvector Docker image

**Implication:** Story 1.1 *is* the scaffold story — it installs Vitest, Playwright, and the workspace. ATDD scaffolds for 1.2–1.12 therefore reference paths that will not resolve until 1.1 lands. Scaffolds are staged under `_bmad-output/test-artifacts/atdd/epic-1/story-1-N/` with a `target-path` header; `dev-story` moves them into the monorepo once 1.1 creates the target directories.

### 1.3 TEA Config Flags (resolved)
| Flag | Value | Effect |
|---|---|---|
| `tea_use_playwright_utils` | `true` | Full UI+API Playwright Utils profile loads on frontend stories |
| `tea_use_pactjs_utils` | `false` | Contract-testing fragment loads instead of Pact utils (Epic 1 has no HTTP Pact boundaries yet) |
| `tea_pact_mcp` | `none` | No Pact MCP |
| `tea_browser_automation` | `auto` | CLI/MCP fallback; AI-generation chosen (no live UI to record against — greenfield) |
| `test_stack_type` | `auto → fullstack` | All four test levels in scope |

### 1.4 Knowledge Fragments Loaded (Core tier)
`data-factories.md`, `component-tdd.md`, `test-quality.md`, `test-healing-patterns.md`, `selector-resilience.md`, `timing-debugging.md`, `test-levels-framework.md`, `test-priorities-matrix.md`, `contract-testing.md`, `fixture-architecture.md`, `network-first.md`. Backend/chaos fragments (`ci-burn-in.md`) loaded for 1.11.

---

## 2. Generation Mode

**Mode:** AI generation (not recording). Rationale: ACs are unambiguous Given/When/Then; greenfield repo has no live UI to record; defamation-grade invariants are best expressed as deliberate property/contract tests, not captured interactions.

---

## 3. Dependency Order (load-bearing — dev-story must respect)

```
1.1 ─┬─► 1.2  (needs monorepo + drizzle + tools/eval shim)
     ├─► 1.3  (needs apps/* stubs for compose health checks)
     ├─► 1.4  (needs packages/render + ESLint config)
     ├─► 1.5  (needs packages/eval + tools/eval + turbo py:* tasks)
     ├─► 1.6  (needs packages/citation + packages/contracts)
     ├─► 1.7  (needs apps/web + app/styles)
     ├─► 1.8  (needs components/iip/ + components/ui/)
     ├─► 1.9  (needs apps/web state libs + navigation)
     ├─► 1.10 (needs docs/adr/ + adr-lint tool)
     ├─► 1.11 (needs .github/workflows + infra/runner + eval/gates)
     └─► 1.12 (needs packages/eval + packages/render — KEYSTONE)
```

**Hard ordering rule:** Story 1.1 must land before any other scaffold is activated (`.skip` removed). 1.12 (contract test) is intentionally RED/skipped through Epic 1 and ACTIVATES in Epic 2 (per its AC).

---

## 4. Test Strategy — AC → Scenario → Level → Priority

**Severity triage** (mirrors invariant-ledger `T1/T2/T3`):
- **T1** defamation exposure (P0) — uncited allegation, broken boundary, forged attribution
- **T2** credibility degradation (P1) — metric drift, misattribution, missing token
- **T3** operational (P2) — scaffold presence, doc completeness, CI wiring

### 4.1 Crosswalk Matrix

| Story | Title | Primary Level | AC IDs | Severity | Red Conventions |
|---|---|---|---|---|---|
| 1.1 | Turborepo Scaffold & Process Stubs | smoke/build | AC-F1-01/02/03 | T3 | `test.todo` (scaffold not yet present) |
| 1.2 | PG + pgvector + AGE Compatibility | integration (testcontainers) | AC-F1-04 (implicit) | T2 | `test.skip` (custom image missing) |
| 1.3 | Docker Compose Platform Stack | integration (compose) | AR-1..8 | T2 | `test.skip` (compose file missing) |
| 1.4 | Render Gate ESLint Boundary | unit (ESLint API) + contract | AC-F1-08, SC-3, AC-2 | **T1** | `test.skip` → fail-closed invariant |
| 1.5 | Polyglot Eval Seam | integration (subprocess) + contract | AC-F1-05, SC-1, ADR-014 | **T1** | `test.skip` (KEYSTONE — zod↔pydantic) |
| 1.6 | Citation Package | unit + contract | SC-2, AC-4, ADR-010 | **T1** | `test.skip` (defamation primitive) |
| 1.7 | Design Token System | unit (CSS parse) | UX-DR1-8 | T2 | `test.skip` (tokens absent) |
| 1.8 | Stubbed Compound Components | component (TLR) | UX-DR9-12/18/20, AC-2 boundary | **T1** | `test.skip` (AC-2 at component boundary) |
| 1.9 | State Mgmt & Nav Shell | component + unit | UX-DR28-34/43 | T2 | `test.skip` |
| 1.10 | 19 ADRs Seeded | unit (adr-lint) | AR-7, PC-3, VAL-4 | T2 | `test.skip` |
| 1.11 | CI Pipeline & Gate Store | integration (workflow parse) | AR-20/22, SC-7, SEC-4 | T2 | `test.skip` |
| 1.12 | Citation-or-Silence Contract Test (RED) | contract (property, bidirectional) | EI-1, AC-2, PC-9 | **T1** | `test.skip` INTENTIONAL — activates Epic 2 |

### 4.2 Invariant-to-Test Mapping (defamation spine)

| Invariant (INV ledger) | Story | Test assertion_signature | Gate |
|---|---|---|---|
| Render package imports ONLY `@iip/contracts` | 1.4 | `renderBoundary.allowsOnlyContracts` | pr-check |
| `@iip/render` banned in `packages/rag/**` | 1.4 | `renderBoundary.bannedInRag` | pr-check |
| Citation tuple = `(source_doc_id, span_start, span_end, content_hash)` | 1.6 | `citationTuple.shapeMatchesAC4` | pr-check |
| Citation hash algorithm pinned (ADR-010) | 1.6 | `citationTuple.hashAlgorithmPinned` | pr-check |
| Polyglot bridge is subprocess, NOT HTTP (ADR-014) | 1.5 | `polyglotBridge.subprocessNotHttp` | pr-check |
| EvalResult parses via TS zod | 1.5 | `polyglotBridge.evalResultParses` | pr-check (KEYSTONE AC-F1-05) |
| Pydantic generated from zod in CI (no hand-written) | 1.5 | `polyglotBridge.pydanticGenerated` | pr-check |
| Every served assertion with citation is served (positive) | 1.12 | `citationOrSilence.citedAssertionsServed` | nightly → pr (Epic 2+) |
| Every served assertion without citation is suppressed (negative) | 1.12 | `citationOrSilence.uncitedAssertionsSuppressed` | nightly → pr (Epic 2+) |
| No uncited path — property over render.* exports | 1.12 | `citationOrSilence.noUncitedPath` | nightly |
| `<Claim>` with zero `<Citation>` children refuses to render | 1.8 | `claimPrimitive.refusesUncitedRender` | pr-check |
| Semantic tokens only in `components/iip/` | 1.7 | `designTokens.noRawColorInDomainPrimitives` | pr-check |

---

## 5. Red-Phase Conventions (applied uniformly)

1. **All scaffolds ship `test.skip()` or `test.todo()`** — never active in Epic 1 (except 1.1 smoke which becomes active post-scaffold).
2. Each `test.skip` carries a `// RED — {reason}` comment naming the missing artifact (per template §"Red-Green-Refactor").
3. **CI rule:** `skipped !== passing` (Story 1.12 AC). A `test.skip` counts as ship-blocking for 1.12 specifically at Epic 2 merge — enforced by a coverage-threshold gate `--passWithNoTests=false` + skip-count assertion.
4. Activation = remove `.skip` for the current task only; confirm RED; implement; GREEN; commit.
5. **Naming:** files `*.test.ts` (LOCKED per `project-context.md` Naming table — NOT `*.spec.ts`); Python `test_*.py`.
6. **Factories/fakes:** Epic 1 has minimal domain entities — factories are stubs (`packages/contracts/__fixtures__/`) activated in Epic 2+. No `@faker-js/faker` overuse in Epic 1 (nothing to randomize yet).
7. **Mock boundary:** testcontainers real for PG/MinIO/Redis (1.2/1.3); msw deferred (no UI integration until 1.8/1.9); Ollama cassettes N/A in Epic 1.

---

## 6. Output Inventory

Per-story folder `story-1-N/` contains:
- `atdd-checklist-1-N-*.md` — per-story checklist (template `atdd-checklist-template.md`)
- `*.test.ts` / `*.test.tsx` — red-phase scaffold(s)
- `fixtures/` / `factories/` where the story needs them (mostly empty in Epic 1)

| Story | Files | Test Count |
|---|---|---|
| 1.1 | scaffold-smoke.test.ts | 6 |
| 1.2 | pg-age-pgvector.compat.test.ts | 6 |
| 1.3 | compose-stack.health.test.ts | 8 |
| 1.4 | render-gate-boundary.test.ts | 7 |
| 1.5 | polyglot-eval-roundtrip.test.ts | 7 |
| 1.6 | citation-tuple.test.ts | 7 |
| 1.7 | design-tokens.test.ts | 8 |
| 1.8 | citation-empty-chip.test.tsx, claim-variants.test.tsx, trust-badge.test.tsx, source-verb-tag.test.tsx, answer-block.test.tsx, empty-state.test.tsx | 14 |
| 1.9 | url-keys-registry.test.ts, api-wrapper.test.ts, navigation-shell.test.tsx | 9 |
| 1.10 | adrs-seeded.test.ts | 7 |
| 1.11 | ci-pipeline.test.ts | 9 |
| 1.12 | citation-or-silence.contract.test.ts | 5 (skipped — KEYSTONE) |
| **Total** | **22 files** | **~93 tests** |

---

## 7. Running Tests

```bash
# After Story 1.1 lands the workspace:
pnpm install
pnpm vitest run --filter '@iip/...'           # unit/contract
pnpm vitest run --filter 'packages/eval'      # 1.5 + 1.12 contract
pnpm exec playwright test                     # E2E (none in Epic 1 greenfield)
pnpm turbo run py:test                        # Python tools/eval (1.5)

# A single scaffold (after activating one .skip):
pnpm vitest run packages/render/gate-boundary.test.ts
```

Until 1.1 lands, scaffolds live under `_bmad-output/test-artifacts/atdd/epic-1/` and **do not execute** — they are spec artifacts for `dev-story` to consume.

---

## 8. Risk Notes & Open Items

1. **Custom Docker image (F1 prerequisite):** Story 1.2 cannot go GREEN until the PG16+AGE+pgvector image is built and SHA-pinned (project-context.md open item). ATDD scaffold asserts the image digest; dev-story builds the image.
2. **AGE version pin unverified:** ADR-002 says ≥1.7.0 but latest GA may be 1.5.0. Story 1.2 scaffold asserts a resolved pin; resolving it is an ADR amendment, not a test fix.
3. **bge-m3 serving path unspecified (OQ-1):** Not in Epic 1 scope (Story 4.6), but 1.2's `vector(1024)` column test is schema-affecting.
4. **Tailwind 4 is a full rewrite:** Story 1.7 token tests assume v4 `@theme` CSS config (per project-context.md); any v3 patterns fail the scaffold.
5. **Story 1.12 is the defamation spine:** Must remain RED/skipped through Epic 1 and ACTIVATE at Epic 2 merge (Story 2.1). CI must treat skip ≠ pass for 1.12 from Epic 2 onward.

---

## 9. Handoff to dev-story

For each story, `dev-story` will:
1. Read `atdd-checklist-1-N-*.md` for the implementation roadmap.
2. Move the scaffold file(s) from `test-artifacts/atdd/epic-1/story-1-N/` to the in-repo `target-path` declared in each file's header (once 1.1 creates the dir).
3. Activate ONE `test.skip` at a time; confirm RED; implement minimal; reach GREEN; commit with `Refs:` trailer.
4. Update `sprint-status.yaml` story status on completion.

**Generated by BMad TEA Agent** — 2026-06-22
