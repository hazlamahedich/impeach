---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests', 'step-03c-aggregate', 'step-04-validate-and-summarize']
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-06-27'
workflow: 'bmad-testarch-automate'
epicId: '1'
epicTitle: 'Foundation'
executionMode: 'BMad-Integrated'
detectedStack: 'fullstack'
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/test-artifacts/atdd/epic-1/epic-1-atdd-plan.md
  - _bmad-output/test-artifacts/atdd/epic-1/INDEX.md
  - _bmad-output/implementation-artifacts/sprint-status.yaml
  - _bmad-output/project-context.md
  - package.json
  - _bmad/tea/config.yaml
knowledgeFragments:
  core: ['test-levels-framework.md', 'test-priorities-matrix.md', 'data-factories.md', 'selective-testing.md', 'ci-burn-in.md', 'test-quality.md']
  playwright: ['overview.md', 'api-request.md', 'network-recorder.md', 'auth-session.md', 'intercept-network-call.md', 'recurse.md', 'log.md', 'file-utils.md', 'burn-in.md', 'network-error-monitor.md', 'fixtures-composition.md']
  contract: ['contract-testing.md']
teaConfig:
  tea_use_playwright_utils: true
  tea_use_pactjs_utils: false
  tea_pact_mcp: 'none'
  tea_browser_automation: 'auto'
  test_stack_type: 'auto -> fullstack'
  test_framework: 'vitest@2.x (unit/contract), testcontainers@10.x (integration), playwright@1.50.x (e2e — config NOT yet scaffolded), fast-check@3.x (property)'
  ci_platform: 'github-actions-self-hosted-isolated'
  risk_threshold: 'p1'
---

# Epic 1 — Foundation: Test Automation Expansion

**Project:** Impeachment Intelligence Platform (IIP)
**Epic:** 1 — Foundation (Stories 1.1–1.12)
**Mode:** BMad-Integrated
**Date:** 2026-06-27

> Authority: AC-1 (eval = 8th plane), AC-2 (hard gates non-relaxable), SC-1/2/3 (polyglot/citation/render-separation), PC-9 (property tests), NFR-O-2 (hard CI gates). This workflow EXPANDS coverage beyond the ATDD red-phase scaffolds (which are now GREEN for most stories).

---

## Step 1: Preflight & Context Summary

### 1.1 Stack Detection
- **Detected stack:** `fullstack` (TS Next.js 15 frontend + TS Fastify 5 backend + Python `tools/eval`).
- **Evidence:** `package.json` (TS monorepo, vitest, testcontainers, fast-check) + 16 `vitest.config.ts` files across packages/apps/tests; `tools/eval` (pyproject.toml, uv). `playwright.config.*` NOT yet present (E2E scaffold deferred — no live browser UI integration to automate in Epic 1; Playwright is invoked by `tools/chaos` and deferred E2E).

### 1.2 Framework Verification
- ✅ **Vitest 2.x** — root + per-package configs (16 configs). `pnpm test` wired.
- ✅ **Testcontainers 10.16.0** + **fast-check 3.19.0** + **pg 8.13.3** in root devDeps.
- ✅ **Python eval:** uv + ruff + mypy + pytest via `pnpm py:*` tasks.
- ⚠️ **Playwright 1.50.x** — referenced in ATDD plan but no `playwright.config.ts` exists yet. Epic 1 is greenfield with no E2E surface (compound components are stubbed, tested via Testing Library). E2E gating deferred to Epic 2.9 (chaos) / Epic 5.4 (chat).

### 1.3 Execution Mode
**BMad-Integrated** — epics.md (12 stories w/ ACs), ATDD plan + per-story checklists + INDEX all present.

