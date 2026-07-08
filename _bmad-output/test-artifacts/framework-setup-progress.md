---
stepsCompleted: ['step-01-preflight', 'step-02-select-framework', 'step-03-scaffold-framework', 'step-04-docs-and-scripts', 'step-05-validate-and-summary']
lastStep: 'step-05-validate-and-summary'
lastSaved: '2026-07-08'
workflow: 'bmad-testarch-framework'
epicId: '3'
epicTitle: 'Source Onboarding & Intelligence Ingestion'
mode: 'Create'
detectedStack: 'fullstack'
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/implementation-artifacts/epic-3-prep-sprint-2026-07-08.md
  - _bmad-output/implementation-artifacts/sprint-status.yaml
  - _bmad-output/project-context.md
  - _bmad-output/test-artifacts/automation-summary-epic-2.md
  - package.json
  - vitest.workspace.ts
  - _bmad/tea/config.yaml
teaConfig:
  tea_use_playwright_utils: true
  tea_use_pactjs_utils: false
  tea_pact_mcp: 'none'
  tea_browser_automation: 'auto'
  test_stack_type: 'auto -> fullstack'
  test_framework: 'vitest@2.x (unit/contract), testcontainers@10.x (integration), fast-check@3.x (property), stryker@8.x (mutation)'
  ci_platform: 'github-actions-self-hosted-isolated'
  risk_threshold: 'p1'
---

# Epic 3 — Test Framework Architecture: Preflight

**Project:** Impeachment Intelligence Platform (IIP)
**Epic:** 3 — Source Onboarding & Intelligence Ingestion (Stories 3.1–3.7)
**Mode:** Create (first Epic 3 testarch pass)
**Date:** 2026-07-08

> Authority: AC-1 (eval = 8th architectural plane), AC-2 (render gate, fail-closed), AC-4 (citation decoupled from retrieval), AC-11 (hash-chained editorial log), FR-1.1–FR-1.7 (source/ingest functional requirements), SEC-2 (two-person intake), SEC-3 (trust tier at ingest), SEC-6 (audit-log primitive), NFR-L-1 (robots.txt), NFR-S-5 (append-only raw snapshots), NFR-R-2/NFR-R-3 (resilience/checkpoint), PC-1a/PC-1d/PC-2.4 (idempotency/queue substrate), STR-1/STR-2/STR-3/STR-5 (package boundaries + AGE writer + Enqueuer handoff), ADR-006 (Docling+PaddleOCR), ADR-007 (fetch-adapter tiers). Epic 3 prep sprint (TD1–TD9) partially landed in commit `cc57513`.

---

## Step 1: Preflight Findings

### 1.1 Stack Detection — `fullstack` (confirmed, matches Epic 1 & 2)

**Auto-detection result:** `fullstack`.

**Frontend indicators (present):**
- `package.json` root — React 19 / Next.js 15 (App Router), Tailwind 4, shadcn/ui, React Query 5, Zustand 5, nuqs 2.
- `apps/web` workspace with `vitest.config.ts`.
- `@testing-library/react` + `@testing-library/user-event` + `msw` per project-context §Testing & Eval.
- **No `playwright.config.ts` at root** — Playwright 1.50.x is referenced by the chaos stack and the E2E plan, but the browser framework has NOT been bootstrapped yet. This is an Epic 3 gap (Story 3.7 operator triage surface is the first E2E-worthy UI).

**Backend indicators (present):**
- TS backend: Fastify 5.x (`apps/api`), BullMQ 5.x + LangGraph.js 1.4.7 (`apps/ingest-worker`, `apps/serve-worker`, `apps/audit-worker`, `apps/enqueuer`), Drizzle 0.35.x (`packages/db`), AGE (openCypher raw templates).
- Python backend: `tools/eval/pyproject.toml` (uv + ruff + mypy + pytest) — polyglot eval bridge per ADR-014.

**Both present ⟹ `fullstack`.** Consistent with Epic 1 (`automation-summary.md`) and Epic 2 (`automation-summary-epic-2.md`) detection.

### 1.2 Prerequisite Validation — ✅ ALL PASS (with caveats)

