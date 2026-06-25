---
story_id: '1.4'
story_key: '1-4-render-gate-eslint-boundary'
epic: 'Epic 1: Foundation'
status: done
last_updated: '2026-06-25'
baseline_commit: 545cfd9
amendments_applied: '2026-06-25 — Party Mode consensus (Winston/Amelia/Murat/Mary). 6 amendments applied per adversarial review. See CHANGELOG.'
---

# Story 1.4: Render Gate ESLint Boundary (AC-2)

Status: review

## Story

As a developer,
I want a structurally separate render package with ESLint-enforced import boundaries,
So that the citation-or-silence invariant is mechanically unreachable by the generation code path.

## Acceptance Criteria

1. `packages/render` imports **only** `@iip/contracts` (SC-3). Its `package.json` dependency set contains `@iip/contracts` and no other workspace or runtime package (AC-F1-08). (AC: #1)
2. `@iip/render` is **banned** from being imported inside `packages/rag/**` and `apps/serve-worker/src/processors/rag/**` (STR-4). (AC: #2)
3. `packages/contracts/src/render.ts` is the single shared contract between `packages/rag` and `packages/render`. No other cross-package type or function is used at the rag→render seam (SC-3, STR-4). (AC: #3)
4. The existing `renderGate` stub in `packages/render/src/gate.ts` is updated to return a `RenderDocument` without throwing, while still demonstrating the fail-closed shape: uncited claim spans are stripped, `no_evidence` is set when no cited claims remain, and cited claim spans are preserved. It must remain a placeholder — it does **not** perform real substring/NLI validation; that is Story 2.1 (AC: #4).
5. The root `eslint.config.js` is upgraded from the foundational ruleset to enforce the SC-3/STR-4/STR-5 import boundaries using `eslint-plugin-import` flat-config rules (`no-restricted-imports`, `no-restricted-paths`, `no-relative-packages`). (AC: #5)
6. A custom rule package `@iip/eslint-plugin` is scaffolded (lean): it contains at least one rule (`no-internal-import`) that enforces `packages/graph` `exports` boundaries and can be extended later for `render`-only-imports checks. The package builds with `tsc`, is linted, and is depended on by the root ESLint config (PC-1, STR-5). (AC: #6)
7. A render-boundary lint test is added: a fixture file under `tests/lint-fixtures/` (or an inline rule test) attempts to import `@iip/render` from `packages/rag/src/illegal.ts` and asserts ESLint fails. The illegal fixture is excluded from the build. (AC: #7)
8. CI `.github/workflows/ci.yml` `Lint` step runs `pnpm lint`, which must include the new import boundary checks and fail on violations (AC-F1-07/08). (AC: #8)
9. `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm test:red` all remain GREEN. The RED contract test (`tests/contract/citation-or-silence.test.ts`) still passes its expected-RED CI step because the stub returns deterministic fail-closed output, not an exception. (AC: #9)
10. All existing Story 1.1–1.3 conventions are preserved: workspace `exports` shape, `tools/` not in pnpm workspaces, `pnpm-workspace.yaml` unchanged, `.npmrc` hoisted mode, Turborepo v2 `tasks`, Node 22, exact `pnpm@9.15.4`. (AC: #10)

## Tasks / Subtasks

- [x] Enforce `packages/render` imports-only-contracts (AC: #1)
  - [x] Verify `packages/render/package.json` dependencies: only `@iip/contracts` and TS/vitest tooling
  - [x] Audit `packages/render/src/**/*.ts` for any import outside `@iip/contracts` or Node built-ins
  - [x] If `@iip/config` is needed for thresholds, route through `@iip/contracts` config schema or defer to Story 2.1 — not needed; render imports only `@iip/contracts`
- [x] Scaffold `@iip/eslint-plugin` package (AC: #6)
  - [x] Create `packages/eslint-plugin/package.json` with `exports: { ".": { types: "./src/index.ts", default: "./dist/index.js" } }` (runtime `default`→dist so ESLint can load it in plain Node; `types`→src preserves the exports-shape convention for type-checking — see Dev Notes #4)
  - [x] Create `packages/eslint-plugin/src/index.ts` exporting a flat-config preset object (`importBoundaryPreset`) plus the `plugin` object with the `no-internal-import` rule
  - [x] Create `packages/eslint-plugin/src/rules/no-internal-import.ts` that inspects `ImportDeclaration` / `ExportNamedDeclaration` / `ExportAllDeclaration` source and reports restricted `exports`-map specifiers (STR-5 graph writer) and `internal/**` reach
  - [x] Add a minimal unit test under `packages/eslint-plugin/src/rules/no-internal-import.test.ts` using ESLint's native `RuleTester` bound to Vitest via static describe/it setters (7 cases)
  - [x] Add `@iip/eslint-plugin` to root `package.json` devDependencies (`workspace:*`)
  - [x] Verify `pnpm build && pnpm typecheck` include the new package (19/19 tasks green)
- [x] Upgrade root `eslint.config.js` with import-boundary enforcement (AC: #5)
  - [x] Add `eslint-plugin-import-x@4.17.0` (ESM-first fork, preferred over CJS `eslint-plugin-import@2.32.0`) + `eslint-import-resolver-typescript@4.4.5`; choice documented in the config header
  - [x] Configure `import/no-restricted-paths` zones (with `pkg()` helper covering both workspace + `node_modules/@iip/*` symlink paths so the resolver-independent path matching fires):
    - `target: "packages/rag/**"`, `from: pkg('render')` → ban render in rag (SC-3, STR-4)
    - `target: "apps/serve-worker/src/processors/rag/**"`, `from: pkg('render')` → ban render in rag processor
    - `target: "packages/render/**"`, `from: [rag, llm, ingest, db, graph, apps]` → render only contracts (SC-3)
  - [x] Configure `import/no-relative-packages: error` to block `../../render/src/gate.ts` style bypass (verified firing)
  - [x] Configure built-in `no-restricted-imports` for explicit module bans (`@iip/render` + `@iip/render/*` in `packages/rag`; `@iip/{db,rag,llm,ingest,graph}` in `packages/render`); `@iip/graph/writer` restriction handled by the custom `@iip/no-internal-import` rule (STR-5)
  - [x] Wire `@iip/eslint-plugin` `importBoundaryPreset` into the exported flat config array
  - [x] Keep `ignores` list from current config; added `tests/lint-fixtures/**` (dist is already covered by `**/dist/**`)
- [x] Add render-boundary lint test fixture (AC: #7)
  - [x] Create `tests/lint-fixtures/rag-imports-render.ts` (illegal import of `@iip/render`, linted virtually as `packages/rag/src/illegal.ts`)
  - [x] Create `tests/lint-fixtures/render-imports-rag.ts` (illegal import of `@iip/rag`, linted virtually as `packages/render/src/illegal.ts`)
  - [x] Add a Vitest test `tests/lint/import-boundaries.test.ts` that runs ESLint programmatically (`ESLint` API, real root config, `lintText` with virtual filePaths) and asserts ≥1 error per fixture with expected rule IDs (3 cases)
  - [x] Ensure fixtures are excluded from build/typecheck (root `tsconfig.json` `exclude: ["tests/lint-fixtures/**"]`) and lint (eslint `ignores`)
- [x] Update render gate stub to deterministic fail-closed placeholder (AC: #4)
  - [x] Modify `packages/render/src/gate.ts`: non-claim spans pass through; `is_claim === true` spans emitted only if `citation_ref` is non-null, mapping `citation_ref` → `citation`
  - [x] Set `no_evidence: true` when no cited claim spans remain; set `essence_sentence` to a deterministic slice of `answer_text` in no-evidence mode
  - [x] Preserve `claim_type` when present
  - [x] Keep the docblock `@rules AC-2, SEC-5, EI-1` and `@adr ADR-001`; added a `STUB` note + ENFORCES/DOES-NOT-ENFORCE table (real validation is Story 2.1)
  - [x] Add unit test `packages/render/src/gate.test.ts` asserting positive/negative/strip/silence/claim_type behavior (7 cases)
- [x] Verify CI integration (AC: #8, #9)
  - [x] Run `pnpm lint` and confirm it catches boundary violations (probed: `no-restricted-imports` + `import/no-restricted-paths` + `import/no-relative-packages` + `@iip/no-internal-import` all fire)
  - [x] Confirm `pnpm test:red` behavior with the deterministic stub — contract test goes GREEN (8/8) on structural assertions
  - [x] Chosen mechanism (Amendment C/D): deterministic structural stub → contract test GREEN; CI step expects GREEN and fails hard on unexpected RED. Real NLI/substring validation RED deferred to Story 2.1. Documented in CI step + Dev Notes.
- [x] Final verification (AC: #10)
  - [x] `pnpm install && pnpm build` exits 0 (19/19)
  - [x] `pnpm typecheck` passes (19/19)
  - [x] `pnpm lint` passes on real source and fails on fixtures as expected (verified via probes + the lint test project)
  - [x] `pnpm test` passes (smoke + contract + lint projects + 13 turbo package tasks)
  - [x] `pnpm test:red` CI step passes (GREEN = expected for the Story 1.4 structural stub)
  - [x] No changes to `pnpm-workspace.yaml`, `.npmrc`, or Node/pnpm pins (verified via `git diff`)

### Review Findings

#### decision-needed

- [x] [Review][Decision] `@iip/eslint-plugin` `exports.default` points to `dist/index.js`, deviating from workspace `default→src/index.ts` convention — `packages/eslint-plugin/package.json:9` (`default: "./dist/index.js"`). Required so plain Node ESLint can load the plugin, but AC #10 says "preserve Story 1.1–1.3 conventions" and Dev Note #8 mandates `default→./src/index.ts`. Story documents this as a deviation. Choose: (A) accept documented deviation; (B) restructure root config to import source and let turbo build the plugin as a lint dependency. **RESOLVED: A — accepted as an intentional AC #10 exception. Added `//exports_default` comment in `packages/eslint-plugin/package.json`.**
- [x] [Review][Decision] Root `package.json` scripts coupled build into lint/test — `package.json:14,22`. `test` now runs `--project lint` and `lint` builds `@iip/eslint-plugin` first. This deviates from Story 1.1 conventions (`test: vitest run tests/smoke && turbo run test`, `lint: eslint .`). Choose: (A) keep pragmatic build-coupled scripts; (B) restore conventions and add `test:lint` / rely on turbo build order. **RESOLVED: B — restored `lint: "eslint ."`; added `test:lint`; wired `turbo.json#lint` to depend on `@iip/eslint-plugin#build`.**

#### patch

- [x] [Review][Patch] `@iip/render` subpath ban is only one level deep — `eslint.config.js:113` (`group: ['@iip/render/*']`). `no-restricted-imports` `*` matches one segment; deeper subpaths such as `@iip/render/foo/bar` bypass STR-4/SC-3. Change to `@iip/render/**`. **FIXED.**
- [x] [Review][Patch] `packages/render` deny-list lacks subpath patterns — `eslint.config.js:148-174`. Bare-specifier bans only catch exact imports; `@iip/db/connection` or `@iip/rag/embeddings` are not banned by the deterministic core rule. Add `patterns: [{ group: ['@iip/{db,rag,llm,ingest,graph}/**'], ... }]`. **FIXED.**
- [x] [Review][Patch] `no-internal-import` flags third-party `/internal/` paths — `packages/eslint-plugin/src/rules/no-internal-import.ts:129-133` (`spec.includes('/internal/')`). A legitimate third-party import like `some-lib/internal/util` would be falsely reported. Restrict the internal-reach check to workspace packages (`@iip/*`). **FIXED.**
- [x] [Review][Patch] `no-internal-import` allow-list globs fail on absolute paths — `packages/eslint-plugin/src/rules/no-internal-import.ts:80,89` (`minimatch(filename, glob)`). ESLint flat-config `context.filename` is absolute; `apps/ingest-worker/src/graph-builder/**` never matches `/Volumes/.../apps/ingest-worker/...`. Normalize `filename` to repo-relative before matching. **FIXED.**
- [x] [Review][Patch] `no-internal-import` misses dynamic imports, `require`, and `import =` — `packages/eslint-plugin/src/rules/no-internal-import.ts:109-119`. Boundary can be evaded via `await import('@iip/graph/writer')`, `require('@iip/render')`, or `import x = require(...)`. Add visitors for `ImportExpression`, `CallExpression` (`require`), and `TSImportEqualsDeclaration`. **FIXED.**
- [x] [Review][Patch] `renderGate` can throw on missing/empty `answer_text` — `packages/render/src/gate.ts:61` (`input.answer_text.slice(0, 200)`). If `answer_text` is empty or the schema is bypassed, the gate crashes instead of failing closed. Guard with `(input.answer_text ?? '').slice(0, 200)`. **FIXED.**
- [x] [Review][Patch] Lint test shells out to `pnpm build` inside `beforeAll` — `tests/lint/import-boundaries.test.ts:31-42` (`execSync('pnpm --filter @iip/eslint-plugin build')`). This couples unit tests to pnpm PATH and adds build side-effects. Remove the build step; rely on CI/root build scripts, or make `@iip/eslint-plugin` build a turbo dependency of the lint task. **FIXED.**

#### defer

- [x] [Review][Defer] Fast-check property-test inefficiencies in `tests/contract/citation-or-silence.test.ts` — independent `span_start`/`span_end` generation wastes runs, and tests only assert negative invariant (a trivial all-span-dropping implementation would pass). Pre-existing contract-test issue, not introduced by Story 1.4.
- [x] [Review][Defer] Two `@typescript-eslint/utils` versions in `pnpm-lock.yaml` — `8.61.1` from plugin + `8.62.0` from `eslint-plugin-import-x` peer resolution. Lockfile bloat caused by chosen dependency, not directly fixable in this story.
- [x] [Review][Defer] Native resolver bindings (`@unrs/resolver-binding-*`) expand platform/supply-chain surface — trade-off of using `eslint-import-resolver-typescript@4.4.5`. Dependency-audit item, not a Story 1.4 code defect.
- [x] [Review][Defer] Test assertions use non-null assertions (`!`) throughout `gate.test.ts` and `citation-or-silence.test.ts` — project-wide convention under `noUncheckedIndexedAccess`; not introduced by this story.

## Dev Notes

### Scope Boundary

This story is the **mechanical boundary** that makes AC-2 enforceable by code, not convention. It does NOT implement the real render gate (Story 2.1), does NOT add NLI/substring validation, does NOT introduce the `@iip/citation` verify API (Story 1.6), and does NOT change the RED contract test's ultimate fate. It makes the boundary between generation (`packages/rag`) and rendering (`packages/render`) lint-enforced so that a future developer cannot accidentally import `renderGate` inside the RAG pipeline and bypass the fail-closed gate.

### Enforcement Boundary (Amendment A — Party Mode Consensus 2026-06-25)

The render gate in Story 1.4 is a **structural stub**, not a complete defamation-grade gate. This table defines what it enforces and what it explicitly does NOT enforce, to prevent false claims about the boundary's completeness.

| Layer | What Story 1.4 ENFORCES | What Story 1.4 DOES NOT ENFORCE | Owned By |
|-------|------------------------|--------------------------------|----------|
| **Static (lint)** | `@iip/render` banned in `packages/rag/**`; `packages/render` imports only `@iip/contracts` | Transitive dependency bans; `@iip/graph/writer` restriction (seeded, not hardened) | Story 1.4 |
| **Structural (stub)** | Claim spans with null `citation_ref` → stripped; non-claim spans → pass-through; `no_evidence` flag set correctly | Citation factual accuracy; cross-reference validity; source document accessibility | Story 2.1 |
| **Trust tier** | `trust_tier` value preserved on output | Tier-based gating; corroboration requirements; tier-3 rejection | Story 2.1 |
| **Citation lifecycle** | Citation shape validated via zod schema | Expired/retracted citation detection; chain-of-custody provenance | Story 1.6 / 2.x |
| **Runtime** | Gate function is callable and deterministic | Runtime enforcement when lint is bypassed; adversarial input resistance | Story 2.1 |
| **CI** | Lint violations fail the build; contract test runs in CI | Merge-gate on citation verification; performance regression detection | Story 1.11 |

### Amendment-to-Story Traceability (Amendment F)

Every acceptance criterion in this story traces to one or more binding amendments from `architecture.md`. This table is the authoritative mapping.

| AC | Binding Amendment(s) | What It Enforces |
|----|---------------------|------------------|
| AC #1 | SC-3, AC-F1-08 | `packages/render` imports only `@iip/contracts` |
| AC #2 | STR-4, SC-3 | `@iip/render` banned in `packages/rag/**` and `apps/serve-worker/src/processors/rag/**` |
| AC #3 | SC-3, STR-4 | `packages/contracts/src/render.ts` is the single shared contract at the rag→render seam |
| AC #4 | AC-2, SEC-5, EI-1, ADR-001 | Render gate stub: deterministic fail-closed, strips uncited claims, sets `no_evidence` |
| AC #5 | PC-1, STR-5 | Root `eslint.config.js` enforces SC-3/STR-4/STR-5 import boundaries |
| AC #6 | PC-1, STR-5 | `@iip/eslint-plugin` scaffolded with `no-internal-import` rule (graph writer restriction) |
| AC #7 | PC-1, AC-F1-08 | Lint-fixture tests assert specific rule IDs fail on boundary violations |
| AC #8 | AC-F1-07, AC-F1-08 | CI `Lint` step includes import boundary checks and fails on violations |
| AC #9 | PC-9, ADR-001 | Contract test runs in CI; structural stub passes GREEN; real validation RED deferred to 2.1 |
| AC #10 | STR-12, SC-10 | All Story 1.1–1.3 conventions preserved |

### Critical Architecture Guardrails

**1. `packages/render` imports ONLY `@iip/contracts` (SC-3).**

This is the central invariant. If `packages/render` imports `@iip/db`, `@iip/rag`, `@iip/llm`, or any app code, the boundary is breached and the gate can be bypassed by shared-state mutation. The only shared symbol across the seam is `RenderInput`/`RenderDocument`/`RenderViolation` from `@iip/contracts`.

**2. `@iip/render` is banned in `packages/rag/**` and `apps/serve-worker/src/processors/rag/**` (STR-4).**

RAG must emit `RenderInput` and push it to the `render-queue`; render runs in `apps/serve-worker/src/processors/render.ts`. A direct import lets a developer short-circuit the queue and call `renderGate` synchronously, which defeats the cross-process contract and makes VAL-9 (gate-invocation-per-served-response) unprovable.

**3. `@iip/graph/writer` is restricted to `apps/ingest-worker/src/graph-builder/**` (STR-5).**

While implementing the import-boundary package, add this rule as the first `@iip/eslint-plugin` rule. It proves the plugin works and protects a second load-bearing seam. Reads via `@iip/graph/reader` remain public.

**4. Keep the contract test structurally GREEN in Story 1.4; real validation RED deferred to Story 2.1. (Amendment C — Party Mode Consensus)**

`tests/contract/citation-or-silence.test.ts` is the product spine. The Story 1.4 stub handles structural citation presence/absence deterministically (strips null citations, preserves non-null citations, sets `no_evidence`). The contract test's structural assertions (claim presence, citation nullity, `no_evidence` flag) will pass GREEN against the stub. Real NLI/substring validation, trust-tier gating, and adversarial input resistance are Story 2.1 — those tests will be added as RED in 2.1 and go GREEN when the real gate is wired.

**CI behavior (updated 2026-06-25):**
- `pnpm test:red` runs the contract test. If GREEN → expected (structural stub). If RED → unexpected failure, CI fails hard.
- When Story 2.1 adds real validation tests, those will be RED until implemented. The CI step will be updated to expect RED again at that point.
- The CI step comment documents this transition explicitly.

**This replaces the previous Option A (keep renderGate throwing).** The Party Mode consensus (Winston/Amelia/Murat/Mary) determined that a deterministic structural stub is stronger than a runtime throw because:
- It proves the gate's structural logic works (citation mapping, strip, no_evidence)
- It prevents accidental GREEN from a changed throw message
- It provides a testable foundation that Story 2.1 builds on
- The `RenderViolation` error class remains in `@iip/contracts` for Story 2.1 to use for real validation failures

**5. `eslint-plugin-import` flat-config version pinning.**

The root config currently uses `typescript-eslint` only. Adding `eslint-plugin-import` requires a version that ships flat-config support. As of mid-2026, `eslint-plugin-import@2.31.0` with flat configs is stable, or use `eslint-plugin-import-x@4.x` (fork with better ESM/flat support). Either is acceptable; document the choice and pin exact version. Do not use a v4-incompatible `eslint-plugin-import` version.

**6. `@iip/eslint-plugin` is a real workspace package, not a config file.**

Per project-context.md PC-1 / Code Quality rules: "`@iip/eslint-plugin` is a workspace package from day 1 with its own `tsconfig` + build step — NOT a bolt-on." It must have its own `package.json`, `tsconfig.json`, `src/index.ts`, and be built by `pnpm build`.

**7. Do not add `tools/*` to `pnpm-workspace.yaml`.**

Reaffirmed from Story 1.1/1.3: `tools/` are NOT pnpm workspace members; their `package.json` files are shims.

**8. Preserve existing `exports` shape.**

All workspace packages keep:
```json
"exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } }
```
`@iip/eslint-plugin` follows the same pattern.

### Previous Story Intelligence

From **Story 1.1** (`_bmad-output/implementation-artifacts/1-1-turborepo-scaffold-process-stubs.md`):

- Workspace packages use `exports` with `types` + `default` conditions.
- Root `package.json` scripts: `build` → turbo, `typecheck` → turbo, `test` → `vitest run tests/smoke && turbo run test`, `lint` → `eslint .`.
- `.npmrc`: `node-linker=hoisted`, `engine-strict=true`, `auto-install-peers=true`, `strict-peer-dependencies=true`.
- `packageManager: "pnpm@9.15.4"` exact; `engines.node: "22.x"`; `.nvmrc: 22.23.0`.
- `tools/*` are NOT pnpm workspace members; their `package.json` are shims.
- CI already has a grep guard for `.only/.skip/.todo` (AC-F1-09), so any test skipped after this story must use a documented exception or be avoided.

From **Story 1.2** (`_bmad-output/implementation-artifacts/1-2-postgresql-pgvector-age-compatibility-proof.md`):

- Package `exports.default` pointing to `./src/index.ts` works for `tsc` builds in this monorepo; do not switch to `dist` unless required.
- Per-package `vitest.config.ts` with `test.environment: 'node'` is the convention.
- Branded nominal types and strict tsconfig flags are required; do not relax `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.
- Adversarial code-review surfaced 40+ patch findings in Story 1.3; apply the same rigor here.

From **Story 1.3** (`_bmad-output/implementation-artifacts/1-3-docker-compose-platform-stack.md`):

- Foundation Action Plan P0–P3 unblocked the epic; Story 1.4 is the next Foundation step.
- CI now handles the RED contract test with an expected-RED marker (`rendergate|not implemented|function.*is not implemented|cannot find`).
- The `vitest.workspace.ts` isolates the contract-red project so the main `pnpm test` stays GREEN.
- Integration tests use `--pool=forks --poolOptions.forks.singleFork=true` for Docker global state; lint tests do not need that.
- `pnpm lint` currently runs `eslint .` at root; any new package must be included by removing it from `ignores` if necessary.

### Common LLM Mistakes to Avoid

1. **Importing `@iip/db` or `@iip/llm` inside `packages/render`.** The boundary forbids it. Thresholds/config that render needs must come through the `RenderInput` contract or a dedicated config schema in `@iip/contracts`.
2. **Calling `renderGate` directly from `packages/rag`.** That is exactly the anti-pattern the boundary is meant to prevent. RAG emits `RenderInput` and pushes to the queue.
3. **Using relative imports across packages.** `import { renderGate } from '../../render/src/gate.ts'` bypasses `exports` and import rules. Enforce `import/no-relative-packages`.
4. **Forgetting to build `@iip/eslint-plugin`.** If the root config imports a TS source file, ESLint may work locally but CI will fail if the package is not built. Add it to turbo task graph or import via `src/index.ts` with `tsc` build.
5. **Making the contract test go GREEN prematurely.** Do not fully implement `renderGate` in this story. Keep at least one throwing path so `pnpm test:red` still reports expected RED.
6. **Using `eslint-plugin-import` v3 or an unpinned version.** Pin exact flat-config compatible version.
7. **Changing `pnpm-workspace.yaml` to include `tools/*` or `packages/eslint-plugin`.** It is already correct; do not break it.
8. **Ignoring the `@iip/graph/writer` restriction.** Add this as the first custom rule; it is a load-bearing seam from STR-5.
9. **Writing vague lint tests.** The lint fixture must assert specific rule IDs fail, not just "some error."
10. **Relaxing the `no-console` or other fatal-five rules in this story.** Those are F1 decisions recorded in project-context.md; defer their enforcement to a dedicated lint-hardening story unless explicitly in scope.

### Files to Create / Modify

Create new:
- `packages/eslint-plugin/package.json` — workspace package manifest
- `packages/eslint-plugin/tsconfig.json` — composite, rootDir ./src, outDir ./dist
- `packages/eslint-plugin/src/index.ts` — flat-config preset export
- `packages/eslint-plugin/src/rules/no-internal-import.ts` — custom rule (STR-5 graph writer restriction)
- `packages/eslint-plugin/src/rules/no-internal-import.test.ts` — RuleTester unit test
- `packages/eslint-plugin/vitest.config.ts` — standard package vitest config
- `tests/lint-fixtures/rag-imports-render.ts` — fixture that must fail lint
- `tests/lint-fixtures/render-imports-rag.ts` — fixture that must fail lint
- `tests/lint/import-boundaries.test.ts` — programmatic ESLint assertion test
- `packages/render/src/gate.test.ts` — placeholder gate unit tests (positive/negative/strip)

Modify:
- `packages/render/src/gate.ts` — make stub deterministic fail-closed while preserving a RED path
- `root eslint.config.js` — add import-plugin, restricted-paths zones, `@iip/eslint-plugin` preset
- `root package.json` — add `eslint-plugin-import` (or import-x) and `@iip/eslint-plugin` devDependencies; update lint script if needed
- `turbo.json` — ensure `@iip/eslint-plugin` is in build graph (it should be picked up automatically via `packages/*`)
- `tsconfig.base.json` or root `tsconfig.json` — exclude `tests/lint-fixtures/**` from typecheck if needed
- `.github/workflows/ci.yml` — verify the Lint step already runs `pnpm lint` (it does); no change required unless lint script changes

### Verification Commands

```bash
# Build/typecheck/lint/test
pnpm install && pnpm build
pnpm typecheck
pnpm lint
pnpm test

# Run RED contract test and confirm expected-RED CI behavior
pnpm test:red

# Run lint-fixture test explicitly
pnpm vitest run tests/lint/import-boundaries.test.ts
```

### Project Context Reference

- **Authority hierarchy:** AC-1…AC-11, PD-1…PD-3, SC-1…SC-10, SEC-1…SEC-9, PC-1…PC-9, STR-1…STR-12, VAL-1…VAL-9 are binding.
- **Most relevant for this story:** SC-3 (render as fail-closed gate), STR-4 (render←rag cross-process handoff), STR-5 (graph reader/writer exports), AC-2 (fail-closed render), AC-F1-08 (ESLint boundary enforced in CI), PC-1 (mechanical enforcement promotion), PC-5 (cross-referencing docblocks), PC-7 (Pattern Index), PC-8 (no-explicit-any, exactOptionalPropertyTypes), ADR-001 (defamation-grade operational definition).
- **Dependency stories:** Story 1.1 (scaffold), Story 1.2 (DB client + strict TS), Story 1.3 (Compose + CI + RED contract test wired).
- **Later stories depending on this:** Story 1.5 (polyglot eval uses the same import-boundary discipline for packages/eval), Story 1.6 (citation package boundary), Story 2.1 (render gate goes live), all Epic 2+ stories assume the render boundary is mechanically enforced.

## Dev Agent Record

### Agent Model Used

glm-5.2 (opencode default), via the `bmad-dev-story` workflow.

### Debug Log References

- **ESLint config loader vs TS-source plugin:** plain Node/ESLint cannot import `@iip/eslint-plugin` whose internal relative imports use the `.js`→`.ts` convention (`ERR_MODULE_NOT_FOUND` on `./rules/no-internal-import.js`). Resolved by pointing the plugin `exports.default` at the built `dist/index.js` (`types` stays at `src/index.ts`) and having the root `lint` script build the plugin first. Probed `tsx` as an alternative; the dist approach is the standard ESLint-plugin runtime entrypoint.
- **RuleTester type skew:** `@typescript-eslint/utils@8` RuleCreator output is runtime-identical to ESLint v9 `RuleDefinition` but type-incompatible. `@typescript-eslint/rule-tester` nests its own utils copy and clashes under `exactOptionalPropertyTypes`. Resolved with ESLint's native `RuleTester` bound to Vitest via static `describe`/`it` setters, casting the rule `as never` at the single test seam.
- **Resolution-based rules not firing:** `import/no-restricted-paths` and `import/no-relative-packages` need a resolver; the bundled `unrs-resolver` does not resolve workspace packages whose `exports` point at `.ts` source. Added `eslint-import-resolver-typescript`. pnpm-hoisted symlinks (`node_modules/@iip/render → packages/render`) meant the resolver returned symlink paths, so the `packages/**` zone globs missed; resolved with a `pkg()` helper that emits both `packages/<name>/**` and `**/node_modules/@iip/<name>/**`.
- **macOS AppleDouble `._*` junk** on the external drive broke vitest `packages/*` project discovery (`packages/._eslint-plugin`); deleted all `._*` files under `packages/`, `apps/`, `tests/` (they are already covered by `**/._*` ignores).

### Completion Notes List

- **AC #1–#3 (render←contracts seam):** `packages/render/package.json` declares only `@iip/contracts`; `src/{index,gate}.ts` import only `@iip/contracts`, `vitest` (test tooling), and relative paths. `packages/contracts/src/render.ts` (`RenderInput`/`RenderDocument`/`RenderSpan`/`RenderViolation`) is the single shared contract at the rag→render seam.
- **AC #4 (gate stub):** `packages/render/src/gate.ts` is a deterministic fail-closed placeholder — strips uncited claim spans, preserves cited ones (mapping `citation_ref`→`citation`), passes non-claim spans through, sets `no_evidence` + `essence_sentence` when zero cited claims remain, preserves `claim_type`. 7 unit tests in `gate.test.ts` (positive/negative/strip/silence/claim_type).
- **AC #5 (root eslint config):** triple-layered enforcement — core `no-restricted-imports` (deterministic, string-based), `import/no-restricted-paths` + `import/no-relative-packages` (resolution-based, via `eslint-import-resolver-typescript`), and `@iip/no-internal-import`. All four mechanisms verified firing via probes.
- **AC #6 (`@iip/eslint-plugin`):** scaffolded as a real workspace package with `tsconfig.json`, `vitest.config.ts`, `src/index.ts` (`plugin` + `importBoundaryPreset`), `src/rules/no-internal-import.ts` (STR-5 graph-writer restriction + `internal/**` reach), and a 7-case `RuleTester` unit test. Builds with `tsc`, is linted by `pnpm lint`, and is depended on by the root config. Seeded restriction: `@iip/graph/writer` outside `apps/ingest-worker/src/graph-builder/**`.
- **AC #7 (lint fixtures):** `tests/lint-fixtures/{rag-imports-render,render-imports-rag}.ts` (illegal, excluded from lint/build/typecheck) + `tests/lint/import-boundaries.test.ts` (ESLint `lintText` against the REAL root config with virtual filePaths, asserts `no-restricted-imports` fires; new `lint` vitest project).
- **AC #8 (CI):** `.github/workflows/ci.yml` Lint step runs `pnpm lint` (includes all boundary checks); contract-test step expects GREEN for the structural stub and fails hard on unexpected RED (Amendment C/D).
- **AC #9 (gates):** `pnpm build`/`typecheck` 19/19, `pnpm lint` clean, `pnpm test` green (smoke+contract+lint + 13 turbo tasks), `pnpm test:red` 8/8 GREEN as expected.
- **AC #10 (conventions):** `pnpm-workspace.yaml`, `.npmrc`, `.nvmrc`, `packageManager`/`engines` pins all unchanged (`git diff` empty). `exports` shape preserved across packages; `@iip/eslint-plugin` uses `types→src`/`default→dist` (documented deviation — ESLint loads config in plain Node).
- **Deviation noted:** `@iip/eslint-plugin` `exports.default` points to `dist/index.js` (not `src/index.ts`). This is the conventional runtime entrypoint for a TS ESLint plugin and is anticipated by Dev Notes #4 ("import via src/index.ts with tsc build"). `types` remains `src/index.ts` so the exports-shape convention holds for type-checking.

### File List

Created:
- `packages/eslint-plugin/package.json`
- `packages/eslint-plugin/tsconfig.json`
- `packages/eslint-plugin/vitest.config.ts`
- `packages/eslint-plugin/src/index.ts`
- `packages/eslint-plugin/src/rules/no-internal-import.ts`
- `packages/eslint-plugin/src/rules/no-internal-import.test.ts`
- `packages/render/src/gate.test.ts`
- `tests/lint-fixtures/rag-imports-render.ts`
- `tests/lint-fixtures/render-imports-rag.ts`
- `tests/lint/import-boundaries.test.ts`

Modified:
- `packages/render/src/gate.ts` — deterministic fail-closed stub (was throwing)
- `eslint.config.js` — import-boundary enforcement (import-x + resolver + custom preset + scoped zones)
- `package.json` — added `@iip/eslint-plugin`, `eslint-plugin-import-x@4.17.0`, `eslint-import-resolver-typescript@4.4.5`; `lint` builds the plugin first; `test` adds the `lint` project
- `pnpm-lock.yaml` — dependency additions
- `vitest.workspace.ts` — added the `lint` project
- `tsconfig.json` — `exclude: ["tests/lint-fixtures/**"]`
- `.github/workflows/ci.yml` — contract-test step expects GREEN (Amendment C/D)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 1-4 status tracking

---

## CHANGELOG

### 2026-06-25 — Story 1.4 implemented (render-gate ESLint boundary, AC-2)

**Implementer:** glm-5.2 via `bmad-dev-story` workflow. All 10 ACs satisfied; all gates green.

- Scaffolded `@iip/eslint-plugin` workspace package with the `no-internal-import` rule (STR-5 graph-writer restriction + `internal/**` reach) and a flat-config `importBoundaryPreset`; 7-case `RuleTester` unit test bound to Vitest.
- Upgraded the root `eslint.config.js` to triple-layered import-boundary enforcement: core `no-restricted-imports` (deterministic), `import/no-restricted-paths` + `import/no-relative-packages` (resolution-based via `eslint-import-resolver-typescript`), and the custom `@iip/no-internal-import`. Added `eslint-plugin-import-x@4.17.0` (chosen over CJS `eslint-plugin-import`).
- Converted `packages/render/src/gate.ts` to a deterministic fail-closed stub (strips uncited claims, maps `citation_ref`→`citation`, sets `no_evidence`); 7 unit tests added.
- Added `tests/lint-fixtures/*` + `tests/lint/import-boundaries.test.ts` (ESLint `lintText` against the real config) and a new `lint` vitest project.
- **Deviation:** `@iip/eslint-plugin` `exports.default`→`dist/index.js` (plain-Node ESLint cannot import TS source); `types`→`src/index.ts` preserves the exports-shape convention. Anticipated by Dev Notes #4.
- Verified: `pnpm build`/`typecheck` 19/19, `pnpm lint` clean, `pnpm test` green, `pnpm test:red` 8/8 GREEN (Amendment C/D structural-stub behavior). `pnpm-workspace.yaml`, `.npmrc`, Node/pnpm pins unchanged.

### 2026-06-25 — Party Mode Adversarial Review + Consensus Amendments

**Reviewers:** Winston (Architect), Amelia (Dev), Murat (Test Architect), Mary (Analyst). Four-agent Party Mode adversarial review + consensus debate.

**Verdict:** NOT-READY-FOR-DEV → READY-FOR-DEV (6 amendments applied).

**Amendment A — Enforcement Boundary Table:** Added explicit "ENFORCES / DOES NOT ENFORCE" table to Dev Notes. Prevents false claims about what the Story 1.4 boundary actually protects. Source: Mary (stakeholder coverage), Winston (architectural boundary definition).

**Amendment B — Citation Contract Types:** Verified `@iip/contracts` already ships `CitationTuple`, `CitationRef`, `RenderInput`, `RenderDocument`, `RenderViolation`. No new types needed — the contract package is not empty. Source: Winston (blocker #1), Amelia (prerequisite).

**Amendment C — RED Contract Test Strategy:** Replaced Option A (keep renderGate throwing) with deterministic structural stub. The stub handles structural citation presence/absence (strips null citations, preserves non-null, sets `no_evidence`). Contract test goes GREEN on structural assertions. Real NLI/substring validation tests will be added RED in Story 2.1. CI step updated to fail hard on unexpected RED. Source: Murat (Option A+ compile-time type), Amelia (typed error assertion), Winston (RED-test paradox resolution).

**Amendment D — CI Wiring Task:** CI step updated to reflect new contract test behavior. `pnpm test:red` GREEN = expected (structural stub); RED = unexpected failure. Source: Amelia, Winston.

**Amendment E — Property-Based Tests + Negative Citation Tests:** `packages/render/src/gate.test.ts` created with 8 tests covering: positive (cited claims preserved, non-claim pass-through), negative (uncited stripped, mixed input), silence (no_evidence flag), claim_type preservation. Property-based tests (fast-check, 1000 runs) already exist in `tests/contract/citation-or-silence.test.ts`. Source: Murat.

**Amendment F — Amendment-to-Story Traceability:** Added explicit AC-to-amendment mapping table. Every AC now cites which binding amendment(s) it addresses. Source: Mary.

**Render gate stub updated:** `packages/render/src/gate.ts` — deterministic fail-closed placeholder. Maps `citation_ref` → `citation` on output, strips null-citation claim spans, sets `no_evidence` when zero cited claims remain, preserves `claim_type`. Docblock includes ENFORCES/DOES NOT ENFORCE table.

**CI updated:** `.github/workflows/ci.yml` — contract test step now expects GREEN (structural stub), fails hard on unexpected RED.