### 1.4 Epic 1 Implementation Status (sprint-status.yaml, 2026-06-26)
| Story | Title | Status |
|---|---|---|
| 1.1 | Turborepo Scaffold & Process Stubs | ✅ done |
| 1.2 | PG + pgvector + AGE Compatibility | ✅ done |
| 1.3 | Docker Compose Platform Stack | ✅ done |
| 1.4 | Render Gate ESLint Boundary | ✅ done |
| 1.5 | Polyglot Eval Seam | ✅ done |
| 1.6 | Citation Package | ✅ done |
| 1.7 | Design Token System | ✅ done |
| 1.8 | Stubbed Compound Components | 🔄 review |
| 1.9 | State Mgmt & Nav Shell | ✅ done |
| 1.10 | 19 ADRs Seeded | ✅ done |
| 1.11 | CI Pipeline & Gate Store | ✅ done |
| 1.12 | Citation-or-Silence Contract Test | ✅ done |

**11/12 done, 1.8 in review.** Epic 1 implementation is essentially complete → automate runs in **post-implementation expansion** mode (find gaps, edge cases, negative paths, fixtures/factories/helpers).

### 1.5 Existing In-Repo Tests (coverage baseline)
- **Smoke:** `tests/smoke/scaffold-smoke.test.ts`
- **Contract:** `citation-or-silence.test.ts`, `age-boot-ordering.test.ts`, `service-boundaries.test.ts`, `telemetry-pipeline.test.ts`
- **Integration:** `compose-stack.health.test.ts`, `pg-age-pgvector.compat.test.ts`, `polyglot-eval-roundtrip.test.ts`
- **Lint:** `adr-lint.test.ts`, `import-boundaries.test.ts`, `runner-provision.test.ts`
- **Redteam:** `red-team-stub.test.ts`
- **Package unit/contract:** auth, citation (tuple + emit/verify), config (secrets), contracts (eval schema), db (client), editorial, eslint-plugin, eval (bridge/cli/freeze/reproduce), graph, ingest, llm, rag, render (gate)
- **Web component:** answer-block, citation-empty-chip, claim-variants, empty-state, source-verb-tag, trust-badge, state-navigation, design-tokens

### 1.6 TEA Config Flags
| Flag | Value |
|---|---|
| `tea_use_playwright_utils` | `true` (full UI+API profile when browser tests land) |
| `tea_use_pactjs_utils` | `false` (contract-testing fragment used; no HTTP Pact in Epic 1) |
| `tea_pact_mcp` | `none` |
| `tea_browser_automation` | `auto` (no live UI to record — AI generation) |
| `test_stack_type` | `auto → fullstack` |
| `risk_threshold` | `p1` (P0+P1 in scope; P2 optional; P3 skipped by default) |

### 1.7 Knowledge Fragments Loaded (Core tier)
`test-levels-framework.md`, `test-priorities-matrix.md`, `data-factories.md`, `selective-testing.md`, `ci-burn-in.md`, `test-quality.md`, plus Playwright Utils profile (deferred — no browser tests in Epic 1), `contract-testing.md`.

---

_Step 1 complete. Proceeding to Step 2: Identify Automation Targets._

---

## Step 2: Automation Targets & Coverage Plan

### 2.1 Method
Post-implementation expansion. Compared each Epic 1 story's ACs + ATDD checklist against the in-repo source and existing tests to find **untested edge cases, negative paths, and resilience gaps**. ATDD happy-path + primary negative paths are already GREEN — automate adds the **next ring** of defamation-grade and operational assertions. Duplicate coverage explicitly avoided (per `test-levels-framework.md`).

### 2.2 Coverage Gap Analysis (confirmed against source)