| Check | Result | Evidence |
|---|---|---|
| `package.json` exists at root | ✅ | `/package.json` — pnpm@9.15.4, Node 22, type: module |
| No conflicting E2E framework at root | ✅ | No `playwright.config.*` / `cypress.config.*` / `cypress.json` |
| Backend manifest present | ✅ | `tools/eval/pyproject.toml`; root `package.json` carries full backend dep set |
| No conflicting pytest/JUnit suite | ✅ | `tools/eval` pytest is scoped (eval only), not a root backend suite |
| Architecture / stack context available | ✅ | `_bmad-output/planning-artifacts/architecture.md`, `epics.md`, `project-context.md` |
| Vitest 2.x installed | ✅ | root devDep `vitest@^2.1.8` |
| Testcontainers 10.x installed | ✅ | root devDep `testcontainers@10.16.0` |
| fast-check 3.x installed | ✅ | root devDep `fast-check@^3.19.0` |
| Stryker 8.x installed | ✅ | root devDeps `@stryker-mutator/core@^8` + `@stryker-mutator/vitest-runner@^8` |
| Custom PG image (F1 prereq) | ⚠️ verified-by-reference | Per project-context: `pgvector/pgvector:pg16` + AGE `PG16/v1.6.0-rc0` shared by Compose + Testcontainers. NOT re-verified in this preflight (test-artifacts scope). |
| MinIO in stack | ✅ | Compose service; required by Story 3.4 (immutable raw snapshots). |

**Caveat — Playwright bootstrap pending:** `tea_use_playwright_utils: true` in config, but no Playwright config exists. The Epic 2 summary deferred browser E2E ("no live browser integration surface in Epic 2"). Story 3.7 (operator triage surface) is the first real UI surface → Playwright bootstrap belongs in this Epic 3 testarch pass. Step 2 (framework selection) will address this explicitly.

### 1.3 Project Context Summary

**Monorepo shape (Turborepo 2.9.x + pnpm 9.x workspaces):**
- `apps/*` — `api` (Fastify 5), `web` (Next 15), `ingest-worker`, `serve-worker`, `audit-worker`, `enqueuer`. **TD1 (API bootstrap) + TD5 (editorial boot wiring) just landed in `cc57513`** — `apps/api` is now a real Fastify server, not the Story 1.1 `console.log('alive: api')` stub.
- `packages/*` — `contracts`, `db`, `config`, `auth`, `render`, `citation`, `editorial`, `intake`, `ingest`, `graph`, `rag`, `eval`, `llm`, `eslint-plugin`, `test-utils`. **TD2 (STR-1 `ingest`+`intake` consolidation) landed in `cc57513`** — both packages still exist post-merge (consolidation outcome needs confirmation in Step 2).
- `tools/` — `eval`, `chaos` (NOT workspace members per STR-12; `uv`-shimmed).

**Epic 3 prep status (sprint-status.yaml + prep doc, 2026-07-08):**
| TD | Title | Status |
|---|---|---|
| TD1 | Bootstrap real API server | ✅ done (`cc57513`) |
| TD2 | STR-1 `ingest`+`intake` consolidation | ✅ done (`cc57513`) |
| TD3 | New DB tables (`sources`, `documents`, `ingestion_jobs`) | ✅ done (`cc57513` — ingest tables) |
| TD4 | Queue/orchestration substrate spike | 🟡 partial — BullMQ + Enqueuer + idempotency contract DONE; LangGraph checkpoint slice DEFERRED to Story 3.6 |
| TD5 | Editorial-log boot wiring | ✅ done (`cc57513`) |
| TD6–TD9 | oq9 catch-up, sops install, genesis test, error-enum test | ⏸ medium priority |

