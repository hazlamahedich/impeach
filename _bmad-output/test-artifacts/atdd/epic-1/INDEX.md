---
title: 'Epic 1 — ATDD Index'
epicId: '1'
date: '2026-06-22'
generatedBy: 'BMad TEA Agent'
workflow: 'bmad-testarch-atdd'
storiesCovered: 12
totalTests: 93
totalFiles: 16
status: 'red-phase-complete'
---

# Epic 1 — Foundation: ATDD Index

Generated 2026-06-22 by BMad TEA Agent for **anti lustay**. Red-phase scaffolds for all 12 Epic 1 stories.

## Master Plan
- **[epic-1-atdd-plan.md](./epic-1-atdd-plan.md)** — Stack detection (fullstack), generation mode (AI), AC→test→level→priority crosswalk, dependency order (1.1 first), invariant-to-test mapping.

## Per-Story Outputs

| Story | Title | Sev | Tests | Checklist | Scaffold(s) |
|---|---|---|---|---|---|
| 1.1 | Turborepo Scaffold & Process Stubs | T3 | 6 | [checklist](./story-1-1/atdd-checklist-1-1-turborepo-scaffold-process-stubs.md) | `scaffold-smoke.test.ts` |
| 1.2 | PG + pgvector + AGE Compatibility | T2 | 6 | [checklist](./story-1-2/atdd-checklist-1-2-postgresql-pgvector-age-compatibility-proof.md) | `pg-age-pgvector.compat.test.ts` |
| 1.3 | Docker Compose Platform Stack | T2 | 8 | [checklist](./story-1-3/atdd-checklist-1-3-docker-compose-platform-stack.md) | `compose-stack.health.test.ts` |
| **1.4** | Render Gate ESLint Boundary (AC-2) | **T1** | 7 | [checklist](./story-1-4/atdd-checklist-1-4-render-gate-eslint-boundary.md) | `render-gate-boundary.test.ts` |
| **1.5** | Polyglot Eval Seam (SC-1, AC-F1-05 KEYSTONE) | **T1** | 7 | [checklist](./story-1-5/atdd-checklist-1-5-polyglot-eval-seam.md) | `polyglot-eval-roundtrip.test.ts` |
| **1.6** | Citation Package (SC-2, AC-4) | **T1** | 7 | [checklist](./story-1-6/atdd-checklist-1-6-citation-package.md) | `citation-tuple.test.ts` |
| 1.7 | Design Token System | T2 | 8 | [checklist](./story-1-7/atdd-checklist-1-7-design-token-system.md) | `design-tokens.test.ts` |
| **1.8** | Stubbed Compound Components (AC-2 boundary) | **T1** | 14 | [checklist](./story-1-8/atdd-checklist-1-8-stubbed-compound-components.md) | `citation-empty-chip.test.tsx`, `claim-variants.test.tsx`, `trust-badge.test.tsx`, `source-verb-answer-empty.test.tsx` |
| 1.9 | State Mgmt & Nav Shell | T2 | 9 | [checklist](./story-1-9/atdd-checklist-1-9-state-management-foundation-navigation-shell.md) | `state-navigation.test.ts` |
| 1.10 | 19 ADRs Seeded | T2 | 7 | [checklist](./story-1-10/atdd-checklist-1-10-19-adrs-seeded.md) | `adrs-seeded.test.ts` |
| 1.11 | CI Pipeline & Gate Store | T2 | 9 | [checklist](./story-1-11/atdd-checklist-1-11-ci-pipeline-gate-artifact-store.md) | `ci-pipeline.test.ts` |
| **1.12** | Citation-or-Silence Contract Test (THE INVARIANT SPINE) | **T1** | 5 | [checklist](./story-1-12/atdd-checklist-1-12-citation-or-silence-contract-test-red.md) | `citation-or-silence.contract.test.ts` |

**Totals:** 12 stories · 16 scaffold files · 93 tests (all RED via `.skip`/`.todo` per template).

## Defamation Spine (T1 — high-risk stories)

- **1.4** Render Gate ESLint Boundary — AC-2 structural separation. Without it, AC-2 is a runtime convention.
- **1.5** Polyglot Eval Seam — AC-F1-05 KEYSTONE. Drives SEC-8 libel-injection evals (Python) that have no TS mutation coverage otherwise.
- **1.6** Citation Package — AC-4 primitive. The `(source_doc_id, span_start, span_end, content_hash)` tuple is what every downstream invariant hangs off.
- **1.8** Stubbed Compound Components — AC-2 at the component boundary ("no citation, no claim" is a build error).
- **1.12** Citation-or-Silence Contract Test — the bidirectional, property-tested proof. **Shipped RED; activates Epic 2.**

## Activation Rules

1. **Hard dependency:** Story 1.1 must land before ANY other scaffold activates (1.1 IS the scaffold).
2. **One `.skip` at a time:** dev-story removes ONE `test.skip`, confirms RED, implements minimal, reaches GREEN, commits.
3. **Story 1.12 stays skipped through Epic 1** — ACTIVATES in Epic 2 when Story 2.1 wires the render gate as a live call site. CI must treat `skipped !== passing` for 1.12 from Epic 2 onward.
4. **AC-2 non-relaxable:** PRs that bump thresholds to pass are REJECTED, not merged.
5. **Naming locked:** `*.test.ts` (NOT `*.spec.ts`); Python `test_*.py` (per `project-context.md`).

## Handoff to dev-story

For each story:
1. Read `atdd-checklist-1-N-*.md` for the implementation roadmap.
2. Move scaffold(s) from `test-artifacts/atdd/epic-1/story-1-N/` to the in-repo `target-path` declared in each file's header (once 1.1 creates the dir).
3. Activate one `.skip` at a time → RED → implement minimal → GREEN → commit with `Refs:` trailer.
4. Update `sprint-status.yaml` story status on completion.

## Open Items Surfaced

1. **AGE version pin unverified** (ADR-002 ≥1.7.0 vs latest GA 1.5.0) — resolve before Story 1.2 GREEN; amend ADR-002.
2. **Custom PG+AGE+pgvector Docker image** — F1 prerequisite; SHA-pin, shared by compose + Testcontainers.
3. **bge-m3 serving path** (OQ-1) — deferred to Story 4.6, but 1.2's `vector(1024)` is schema-affecting.
4. **Tailwind 4 full rewrite** — Story 1.7 tests assume v4 `@theme`; treat all LLM-generated Tailwind as suspect.

---

**Generated by BMad TEA Agent** — 2026-06-22