| # | Module | Gap (what's NOT tested) | Source evidence |
|---|---|---|---|
| G1 | `render/gate.ts` | **Silence-with-context**: `no_evidence=true` while non-claim context spans ARE preserved (defamation: "silence + preserved context") | gate.test.ts only asserts claim-stripping; never asserts context spans survive alongside `no_evidence` |
| G2 | `render/gate.ts` | **`essence_sentence` truncation boundary** (`.slice(0,200)`) — only empty string tested; 200/201-char boundary untested (PD-1 contract) | gate.ts:61; gate.test.ts:46-57 only `''` |
| G3 | `citation/index.ts` | **Emoji/surrogate-pair span integrity** — `substring()` is code-unit based; astral-plane chars mis-slice → forged span (Filipino/legal docs may contain emoji) | index.ts:98 `substring`; tests use ASCII/Latin only |
| G4 | `answer-block` | **Silence verbatim copy incl. trailing period** — FR-5.3 requires exact "No sourced answer found."; current test uses loose `/…/i` regex w/o period (legal exposure if paraphrased) | answer-block.test.tsx:19 |
| G5 | `eval/bridge.ts` | **Multi-chunk stdout reassembly** — real Python emits JSON across `data` events; bridge accumulates (`stdout += chunk`) but only single-chunk tested | bridge.ts:155-157; bridge.test.ts emits one chunk |
| G6 | `eval/bridge.ts` | **SIGKILL escalation after grace** — `killWithEscalation` does SIGTERM→grace→SIGKILL; only SIGTERM asserted | bridge.ts:89-101; bridge.test.ts:155 |
| G7 | `eval/bridge.ts` | **Multi-line stdout last-line semantics** — `.split('\n').pop()` takes last line; untested when Python logs intermediate lines | bridge.ts:169 |
| G8 | `citation/index.ts` | **Concurrent emit determinism** — N parallel `emit()` calls (Web Crypto) produce identical hashes for same input (PC-9 under BullMQ concurrency) | index.ts:106 async; no concurrency test |
| G9 | `config/secrets.ts` | **Multiple malformed vars** — first-error vs all-errors reporting (NFR-S-4 fail-closed determinism) | secrets.test.ts tests single-var failures only |
| G10 | (cross-cutting) | **Shared test helpers** — `validCitation()` duplicated across gate.test.ts, citation-or-silence.test.ts, gate.test.ts; no `tests/support/` (DRY/maintainability) | no `tests/support/` dir exists |

### 2.3 Targets NOT pursued (avoid duplicate coverage)
- Citation Empty→Chip promotion (UX-DR9) — already thoroughly covered in citation-empty-chip.test.tsx
- Render gate positive/negative primary paths — covered in gate.test.ts + citation-or-silence.test.ts (incl. 1000-run fast-check property)
- Citation emit/verify happy + tamper + property — covered exhaustively in index.test.ts (264 lines)
- E2E / Playwright — no `playwright.config.ts`; Epic 1 is greenfield with no browser integration surface (deferred to Epic 2.9 chaos / Epic 5.4 chat)
- Pact/CDC — `tea_use_pactjs_utils: false`; no HTTP provider boundaries in Epic 1

### 2.4 Test-Level Selection (per `test-levels-framework.md`)
| Target | Level | Rationale |
|---|---|---|
| G1, G2 | Unit (co-located `packages/render/src/`) | Pure function; fastest feedback; defamation primitive |
| G3, G8 | Unit + property (co-located `packages/citation/src/`) | Pure async; defamation primitive; property for concurrency |
| G4 | Component (co-located `apps/web/components/iip/answer-block/`) | UI render assertion; jsdom |
| G5, G6, G7 | Unit (co-located `packages/eval/src/`) | Mocked subprocess; polyglot seam resilience |
| G9 | Unit (co-located `packages/config/src/`) | Pure validation; fail-closed boot |
| G10 | Infrastructure (`tests/support/`) | Shared helpers consumed by G1-G4 |