**Epic 3 feature stories (target of this testarch pass):**
| Story | Title | FR | Key invariants/rules |
|---|---|---|---|
| 3.1 | Source Registry w/ Confirmed Trust Tiers | FR-1.1 | SEC-3 (trust tier at ingest), EI-8 (citation-quality floor), Drizzle `sources` table |
| 3.2 | Lawful-Access Gate | FR-1.2 | NFR-L-1 (robots.txt), disable-not-bypass, AC-11 override log, manual-override policy |
| 3.3 | Discover, Fetch & Deduplicate | FR-1.3 | content_checksum dedup (PC-1a), Firecrawl + manual adapters (ADR-007), Docling+PaddleOCR OCR (ADR-006), manual-upload provenance record |
| 3.4 | Immutable Raw Snapshots | FR-1.4 | MinIO content-addressed SHA-256, append-only versioned bucket (NFR-S-5), off serving path |
| 3.5 | Per-Artifact Provenance | FR-1.5 | idempotent upsert (PC-1a), provenance decoupled from embeddings (AC-4), citation package wire (Story 1.6) |
| 3.6 | Idempotent, Observable, Resilient Ingestion | FR-1.6 | jobId=sha256(dedupe-anchor), per-stage queue (PC-1d/PC-2.4), DLQ `dlq:ingest` (NFR-R-2), Enqueuer handoff (STR-3), LangGraph checkpoint (NFR-R-3) |
| 3.7 | Operator Triage Surface | FR-1.7 | failed/DLQ display, reprocess, spot-check side-by-side, ingestion health metrics (NFR-O-1), shadcn admin patterns |

