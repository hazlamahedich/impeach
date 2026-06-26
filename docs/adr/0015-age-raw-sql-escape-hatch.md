---
id: ADR-015
title: AGE Raw-SQL Escape Hatch for Cypher in Drizzle
status: Accepted
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), Amelia (developer), user]
related: [D1, PC-1e, SC-5, STR-12, ADR-002, ADR-003]
evidence:
  - _bmad-output/planning-artifacts/architecture.md (D1: AGE outside Drizzle's awareness; PC-1e cypher() wrapper; ADR-015)
  - _bmad-output/project-context.md (§AGE Cypher ONLY via packages/graph/src/cypher.ts; lint-ban raw ag_catalog.cypher()
---

# ADR-015: AGE Raw-SQL Escape Hatch for Cypher in Drizzle

## Context

Drizzle (ADR-003) is the relational access layer, but Apache AGE (ADR-002) is
**outside Drizzle's awareness** — AGE stores graphs as normal PG tables but its
Cypher query language is invoked via `ag_catalog.cypher(...)`, which Drizzle
cannot type or compose. Every Cypher query is therefore a raw `sql\`...\``
template, untyped. This is acceptable (AGE is a projection, not a store, per
PC-2.5) but it opens two hazards: (1) an injection footgun specific to AGE's
`$id`-inside-`$$` positional-binding syntax, and (2) scattered raw-SQL Cypher
calls across the codebase that no type system can guard.

D1 + PC-1e mandate a single wrapper that centralizes Cypher execution,
parameterization, and lint enforcement.

## Decision

**All AGE Cypher access goes through `packages/graph/src/cypher.ts →
cypher(graph, query, params)`. Raw `ag_catalog.cypher(` is lint-banned
everywhere else.**

1. **The wrapper** `cypher(graph, query, params)`:
   - takes the named graph, a parameterized Cypher template, and a typed
     `params` object;
   - binds parameters safely, **catching the `$id`-inside-`$$` positional-binding
     injection footgun** that "parameterized queries only" misses (an `$id`
     interpolated into a `$$ ... $$` block is string-interpolated, not
     parameter-bound);
   - returns typed rows via a caller-supplied row mapper.
2. **AGE DDL lives outside Drizzle** in a parallel `infra/sql/age/migrations/`
   track applied by a dedicated boot runner (`scripts/age-migrate.ts`, D1).
   CI migration order is **relational (Drizzle) first → AGE projection second**
   (AGE FK-deps on relational schema, STR-12), codified as turbo task-graph
   dependencies.
3. **Lint enforcement:** `@iip/eslint-plugin` bans raw `ag_catalog.cypher(`
   outside `packages/graph/src/cypher.ts` (PC-1e). The wrapper is the only
   sanctioned Cypher entry point.
4. `packages/graph` `exports`: `"./reader"` public, `"./writer"` restricted to
   `apps/ingest-worker/src/graph-builder/**` (STR-5 — `apps/ingest-worker` is
   the sole AGE writer).

## Alternatives

1. **Scattered raw `sql\`SELECT * FROM ag_catalog.cypher(...)\`` per call site.**
   - Rejected. No central place to catch the positional-binding injection
     footgun, no consistent parameterization, no typed row mapping. The exact
     hazard this ADR exists to close.
2. **A Drizzle plugin to teach it AGE types.**
   - Deferred/Rejected for v1. Drizzle has no native AGE support, and a
     community plugin would couple a defamation-grade schema provenance layer
     to an unmaintained extension. The raw-SQL escape behind a single wrapper
     is the conservative choice; revisit post-Drizzle-1.0 (ADR-003 open
     question).
3. **SQL:PGQ instead of Cypher (no escape hatch needed).**
   - Rejected. SQL:PGQ does not exist in PG17/18 (ADR-002); AGE openCypher is
     the committed path, and it requires this escape hatch.

## Consequences

- One Cypher entry point (`cypher()`); the positional-binding footgun is
  caught there, not rediscovered per call site.
- AGE DDL is migration-tracked separately from Drizzle and sequenced after it;
  the boot runner applies it at startup.
- AGE queries remain untyped at the Drizzle layer (typed only via the
  caller-supplied row mapper) — an accepted trade for keeping AGE as a
  rebuildable projection (PC-2.5: drop + rebuild per affected partition, not
  incremental upsert).

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Should the `cypher()` wrapper gain a typed row-mapper inference from a zod schema per query? | Architect | F5 AGE client milestone |
| 2 | Is depth-capping (`*1..3`) on traversals enforced in the wrapper or at review? | Architect/Developer | First unbounded-traversal perf incident |
| 3 | Should AGE DDL migrations gain a determinism fixture (project twice, diff empty) as a CI gate? | Test Architect | PC-2.5 projection-determinism gate |