### 2.5 Priority Assignment (per `test-priorities-matrix.md`, `risk_threshold: p1`)
| ID | Target | Priority | Severity | Justification |
|---|---|---|---|---|
| T-G1 | Silence-with-context | **P0** | T1 | Defamation: silence state must still preserve non-claim context deterministically |
| T-G2 | essence_sentence truncation | **P0** | T1 | PD-1 essence is user-facing contract; off-by-one = wrong framing |
| T-G3 | Emoji/surrogate span integrity | **P0** | T1 | Forged span = wrong attribution = cyberlibel exposure |
| T-G4 | Silence verbatim copy | **P0** | T1 | FR-5.3 verbatim; paraphrase = republication risk |
| T-G5 | Multi-chunk stdout | **P1** | T2 | Eval flakiness → silent metric drift |
| T-G6 | SIGKILL escalation | **P1** | T2 | Hung eval = blocked CI; orphan processes |
| T-G7 | Multi-line stdout | **P1** | T2 | Python logging interleaves → phantom MALFORMED |
| T-G8 | Concurrent emit determinism | **P1** | T1/T2 | PC-9 under BullMQ concurrent writers |
| T-G9 | Multiple malformed vars | **P1** | T2 | NFR-S-4 determinism |
| T-G10 | Shared helpers | **P1** | T3 | Maintainability enabler for T-G1..G4 |

**Scope:** 10 targets, all P0/P1 (within `risk_threshold: p1`). P2/P3 skipped by default.

### 2.6 Coverage Strategy
**Critical-paths + defamation-spine ring.** Epic 1 happy paths are GREEN; this pass hardens the failure modes that a libel-defense audit or BullMQ concurrency would surface. No E2E (deferred). Co-located unit/component tests follow the locked `*.test.ts` / `*.test.tsx` convention.

---

_Step 2 complete. Proceeding to Step 3: Generate Tests._

---

## Step 3: Generate Tests (Sequential — subagent dispatch infra-failed)

**Execution mode resolution:** `auto` → probe enabled → subagent supported, agent-team not → resolved **subagent**. Two parallel `Task` subagent dispatches failed (`NOT NULL constraint failed: session_message.seq` — Task-tool infra error). Per fallback rules, executed **sequentially** (direct generation). All 10 targets generated directly by the orchestrator with full source context loaded.

### 3.1 Generated Test Files (6 new files + 1 source fix + 1 infra module)

| File | Target(s) | Tests | P0 | P1 |
|---|---|---|---|---|
| `packages/render/src/gate-silence-context.test.ts` | G1, G2 | 6 | 4 | 2 |
| `packages/citation/src/citation-unicode.test.ts` | G3, G8 | 8 | 4 | 4 |
| `packages/eval/src/bridge-resilience.test.ts` | G5, G6, G7 | 5 | 0 | 5 |
| `packages/config/src/secrets-multi.test.ts` | G9 | 5 | 0 | 5 |
| `apps/web/components/iip/answer-block/answer-block-verbatim.test.tsx` | G4 | 3 | 2 | 1 |
| `tests/support/fixtures.ts` | G10 | — (infra) | — | — |
| **TOTAL** | | **27** | **10** | **17** |

### 3.2 Source Fix Applied (BUG FOUND — spec divergence)

**`apps/web/components/iip/answer-block/index.tsx`** — silence headline rendered `"No sourced answer found"` **without** the trailing period. UX-DR18 / UX-DR50 / FR-5.3 all specify the verbatim copy **with** the period (`"No sourced answer found."`). For defamation-grade microcopy reviewed by legal counsel, the period is part of the legally-approved wording. Applied the one-char spec-aligned fix (`+ "."`). The existing `answer-block.test.tsx` (loose `/…/i` regex) still passes; the new verbatim test now passes too.

---

## Step 3C + Step 4: Aggregation, Validation & Summary

### 4.1 Validation Results (all green)

