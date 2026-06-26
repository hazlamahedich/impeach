---
id: ADR-009
title: Monorepo Orchestrator Selection — Turborepo
status: Accepted
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), Amelia (developer), user]
related: [SC-9, AC-1, AC-3, SC-1, ADR-014]
evidence:
  - _bmad-output/planning-artifacts/architecture.md (§Selected Starter: Bespoke Turborepo scaffold; SC-9 ADR-009)
  - _bmad-output/planning-artifacts/research/technical-iip-technology-stack-validation-research-2026-06-19.md
---

# ADR-009: Monorepo Orchestrator Selection — Turborepo

## Context

The IIP codebase is a TypeScript monorepo (apps + packages + tools) with a
polyglot eval plane (TS `packages/eval` + Python `tools/eval`, SC-1/ADR-014)
and a chaos plane (k6 + Playwright). The orchestrator must express the build
graph across these planes, cache per-plane/per-stratum eval results (AC-1 —
the eval harness is an architectural plane), and respect the single-workstation
transitional deployment (AC-3). SC-9 requires the scaffold decision itself be
an ADR so the choice survives an opinionated future contributor swapping it.

The decision was "narrow": remote caching is irrelevant for a
single-workstation transitional system (AC-3), so the deciding factor is the
**local build graph's per-plane eval caching**, not distributed orchestration.

## Decision

**Turborepo 2.9.x + pnpm 9.x workspaces** is the monorepo orchestrator.

1. The build graph earns its keep on AC-1's per-plane/per-stratum eval caching.
   `turbo.json` models build/test/lint/**eval**/**chaos** as gated tasks with
   `dependsOn` edges (e.g. `lint` depends on `@iip/eslint-plugin#build`;
   `py:test` depends on `py:lint` + `^build`).
2. Remote caching is **off** (local-only default). Self-hosted/Vercel remote
   cache is out of scope for v1: Vercel remote cache ships artifacts to Vercel
   (likely disqualified by SEC-4 isolated runner); a self-hosted cache (Tigris/S3)
   adds infra. Flagged for a future ADR if CI rebuild cost becomes material.
3. **Turborepo v2 schema:** `turbo.json` uses `"tasks"`, NOT `"pipeline"`
   (removed in v2). Python tasks shell out to `uv` (`tools/eval`,
   `tools/chaos`); `tools/*` is intentionally NOT a pnpm workspace member
   (STR-12) — its `package.json` is a shim (`scripts` → `uv run`).
4. The orchestrator is substrate, not an interfaced dependency (SC-5): Turborepo
   + pnpm are plumbing; they are not wrapped behind a port. Swapping Turborepo
   for Nx is a future ADR, not a runtime config change.

## Alternatives

1. **Nx.**
   - Rejected. Nx is the stronger choice for large teams needing distributed
     caching, affected-project detection, and generator scaffolding. IIP is a
     single-workstation transitional system where remote caching is irrelevant
     (AC-3) and Nx's config overhead does not pay off. Turborepo's zero-config
     `turbo.json` is the lower-friction fit.
2. **Bare pnpm-workspaces (no orchestrator).**
   - Rejected. Loses the per-plane task graph and incremental eval caching that
     AC-1 depends on (re-running every eval on every change defeats the
     harness-as-plane design). The polyglot eval/chaos task edges (ADR-014)
     need a graph, not a script runner.
3. **Moonrepo / Lage / custom task runner.**
   - Rejected. Smaller ecosystems, higher risk for a multi-year defamation-grade
     platform. Turborepo's adoption + schema stability (v2) reduce tooling churn
     risk.

## Consequences

- `turbo.json` (v2 `tasks` schema) + `pnpm-workspace.yaml` (`apps/*`,
  `packages/*` only) + `.npmrc` (`node-linker=hoisted` for native AGE bindings)
  are the orchestrator's load-bearing config; an agent "fixing"
  `tools/*`-not-in-workspace breaks `pnpm install` (STR-12).
- Eval/chaos task nodes (ADR-014) hang off the Turborepo graph; the polyglot
  subprocess boundary is expressed as task dependencies, not ad-hoc scripts.
- Remote cache stays off; if CI cost justifies it later, a self-hosted cache is
  a separate ADR.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | At what CI rebuild cost does a self-hosted remote cache (Tigris/S3) pay off vs SEC-4 constraints? | Architect/DevOps | Post-F5 CI cost review |
| 2 | Should the `turbo.json` task graph encode the AGE-vs-Drizzle migration ordering (D1, relational→AGE) as a dependency? | Architect | Story 1-3 / D1 boot runner |
| 3 | Is `node-linker=hoisted` (required for AGE native bindings) compatible with future packages that assume strict isolation? | Developer | First phantom-dependency incident |
