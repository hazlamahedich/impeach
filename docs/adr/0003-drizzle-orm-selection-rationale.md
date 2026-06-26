---
id: ADR-003
title: Drizzle ORM Selection Rationale
status: Accepted
date: 2026-06-23
supersedes: null
superseded_by: null
deciders: [Winston (architect), user]
related: [AC-1, SC-5, PC-1a, PC-1b, STR-12, ADR-002, ADR-015]
evidence:
  - _bmad-output/planning-artifacts/architecture.md (SC-5, SC-9, D1, PC-1)
  - _bmad-output/planning-artifacts/research/technical-iip-technology-stack-validation-research-2026-06-19.md
  - _bmad-output/planning-artifacts/foundation-action-plan-2026-06-23.md (Winston RISK #5)
---

# ADR-003: Drizzle ORM Selection Rationale

## Context

IIP uses Drizzle 0.35.x + drizzle-kit 0.28.x as the relational access and
migration layer for PostgreSQL 16. Drizzle is pre-1.0. A defamation-grade
platform betting its schema provenance on a pre-1.0 ORM needs a documented
evaluation — not because Drizzle is wrong, but because "we picked the shiny
ORM" is not a defense in court (Winston, Party Mode review).

## Decision

Drizzle is selected over alternatives for the following reasons.

### Evaluation Matrix

| Criterion | Drizzle | Prisma | Kysely | Raw `pg` + sqitch |
|-----------|---------|--------|--------|---------------------|
| TypeScript-native types | ✅ Full inference from schema | ⚠️ Generated | ✅ Manual | ❌ None |
| Migration tooling | ✅ drizzle-kit generate/migrate | ✅ Prisma migrate | ❌ External | ✅ sqitch |
| Query builder expressiveness | ✅ SQL-like, composable | ⚠️ DSL abstraction | ✅ SQL-like | ❌ Raw SQL |
| AGE coexistence | ✅ Raw `sql\`...\`` escape (ADR-015) | ❌ Hides connection | ✅ Transparent | ✅ Transparent |
| Bundle size (workers) | ✅ Tree-shakeable | ❌ Heavy runtime | ✅ Lightweight | ✅ Zero overhead |
| License | ✅ Apache-2.0 | ❌ Proprietary-ish | ✅ MIT | ✅ MIT |
| Pre-1.0 risk | ⚠️ Yes | ✅ Stable | ✅ Stable | ✅ N/A |

### Why Drizzle Won

1. **AGE coexistence is the binding constraint.** AGE Cypher queries are raw
   `sql\`...\`` templates (ADR-015). Drizzle's raw SQL escape is first-class;
   Prisma hides the connection and makes AGE DDL impossible without
   `$executeRawUnsafe` (injection risk). Kysely works but lacks migration
   tooling.

2. **TypeScript inference from schema definitions.** The schema IS the types.
   No codegen step (unlike Prisma). Branded/nominal types (`.$type<EntityId>()`)
   prevent UUID transposition bugs — load-bearing for SEC-6 hash-chain
   attribution (Winston #1).

3. **Tree-shakeable for worker bundles.** Worker processes import only the
   query builder pieces they use. Prisma's runtime is monolithic.

4. **Apache-2.0 license.** Aligns with the FOSS/local-first mandate (NFR-D-3).

### Pre-1.0 Risk Acceptance

Drizzle 0.35.x is pre-1.0. Risks accepted:

- **Breaking changes on 0.x → 1.0 migration.** Mitigated by: schema is
  TypeScript-first (migration is a type-check exercise, not a rewrite);
  pin exact patch versions (`drizzle-orm: 0.35.3`, `drizzle-kit: 0.28.1`);
  minors must match.
- **`push` command is non-deterministic.** Banned in CI; only `generate` +
  `migrate` (project-context.md).
- **No native AGE support.** Every Cypher query is raw SQL (ADR-015). This is
  acceptable — AGE is outside Drizzle's awareness by design (D1).

## Alternatives

### Rejected

- **Prisma:** Hides the connection layer; AGE DDL requires unsafe escapes;
  generated client adds a codegen step and bundle weight; license posture
  ambiguous for a FOSS platform.
- **Kysely:** Excellent query builder with full types, but no migration
  tooling. Would require pairing with sqitch or hand-rolled migration runner.
  Viable but more moving parts.
- **Raw `pg` + sqitch:** Maximum control, zero ORM overhead. But loses type
  inference from schema definitions — every query is untyped. For a
  defamation-grade system where type safety prevents attribution bugs, this
  is a net negative.

## Consequences

- Drizzle 0.35.x is the sole relational access layer. Schema single-source:
  `packages/db/src/schema/**/*.ts` (lint-banned elsewhere).
- AGE DDL lives in parallel `infra/sql/age/migrations/` applied by boot runner
  (ADR-002, `scripts/age-migrate.ts`).
- `drizzle-orm` and `drizzle-kit` minors must match (silent migration bugs
  otherwise).
- Upsert via `packages/db/src/upsert.ts`; multi-writes via `withTx(fn)` (PC-1a/b).
- When Drizzle 1.0 ships, evaluate migration effort and file superseding ADR.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Does Drizzle 1.0 break the 0.35.x schema/migration format, requiring a full migration-set regeneration? | Developer/Architect | Drizzle 1.0 release |
| 2 | Should the AGE raw-SQL escape hatch (ADR-015) gain a typed wrapper above `sql\`...\`` once Drizzle supports plugin types? | Architect | Post-1.0 Drizzle plugin API stability |
| 3 | Is the `drizzle-orm`/`drizzle-kit` minor-match CI assertion sufficient, or should patch versions also be locked together? | Developer | First silent migration-bug incident |