| Check | Result |
|---|---|
| `pnpm --filter @iip/render test` | ✅ 15 passed (6 new) |
| `pnpm --filter @iip/citation test` | ✅ 40 passed (8 new) |
| `pnpm --filter @iip/eval test` (bridge-resilience) | ✅ 5 passed |
| `pnpm --filter @iip/config test` | ✅ 24 passed (5 new) |
| `apps/web` answer-block-verbatim | ✅ 3 passed |
| Typecheck (render, citation, eval, config) | ✅ clean |
| ESLint (all 6 new files + fixtures) | ✅ clean (fatal-five satisfied) |
| Existing answer-block.test.tsx (regression after fix) | ✅ 4 passed |
| **27 new tests** | **✅ all passing** |

### 4.2 Conventions Enforced (per checklist.md)
- ✅ `*.test.ts` / `*.test.tsx` naming (no `.spec`)
- ✅ Priority tags `[P0]` / `[P1]` in every test name
- ✅ Given-When-Then comments (`// GIVEN` / `// WHEN` / `// THEN`)
- ✅ JSDoc `@rules` / `@adr` citations on every file
- ✅ Co-located with source (mirror existing patterns)
- ✅ No flaky patterns (no hard waits, no conditional flow, deterministic)
- ✅ No hardcoded secrets; no `console.log`
- ✅ Duplicate coverage avoided (E2E/Pact deferred — not in Epic 1 scope)

### 4.3 Coverage Summary
- **Stack:** fullstack (TS). No E2E generated (Playwright config absent; Epic 1 greenfield — deferred to Epic 2.9/5.4).
- **Levels used:** Unit (render, citation, eval, config) + Component (answer-block) + Infrastructure (tests/support).
- **Priority:** P0 = 10 (defamation spine), P1 = 17 (credibility/operational). P2/P3 skipped per `risk_threshold: p1`.
- **Knowledge fragments applied:** `test-levels-framework`, `test-priorities-matrix`, `test-quality`, `data-factories`, `contract-testing`, `ci-burn-in`.

### 4.4 Definition of Done (checklist.md)
- [x] Execution mode determined (BMad-Integrated → sequential after subagent infra-fail)
- [x] Framework config loaded + validated (Vitest 2.x)
- [x] Coverage gaps identified (10 gaps, all P0/P1)
- [x] Test levels selected (unit/component; no E2E in scope)
- [x] Duplicate coverage avoided
- [x] Priorities assigned (P0/P1 only)
- [x] Shared fixture infrastructure created (`tests/support/fixtures.ts`)
- [x] Test files generated + GWT format + priority tags
- [x] Quality standards enforced (lint fatal-five clean)
- [x] Tests validated — all 27 passing
- [x] Automation summary saved

### 4.5 Key Findings & Risks
1. **BUG FIXED (P0):** answer-block silence copy missing the spec-required trailing period — fixed to match UX-DR50/FR-53 verbatim.
2. **No `tests/support/` existed** — established with `fixtures.ts` (`makeCitationRef`, `makeRenderInput`, `citedSpan`/`uncitedSpan`/`contextSpan`) for future contract/integration suites. Existing per-package `validCitation()` duplication can be migrated incrementally (packages cannot import from `tests/`).
3. **Eval bridge `stdout.split('\n').pop()`** takes the LAST line — if Python logs AFTER the result JSON, the result is lost. Test G7 documents this; flagged for a future bridge hardening (emit result on a dedicated line / length-prefix).
4. **Subagent infra-failure** (`session_message.seq`) prevented parallel generation — fell back to sequential. Re-run capability exists if Task-tool recovers.

### 4.6 Next Recommended Workflows
- **`testarch-trace`** — regenerate traceability matrix to include the 10 new targets mapped to INV-001/AC-2/AC-4/PC-9.
- **`testarch-test-review`** — adversarial review of the 6 new files (especially the SIGKILL fake-timer test and the emoji surrogate-split assertion).
- When Epic 2.1 lands (render gate live), the `essence_sentence` and silence-with-context tests here become part of the activated regression net.

---

_Workflow complete. 27 tests added across 6 files; 1 spec-divergence bug found & fixed; typecheck + lint clean._
