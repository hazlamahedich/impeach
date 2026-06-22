---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests']
lastStep: 'step-04-generate-tests'
lastSaved: '2026-06-22'
workflowType: 'testarch-atdd'
storyId: '1.1'
storyKey: '1-1-turborepo-scaffold-process-stubs'
storyFile: '_bmad-output/planning-artifacts/epics.md (Story 1.1)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd/epic-1/story-1-1/atdd-checklist-1-1-turborepo-scaffold-process-stubs.md'
generatedTestFiles:
  - 'tests/smoke/scaffold-smoke.test.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/project-context.md'
  - '.claude/skills/bmad-testarch-atdd/resources/tea-index.csv'
---

# ATDD Checklist — Epic 1, Story 1.1: Turborepo Scaffold & Process Stubs

**Date:** 2026-06-22 · **Author:** anti lustay · **Primary Test Level:** smoke/build · **Severity:** T3

## Story Summary
As a developer, I want a Turborepo monorepo scaffold with all packages and 5 app process stubs, so that I can develop each package independently against a reproducible structure. (Scope: scaffolding-only — no business logic.)

## Acceptance Criteria (revised 2026-06-22 after adversarial review roundtable)
1. `pnpm install && pnpm build` exits 0 across all workspaces (AC-F1-01)
2. `pnpm typecheck` passes everywhere; every workspace extends tsconfig.base.json; task defined in turbo.json v2 "tasks" (AC-F1-02)
3. Every packages/* ships a vitest placeholder that **imports from `@iip/<pkg>`** — anti-hollow (AC-F1-03)
4. 12 packages + 5 apps registered in pnpm-workspace.yaml, asserted **by name** via fixture array (AC-F1-04)
5. tests/smoke/scaffold-smoke.test.ts passes asserting 12 packages + 5 apps by name + root configs parse (AC-F1-05)
6. Each root config file valid + consumed (AC-F1-06, per-file): turbo.json v2 "tasks", pnpm-workspace.yaml (apps/*+packages/* ONLY), tsconfig.base.json strict, .npmrc 4 flags, .nvmrc exact patch
7. install + build + test + lint + tsc --noEmit all exit 0 (AC-F1-07)
8. **NEW** `pnpm lint` exits 0 against flat eslint.config.js at root (AC-F1-08)
9. **NEW** CI runs build/typecheck/test on PR, all green (AC-F1-09)

**Placeholder Gates (empty hulls, content in 1.10-1.12):** PH-F1-01 (eval/corpus/golden/v0/manifest.json), PH-F1-02 (docs/adr/), PH-F1-03 (docs/glossary.md), PH-F1-04 (docs/pattern-index.md)

**Single-PR Protocol (Murat's 4 anti-hollow teeth):** (1) CI grep guard forbids `.only`/`.skip`/`.todo(` in `*.test.ts` (vitest has no `--forbid-only`/`--forbid-pending` CLI flags, so the intent is enforced via grep), (2) assertion-floor gate, (3) RED observability via commit ordering or draft-PR CI history, (4) AC-F1-03 imports from package entry. Story-split WITHDRAWN.

### Implementation Checklist updates (post-roundtable)
- [x] Root `package.json` uses exact `packageManager: "pnpm@9.15.4"` and `engines.node: "22.x"`
- [x] `.npmrc` uses `strict-peer-dependencies=true` (was `false` pre-roundtable)
- [x] `.nvmrc` exact patch pinned to `22.23.0` (was `22.11.0`; bumped because transitive ESLint ecosystem deps require `>=22.13.0` under `engine-strict=true`)
- [x] Flat root `eslint.config.js` ships with the scaffold (AC-F1-08)
- [x] `.github/workflows/ci.yml` runs build/typecheck/forbid-skip-guard/lint/test on PR and push to main (AC-F1-09)

## Story Integration Metadata
- **Story ID:** `1.1` · **Story Key:** `1-1-turborepo-scaffold-process-stubs`
- **Checklist Path:** `_bmad-output/test-artifacts/atdd/epic-1/story-1-1/atdd-checklist-1-1-turborepo-scaffold-process-stubs.md`
- **Generated Test Files:** `tests/smoke/scaffold-smoke.test.ts`

## Red-Phase Test Scaffolds Created

### Smoke/Build Tests (6 tests)
**File:** `tests/smoke/scaffold-smoke.test.ts`

- ⏭️ **AC-F1-01 build exits 0** — Status: RED — no package.json; pnpm not installable yet
- ⏭️ **AC-F1-02 typecheck passes** — Status: RED — turbo 'typecheck' task missing
- ⏭️ **AC-F1-03 vitest placeholder per package** — Status: RED — packages not created
- ⏭️ **12 packages exist** — Status: RED — `packages/*` dir absent
- ⏭️ **5 app stubs exist** — Status: RED — `apps/*` dir absent
- ⏭️ **workspace config files** — Status: RED — turbo.json/pnpm-workspace.yaml/etc. absent

## Data Factories Created
None — Story 1.1 has no domain entities.

## Fixtures Created
None.

## Mock Requirements
None — pure filesystem + subprocess assertion.

## Required data-testid Attributes
None — no UI in 1.1.

## Implementation Checklist

### Test: scaffold-smoke.test.ts (activate one at a time after 1.1 lands)

- [ ] Create root `package.json` with `packageManager: "pnpm@9.x.x"` exact, `engines.node: "22"`, workspace scripts (build/typecheck/test/lint)
- [ ] Create `pnpm-workspace.yaml` listing `apps/*` + `packages/*` ONLY (NOT `tools/*` — STR-12)
- [ ] Create `turbo.json` with v2 `"tasks"` schema (NOT `"pipeline"`); tasks: build/typecheck/test/lint
- [ ] Create `tsconfig.base.json` with strict flags per project-context.md (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, verbatimModuleSyntax, etc.)
- [ ] Create `.npmrc`: `node-linker=hoisted`, `auto-install-peers=true`, `strict-peer-dependencies=false`
- [ ] Create `.nvmrc` pinned to Node 22.x
- [ ] Scaffold 12 `packages/{name}/` with `package.json` name `@iip/{name}`, `src/index.ts`, `tsconfig.json`, one `*.test.ts` placeholder
- [ ] Scaffold 5 `apps/{name}/` stubs with `console.log("alive")`-level entry + `package.json`
- [ ] Run `pnpm install && pnpm build` → exit 0 (AC-F1-01)
- [ ] Run `pnpm typecheck` → exit 0 (AC-F1-02)
- [ ] Run `pnpm vitest run` → ≥1 passing test per package (AC-F1-03)
- [ ] Activate all 6 `test.skip` in scaffold-smoke.test.ts → GREEN

**Estimated Effort:** 1–2 days

## Running Tests
```bash
pnpm install
pnpm vitest run tests/smoke/scaffold-smoke.test.ts   # after activation
pnpm build && pnpm typecheck                          # AC-F1-01/02 directly
```

## Red-Green-Refactor
- **RED (complete):** All 6 tests `.skip` with `// RED — ` markers
- **GREEN (dev-story):** Activate after scaffold lands; one AC at a time
- **REFACTOR:** N/A for 1.1 (scaffold is the floor)

## Notes
- This story is unusual: the tests verify the scaffold that the story itself creates. Activation must happen *after* 1.1's PR opens, not before.
- `tools/` is intentionally NOT a pnpm workspace member (STR-12). `tools/*/package.json` are shims — do NOT "fix" by adding `tools/*` to `pnpm-workspace.yaml`.
- `.npmrc` `node-linker=hoisted` is required for native AGE bindings later (1.2); enables phantom-dependency bugs → ESLint `import/no-unresolved` compensates.

**Generated by BMad TEA Agent** — 2026-06-22