**Existing test framework inventory (extend, don't duplicate):**
- **Vitest workspace** (`vitest.workspace.ts`) — 12 package projects + 7 root suites: `smoke`, `contract`, `contract-red`, `integration`, `lint`, `perf`, `chaos`.
- **`packages/test-utils`** — factories: `intake.ts` (TestKeyPair, TestPrincipal, TestIntakeDocument, createContentHash, createSignature), `config-history.ts` (Story 2.10). Barrel exports via `src/index.ts`. **No Epic 3 factories yet** (no `source.ts`, `document.ts`, `ingestion-job.ts`).
- **`tests/contract/`** — 16 contract tests incl. `ingestion-idempotency-contract.md` (RED, TD4 deliverable), `render-gate-live.contract.test.ts`, `editorial-error-enum.contract.test.ts`, boundary tests.
- **`tests/integration/`** — 18 integration tests incl. `ingest-schema.integration.test.ts`, `api-routes-intake/query.integration.test.ts`, `audit-health-gate.integration.test.ts`, `editorial-log*.integration.test.ts`.
- **`tests/support/`** — `fixtures.ts` + empty `page-objects/` dir (Playwright page objects scaffolded but unused — browser framework not bootstrapped).
- **Python `tools/eval`** — uv + ruff + mypy + pytest; polyglot bridge (ADR-014).
- **Stryker** — `stryker.config.json`; 100/100/100 mandated on `gate.ts` + `verify.ts`; ≥90% on `citation/verify.ts`, `intake/state.ts`, `extract/worker.ts`.

### 1.4 Framework Already Installed? — **Partially (Vitest stack yes; Playwright no)**

- ✅ **Vitest 2.x stack** — fully installed and operational (Epic 1 & 2 GREEN).
- ❌ **Playwright 1.50.x** — referenced but NOT bootstrapped (no config, no `@playwright/test` in root deps, `tests/support/page-objects/` empty). Story 3.7 needs it.
- ❌ **Pact JS** — `tea_use_pactjs_utils: false`; not in scope per config.
- ⚠️ **msw** — referenced in project-context as required for component + Playwright mocking; presence in `apps/web` not re-verified in this preflight (Step 2 will confirm).

### 1.5 Context Docs Found

- `_bmad-output/planning-artifacts/architecture.md` — binding amendments (AC/PD/SC/SEC/PC/STR/VAL), ADRs.
- `_bmad-output/planning-artifacts/epics.md` — Epic 3 stories (lines 730–850).
- `_bmad-output/project-context.md` — 60 existing patterns; technology stack; critical implementation rules.
- `_bmad-output/implementation-artifacts/epic-3-prep-sprint-2026-07-08.md` — TD1–TD9 prep status.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story statuses.
- `_bmad-output/test-artifacts/automation-summary-epic-2.md` + `automation-summary.md` — Epic 1/2 automation precedent.

---

## Preflight Verdict: ✅ PROCEED TO STEP 2

All prerequisites pass. The framework is **not** a greenfield scaffold — it's an **expansion** of the existing Vitest-centric stack to cover Epic 3's source/ingestion domain, with two open decisions for Step 2:

1. **Playwright bootstrap** — Story 3.7 (operator triage surface) is the first UI surface needing real browser E2E. Do we bootstrap Playwright 1.50.x now, or defer to Story 3.7 implementation?
2. **Epic 3 factory scope** — confirm which new `@iip/test-utils` factories to add (sources, documents, ingestion_jobs, fetch adapters, MinIO snapshots).

Next: load `step-02-select-framework.md`.

---

## Step 2: Framework Selection — DECISION

**Detected stack:** `fullstack` ⟹ browser framework + backend framework(s).

### Browser Framework: **Playwright 1.50.x** ✅

Not Cypress. All "Playwright recommended when" criteria hold, reinforced by binding mandates:

| Criterion | Fit |
|---|---|
| Large/complex repo | ✅ Turborepo monorepo, 12 packages + 6 apps, defamation-grade invariants |
| Multi-browser | ✅ operator surface cross-browser; Cypress is Chromium-first |
| Heavy API + UI integration | ✅ Story 3.7 triage surface → Fastify `/api/v1` + MinIO + BullMQ |
| CI parallelism | ✅ SEC-4 isolated runner; Playwright sharding > Cypress |
| Binding project mandate | ✅ `project-context.md` pins "Playwright 1.50.x — pin to patch"; `tea_use_playwright_utils: true`; `tests/support/page-objects/` scaffolded (empty) |
| Toolchain coherence | ✅ pairs with mandated **msw** + k6/xk6-browser chaos semantics |

**Cypress disqualifiers:** can't drive multi-origin Fastify+MinIO topology cleanly; its component-testing is redundant with the existing Vitest + Testing-Library setup.

### Backend Frameworks (extend, don't replace)

| Layer | Framework | Status |
|---|---|---|
| TS unit/contract/component | Vitest 2.x | ✅ operational — 12 package configs + 7 root suites |
| Integration | Testcontainers 10.16.0 | ✅ operational — real PG+AGE+pgvector, MinIO, Redis |
| Property | fast-check 3.x | ✅ installed — AC-2 no-uncited-path, provenance depth-N |
| Mutation | Stryker 8.x | ✅ operational — 100/100/100 on gate.ts/verify.ts |
| Python eval | pytest (uv + ruff + mypy) | ✅ operational — tools/eval polyglot bridge (ADR-014) |
| Chaos | k6 0.50.x + toxiproxy + Pumba | ✅ operational — tests/chaos/ (SC-6) |

### Gap Surfaced — Playwright Bootstrap Pending

The Vitest/Testcontainers/Stryker/pytest stack is GREEN from Epic 1/2. **Playwright 1.50.x is referenced but NOT bootstrapped**: no `playwright.config.ts`, no `@playwright/test` in root deps, `tests/support/page-objects/` empty. Story 3.7 (operator triage surface) is the first UI needing real browser E2E → **Step 3 bootstraps Playwright + the Epic 3 domain test scaffolding**.

Next: load `step-03-scaffold-framework.md`.

---

## Step 3: Scaffold Framework — EXECUTED (agent-team mode, 3 parallel workers)

**Execution mode resolved:** `auto` → **`agent-team`** (capability probe + concurrent Agent dispatch).

### Worker A — Directory + Playwright config + env
**Files created:**
- `playwright.config.ts` (root) — `defineConfig` + `devices`; 2 projects (chromium, firefox); HTML+JUnit+list reporters; `retain-on-failure-and-retries` trace; webServer reuses `@iip/web dev` (CI-gated). `@rules AC-1, FR-1.7, NFR-O-1`.
- `tests/e2e/operator-triage-surface.smoke.spec.ts` — `test.skip('TODO: Story 3.7')` (CI-green placeholder; Given/When/Then + `data-testid` strategy commented).
- `tests/support/fixtures/.gitkeep`, `tests/support/page-objects/.gitkeep`.

**Files modified:**
- `package.json` — added scripts `test:e2e`, `test:e2e:ui`, `test:e2e:report`; added devDep `@playwright/test@1.50.1` (patch pin per project-context).
- `.env.example` — appended Playwright section (`PLAYWRIGHT_BASE_URL`, `TEST_ENV`).
- `.gitignore` — appended `/test-results/`, `/playwright-report/`, `/playwright/.cache/`.

### Worker B — Epic 3 test factories (`@iip/test-utils`)
**Files created:**
- `packages/test-utils/src/factories/source.ts` — `TestSource` + `asSourceId`/`asSourceSourceType`/`asCrawlStrategy` + `makeSource()`. `@rules FR-1.1, SEC-3, EI-8`.
- `packages/test-utils/src/factories/document.ts` — `TestDocument` + `TestFetchMetadata` + `asDocumentId`/`asContentChecksum`/`asRawSnapshotKey` + `makeDocument()`. `@rules FR-1.3, FR-1.5, PC-1a, AC-4`.
- `packages/test-utils/src/factories/ingestion-job.ts` — `TestIngestionJob` + `TestJobError` + `asJobId`/`asJobState`/`asStateRunId` + `makeIngestionJob()`. `@rules FR-1.6, PC-2.4, NFR-R-1/2/3`.

**Files modified:**
- `packages/test-utils/src/index.ts` — barrel re-exports 12 new value exports + 5 new type exports (existing intake + config-history exports intact).

### Worker C — Contract test + helpers
**Files created:**
- `tests/contract/ingest-domain.contract.test.ts` — 45 contract assertions across all Epic 3 zod schemas + queue constants. `@rules FR-1.1, FR-1.3, FR-1.4, FR-1.5, FR-1.6, SEC-3, PC-4 @adr ADR-001`.
- `tests/support/helpers/ingest.ts` — 5 pure helper functions (`makeValidSourceId`, `makeValidContentChecksum`, `makeValidJobId`, `makeInvalidUuid`, `makeInvalidHex`). `@rules PC-9`.
- `tests/support/helpers/ingest.test.ts` — 7 unit tests for the helpers.

### Coordination fix (post-worker)
- `vitest.workspace.ts` — added a `support` project (`include: ['tests/support/**/*.test.ts']`) so the co-located helper test is discovered (Worker C flagged this gap).

### Verification (run, not assumed)
- ✅ `pnpm --filter @iip/test-utils typecheck` — EXIT 0 (new factories compile under strict mode).
- ✅ `pnpm --filter @iip/test-utils test` — 3/3 barrel smoke tests pass.
- ✅ `pnpm vitest run --project contract tests/contract/ingest-domain.contract.test.ts` — **45/45 pass**.
- ✅ `pnpm vitest run --project support` — **7/7 pass**.
- ✅ Playwright config TS: only error is `Cannot find module '@playwright/test'` (expected — `pnpm install` not yet run; no other TS errors).

### Activation commands (not run — defer to operator)
```bash
pnpm install                        # resolves @playwright/test + hoisted deps
pnpm exec playwright install        # downloads chromium + firefox binaries
```

Next: load `step-04-docs-and-scripts.md`.

---

## Step 4: Documentation & Scripts — EXECUTED

### `tests/README.md` — CREATED
Comprehensive test-suite documentation: stack table, setup (incl. `playwright install`), run commands (Vitest projects + Playwright + Python eval), factory/helper/fixture architecture, best practices (selectors, isolation, cleanup, determinism contract, `@rules`/`@adr` citation), CI integration (PR/nightly/PD-3 lanes, SEC-4 isolated runner), knowledge-base references.

### Scripts — already added in Step 3
- `test:e2e`, `test:e2e:ui`, `test:e2e:report` (Playwright).
- Python eval scripts (`py:test`, `py:lint`, `py:typecheck`) pre-existed.

Next: load `step-05-validate-and-summary.md`.

---

## Step 5: Validate & Summarize — COMPLETE

### Validation against `checklist.md`

**Prerequisites** — ✅ all pass (Step 1).
**Process steps 1–11** — ✅ all executed. Notes on items that map non-obviously to this monorepo:
- Step 3 "support/factories/" — IIP factories live in `packages/test-utils/src/factories/` (the package is the shared factory home, consumed across all packages + apps), NOT under `tests/support/factories/`. The `tests/support/fixtures/` dir is for Playwright fixture composition. This is a deliberate deviation that matches the established Epic 1/2 pattern (intake.ts, config-history.ts factories already lived in `packages/test-utils`).
- Step 6 "fixtures/index.ts + mergeTests" — deferred. Playwright fixtures will be composed when Story 3.7 lands real E2E scenarios; the framework is bootstrapped but there are no browser flows to compose yet (the sample spec is `test.skip`).
- Step 7 "factories use @faker-js/faker + cleanup()" — IIP factories use deterministic UUIDs/timestamps (not faker) per the established `config-history.ts` precedent; cleanup is via Testcontainers Ryuk + per-test Playwright browser contexts (no in-process mutable factory state).
- Step 8 "sample test runs successfully" — the Playwright spec is intentionally `test.skip('TODO: Story 3.7')` (route doesn't exist); the Vitest contract + helper tests DO run: **45/45 + 7/7 pass**.

**Output validation** — ✅. Config syntactically valid (only expected `@playwright/test` not-found until `pnpm install`). Generated files carry no placeholder TODOs beyond the intentional `test.skip` reason. No hardcoded secrets.

**Quality checks** — ✅. Code follows project conventions (`verbatimModuleSyntax`, branded types, `@rules`/`@adr` JSDoc, strict TS). Knowledge fragments applied: `fixture-architecture.md` (pure-function-first), `data-factories.md` (factory-with-overrides), `playwright-config.md` (env map + timeouts + artifacts), `test-levels-framework.md`, `contract-testing.md`.

**Pact alignment** — N/A (`tea_use_pactjs_utils: false`).

**Security** — ✅. `.env.example` uses placeholders; no secrets committed.

### Completion Summary

**Framework selected:** Playwright 1.50.x (browser E2E) + the existing Vitest 2.x / Testcontainers 10.16 / fast-check 3.x / Stryker 8.x / pytest stack (extended, not replaced).

**Artifacts created (12 new files, 5 modified):**

| Path | Kind | Purpose |
|---|---|---|
| `playwright.config.ts` | new | Playwright config (2 projects, reporters, webServer) |
| `tests/e2e/operator-triage-surface.smoke.spec.ts` | new | CI-green `test.skip` placeholder for Story 3.7 |
| `tests/support/fixtures/.gitkeep` | new | Playwright fixture composition dir |
| `tests/support/page-objects/.gitkeep` | new | Page object dir (Story 3.7 fills) |
| `tests/support/helpers/ingest.ts` | new | 5 pure helpers (valid/invalid ID + checksum generators) |
| `tests/support/helpers/ingest.test.ts` | new | 7 unit tests for helpers |
| `tests/contract/ingest-domain.contract.test.ts` | new | 45 contract assertions on Epic 3 zod schemas |
| `packages/test-utils/src/factories/source.ts` | new | `makeSource()` + brand-bypass helpers |
| `packages/test-utils/src/factories/document.ts` | new | `makeDocument()` + brand-bypass helpers |
| `packages/test-utils/src/factories/ingestion-job.ts` | new | `makeIngestionJob()` + brand-bypass helpers |
| `tests/README.md` | new | Full test-suite documentation |
| `_bmad-output/test-artifacts/framework-setup-progress.md` | new | This progress file |
| `package.json` | mod | +`@playwright/test@1.50.1`, +3 e2e scripts |
| `.env.example` | mod | +Playwright section |
| `.gitignore` | mod | +Playwright artifacts |
| `packages/test-utils/src/index.ts` | mod | +12 value / +5 type re-exports |
| `vitest.workspace.ts` | mod | +`support` project |

**Verification (executed):**
- ✅ `pnpm --filter @iip/test-utils typecheck` — EXIT 0
- ✅ `pnpm --filter @iip/test-utils test` — 3/3 pass
- ✅ `pnpm vitest run --project contract ...ingest-domain...` — 45/45 pass
- ✅ `pnpm vitest run --project support` — 7/7 pass

**Next steps for operator:**
1. `pnpm install` — resolve `@playwright/test@1.50.1`.
2. `pnpm exec playwright install` — download chromium + firefox binaries.
3. Run `pnpm test:e2e` — confirms the framework wires up (sample spec reports as skipped).
4. Proceed to the **test-design** workflow (Epic 3 coverage plan) or the **atdd** workflow (story-level ATDD checklists) — the framework is now ready for both.

**Knowledge fragments applied:** `fixture-architecture.md`, `data-factories.md`, `playwright-config.md`, `test-levels-framework.md`, `contract-testing.md`.

**Compatible downstream workflows:** `ci`, `test-design`, `atdd`, `automate`, `trace`, `nfr`, `test-review`.

---

## Activation Run (2026-07-08) — next steps executed

### 1. `pnpm install` — ✅ (with version bump)
- **Conflict surfaced:** Next 15.5.19 (resolved from `apps/web`'s `next@^15.1.0`) declares peer dep `@playwright/test@^1.51.1`. The scaffold's original pin `1.50.1` (per project-context "Playwright 1.50.x") failed under `.npmrc` `strict-peer-dependencies=true`.
- **Resolution:** bumped `@playwright/test` `1.50.1 → 1.51.1` (exact patch pin — maintains "pin to patch" discipline while satisfying Next's peer requirement).
- **`pnpm-lock.yaml` updated:** +6 / −207 packages (Playwright subtree resolved).
- **Deviation flagged:** project-context §Testing & Eval says "Playwright 1.50.x"; the actually-installed Next 15.5.19 forces ≥1.51.1. Recommend updating the project-context note to "Playwright 1.51.x" (or relaxing to `^1.51.1`). Architect (Winston) decision.

### 2. `pnpm exec playwright install` — ✅
- Downloaded: Chromium, Firefox 135.0, WebKit 18.4 → `~/Library/Caches/ms-playwright/`.

### 3. `pnpm test:e2e` — ✅
- **First run failed:** `webServer` timed out (120s) — a **stray hung `next-server` process (pid 12853)** was occupying port 3000 but not responding to requests (the dev server had hung). Playwright's `reuseExistingServer` couldn't health-check it, fell back to booting its own dev server on 3003, then the `localhost:3000` probe timed out.
- **Fix:** killed the stray process (`kill -9 12853`); freed port 3000.
- **Second run succeeded:** Playwright booted its own `@iip/web dev`, discovered the spec, ran **2 tests (chromium + firefox), both skipped** as designed (`test.skip('TODO: Story 3.7')`). Exit clean.
- **Environmental note (not a scaffold defect):** the hung next-server was a pre-existing stray process on the operator's machine, not caused by the scaffold. Flagged here for reproducibility.

### Open items for operator/architect
1. **Project-context version note stale:** "Playwright 1.50.x" → should read "1.55.x" (Next 15.5.19 forces ≥1.51.1; GHSA-7mvr-c777-76hp forces ≥1.55.1). Low-priority doc fix.
2. **`.npmrc` doc/file drift:** project-context says `strict-peer-dependencies=false` ("React 19 peer conflicts"); the committed `.npmrc` says `=true`. This is pre-existing drift, not introduced here. The `=true` setting is what forced the exact-version bump rather than allowing a range. Architect decision whether to align file with doc.
3. **postcss@8.4.31 moderate (GHSA-qx2v-qp2m-jg93):** transitive of next@15.5.19 (bundled). Pre-existing on main (postcss@8.4.31 + next@15.5.19 both in main's lockfile; main's audit passed). The CI audit gate is `--audit-level=high` (ci.yml:223), so moderate is non-blocking. Not fixable without a Next version bump that ships postcss ≥8.5.10 — out of scope for this PR. Flagged for a future Next upgrade.

### Security fix (post-activation)
- **Initial pin `@playwright/test@1.50.1`** bumped to `1.51.1` (Next 15.5.19 peer dep `^1.51.1`), then to **`1.55.1`** to resolve **GHSA-7mvr-c777-76hp** (HIGH: Playwright downloads/installs browsers without verifying SSL certificate authenticity; patched in `>=1.55.1`). 1.55.1 satisfies both Next's peer dep and the security advisory. Audit now reports only the pre-existing postcss moderate (non-blocking).
