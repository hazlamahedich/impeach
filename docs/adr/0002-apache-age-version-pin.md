---
id: ADR-002
title: Apache AGE Version Pin and PostgreSQL 16 as the openCypher Path
status: Accepted
date: 2026-06-23
supersedes: null
superseded_by: null
deciders: [Winston (architect), user]
related: [AC-3, SC-5, STR-12, D1, ADR-001, ADR-003, ADR-015, ADR-023, ADR-024]
evidence:
  - _bmad-output/planning-artifacts/research/technical-graph-db-apache-age-evaluation-2026-06-19.md
  - https://github.com/apache/age/releases (verified 2026-06-22; re-audited and corrected 2026-06-23 — the 2026-06-22 check erroneously claimed AGE v1.7.0 was GA and that a PG16/v1.7.0 tag existed; both claims were false)
  - https://github.com/apache/age/releases/tag/PG16%2Fv1.6.0-rc0 (tag PG16/v1.6.0-rc0, commit 2db2f060a0c2d66c0683d6cf1e2a9af40a0c5f87, 04 Sep 2024)
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-19.md (amendment T1)
---

# ADR-002: Apache AGE Version Pin and PostgreSQL 16 as the openCypher Path

> **Amended 2026-06-23** — This ADR originally pinned Apache AGE to `1.7.0` and
> claimed `PG16/v1.7.0` as the source tag. Both claims were false: AGE has **no
> GA release at all** (every upstream artifact is an `-rc0` release candidate),
> and **no `PG16/v1.7.0` tag exists**. The version pin has been corrected to
> `PG16/v1.6.0-rc0` (the only official PG16 artifact). The decision (PG16 +
> AGE, exact pin, no floating tags) stands; only the version number was wrong.
> Correction follows adversarial review (Party Mode) by Winston (architect),
> Murat (test architect), and Amelia (developer).

## Context

IIP requires openCypher graph traversal co-located with relational storage and
pgvector in a **single PostgreSQL engine, single container, Apache-2.0** (AC-3
workstation story; STR-12 polyglot wiring). The TDD originally framed Apache AGE
as a stopgap pending "PostgreSQL 17+ adding SQL:PGQ."

Two facts forced this ADR:

1. **SQL:PGQ has not landed in PostgreSQL core** — not in PG17, not in PG18
   (verified against the official feature matrix and PG18 release notes,
   2026-06-19). SQL:PGQ is not a shipping Postgres feature. AGE is therefore
   **the** openCypher-on-Postgres path for the foreseeable future, not a
   stopgap.
2. **An internal note (`project-context.md`) flagged the AGE version pin as
   unverified**, claiming "latest GA appears to be AGE 1.5.0 (Rhodes, Aug
   2024)." A first verification against `github.com/apache/age/releases` on
   2026-06-22 concluded the claim was stale and asserted "the current GA is
   **v1.7.0**." **That 2026-06-22 verification was itself wrong.** A re-audit
   on 2026-06-23 against the same source confirms:
   - **AGE has NO GA release at all.** Every upstream artifact is a release
     candidate (`-rc0`). There is no `v1.7.0` GA tag and no `v1.6.0` GA tag.
   - **AGE 1.7.0-rc0 ships ONLY for PG17 and PG18.** There is no
     `PG16/v1.7.0` tag — the tag the original ADR cited does not exist.
   - **The only valid PG16 artifact is `PG16/v1.6.0-rc0`** (04 Sep 2024).
   - The original "1.5.0 Rhodes" claim was indeed stale/non-existent, but the
     "1.7.0 GA" claim that replaced it was equally incorrect.

## Decision

1. **Pin Apache AGE to `PG16/v1.6.0-rc0`** — the only official PG16 artifact.
   AGE is pre-1.0 in semantics and has **no GA release at all**; every upstream
   artifact is an `-rc0` release candidate. Pinning to the PG16-native `-rc0`
   is the most conservative reproducible choice. Floating tags (`>=1.7.0`) and
   building from `master` are rejected for a defamation-grade system — the pin
   is exact, and upgrades are explicit ADR-level decisions.
2. **Pin PostgreSQL to `16`** as the sole system of record (relational +
   pgvector + AGE, per architecture.md §Data Layer). The only PG16 AGE artifact
   is `PG16/v1.6.0-rc0`; that is what we build. Do **not** float to PG17/18
   without a separate ADR — pgvector HNSW `ef_search` defaults and AGE
   label-index behavior can shift across PG majors. Moving to PG17/18 to reach
   AGE 1.7.0-rc0 is a future ADR option, but both PG17 and PG18 AGE builds are
   **also `-rc0`**, so there is no GA benefit — only PG-major-version churn.
3. **The custom F1 Docker image** builds AGE `PG16/v1.6.0-rc0` and pgvector
   0.8.x **from source** on a `pgvector/pgvector:pg16` base (NEITHER plain
   `postgres:16` nor a floating tag), pins the resulting image by **digest**,
   and is shared by `infra/docker-compose.yml` and the Testcontainers
   integration suite (same image, tagged once).
4. **SQL:PGQ is removed from the rationale** everywhere it appears. AGE is the
   committed single-path openCypher implementation, not a "strike" or stopgap.
   Neo4j Community remains excluded by AGPL + Commons Clause (ADR-003).
5. **AGE DDL coexists with Drizzle migrations** via a parallel versioned
   `infra/sql/age/migrations/` track applied by a dedicated boot runner (D1).
   CI migration order is **relational (Drizzle) first → AGE projection second**
   (AGE FK-deps on relational schema, STR-12), codified as turbo task-graph
   dependencies, never parallel.

## Alternatives

1. **Wait for native SQL:PGQ in PostgreSQL.**
   - Rejected. Not shipping in PG17 or PG18. Building on a hypothetical future
     feature violates the "no pre-build for unbuilt features" rule. AGE is the
     path now.
2. **Apache AGE on PostgreSQL 18.**
   - Rejected as the v1 default. AGE 1.7.0-rc0 ships for PG18 (and PG17), but
     PG16 is the mature, ops-conservative choice for a defamation-grade v1 and
     has its own native artifact (`PG16/v1.6.0-rc0`). PG18 upgrade is a future
     ADR with its own compatibility cell. (PG18 is not forbidden; it is simply
     not the default pin.)
3. **Neo4j Community (separate graph engine).**
   - Rejected (ADR-003). AGPL + Commons Clause contamination; violates single-
     container + FOSS constraints.
4. **Kùzu or networkx as the primary store.**
   - Rejected as primary. Both are valuable as **batch analytics companions**
     for centrality algorithms (PageRank, betweenness) that AGE lacks, writing
     computed scores back as AGE node properties. AGE remains the transactional
     store; Kùzu/networkx are read-side accelerators.
5. **Floating `>=1.7.0` (or any floating AGE tag).**
   - Rejected. AGE pre-1.0 semantics mean a minor bump can silently change
     graph/label behavior. Exact pin (`PG16/v1.6.0-rc0`) + explicit upgrade
     ADRs only.

## Consequences

### Positive
- Single PostgreSQL engine satisfies graph + vector + relational in one
   container — the conjunction no alternative clears (verified by building the
   image and exercising cypher + vector in the Story 1.2 integration suite).
- AGE `PG16/v1.6.0-rc0` provides id-column indexes, `COPY`-based CSV ingest,
  and the fix for the >41 vlabels drop crash — load-bearing for IIP. **Note:**
  AGE 1.6.0-rc0 does **NOT** include RLS support on graph tables; RLS landed in
  1.7.0-rc0, which ships only for PG17/18 (also as `-rc0`). If RLS on graph
  tables becomes a hard requirement, that triggers the PG17/18 upgrade ADR — it
  is not available on the PG16 pin.
- Lowest migration lock-in of any option: AGE stores graphs as normal PG tables;
  exit to Neo4j/Kùzu/recursive-CTE is mechanical.
- SQL:PGQ non-existence is now a closed rationale, not a recurring question.

### Negative
- AGE has **no graph algorithm library** (PageRank, betweenness, connected
  components). Must run these via SQL over label tables or a Kùzu/networkx
  batch sidecar. Adds an analytics path to maintain.
  - AGE's Cypher compiles to SQL; deep unconstrained `*` traversals on dense hub
   nodes can explode. All traversals **must be depth-capped** (`*1..3`) with hot
   properties indexed — enforceable via `packages/graph/src/cypher.ts` wrapper
   review (PC-1e).
  - AGE is outside Drizzle's awareness — every Cypher query is a raw
   `sql\`...\`` template (untyped). Parameterization is mandatory via the
   `cypher(graph, query, params)` wrapper (PC-1e) which catches the
   `$id`-inside-`$$` positional-binding injection footgun.
- In non-autocommit clients (psycopg v3, JDBC), graph DDL calls
  (`create_graph`, `create_vlabel`) require an explicit `COMMIT` before they
  are visible to other sessions — documented AGE behavior to bake into the boot
  runner. The Story 1.2 integration suite includes a COMMIT-visibility test for
  `create_graph('iip_graph')`.
- AGE parser hooks must be loaded per session. The Story 1.2 custom image bakes
  `shared_preload_libraries=age` into the server CMD so hooks are available to
  every backend without a per-session `LOAD 'age'`. This was verified manually
  against the AGE PG16/v1.6.0-rc0 README (which documents `LOAD 'age'` per
  session) and by the integration suite executing `cypher()` without an
  explicit `LOAD`.

### RC0 Risk Acceptance and GA Upgrade Plan

> **Added 2026-06-23** per Foundation Action Plan B-13 (Party Mode adversarial
> review). Documents the accepted risk of running a release candidate in the
> production path and defines the GA upgrade response.

#### Risk Accepted


IIP accepts the risk of running Apache AGE `PG16/v1.6.0-rc0` (release
candidate, not GA) as the graph layer of a defamation-grade platform. This
decision is forced: AGE has **no GA release** — every upstream artifact is
an `-rc0`. The only valid PG16 artifact is `PG16/v1.6.0-rc0` (commit
`2db2f060a0c2d66c0683d6cf1e2a9af40a0c5f87`, 04 Sep 2024). There is no
alternative.

### GA Upgrade Triggers

When any of the following occurs, the upgrade owner must evaluate and
file a superseding ADR within **5 business days**:

| Trigger | Response | Severity |
|---------|----------|----------|
| AGE 1.6.0 **GA** released for PG16 | Evaluate stability; pin to GA tag; rebuild image; run full integration suite | High |
| AGE 1.6.0 **GA** released but **not** for PG16 | Stay on rc0; document in ADR; evaluate PG18 migration path | Medium |
| CVE or security advisory affecting AGE 1.6.0-rc0 | Evaluate patch availability; if patch exists only in newer rc, upgrade; file ADR same day | Critical |
| AGE 1.7.0+ adds RLS support for graph tables | Evaluate PG17+ migration (currently blocked — AGE 1.6.0-rc0 lacks RLS) | Medium |
| Breaking Cypher semantics change between rc tags | Pin current behavior; document divergence; file ADR | High |

### Upgrade Owner

**Winston (Architect)** is the named upgrade owner. If unavailable, the
**Tech Lead** inherits. The owner is responsible for:
1. Monitoring `github.com/apache/age/releases` monthly
2. Triage of breaking changes against IIP's Cypher usage
3. Filing superseding ADRs when triggers fire
4. Coordinating image rebuild + integration test validation

### Upgrade Procedure (when triggered)

1. Pin the new AGE tag/commit SHA in `infra/docker/Dockerfile.pg16-age-vector`
2. Rebuild the custom Docker image
3. Run `pnpm test:integration` — all 9+ tests must pass
4. Run the AGE boot migration ordering test (`tests/contract/age-boot-ordering.test.ts`)
5. Verify graph projection determinism (FR-2.4 — when implemented)
6. Update this ADR's evidence array with the new tag URL
7. Update `docs/glossary.md` T-013 if the version changes

### Implementation Notes

- `infra/docker/Dockerfile.pg16-age-vector` builds from `pgvector/pgvector:pg16`,
  compiles AGE from the `PG16/v1.6.0-rc0` tag source (commit `2db2f060`, the
  only official PG16 artifact; **no `PG16/v1.7.0` tag exists upstream**),
  enables `age`, `vector`, `pg_trgm`. `uuid-ossp` is intentionally omitted;
  UUID generation is provided by the built-in `pgcrypto` function
  `gen_random_uuid()` (PG13+). The resulting image is pinned by digest in both
  `infra/docker-compose.yml` and `packages/contracts/__fixtures__/containers.ts`
  (Story 1.3).
- `infra/sql/age/migrations/0001-iip-graph.sql` runs `CREATE EXTENSION IF NOT
  EXISTS age; SELECT create_graph('iip_graph');` with an explicit `COMMIT`
  boundary; applied by `scripts/age-migrate.ts` (the Story 1.3 boot runner),
  ordered **after** `pnpm db:migrate` in `turbo.json` task graph (STR-12).
  The migration is intentionally **not** copied into
  `/docker-entrypoint-initdb.d/`; the image only bootstraps extensions.
- All Cypher access via `packages/graph/src/cypher.ts → cypher(graph, query,
  params)` (PC-1e); `@iip/eslint-plugin` bans raw `ag_catalog.cypher(`
  outside that file.
- `packages/graph/package.json` `exports`: `"./reader"` public,
  `"./writer"` restricted to `apps/ingest-worker/src/graph-builder/**` (STR-5).

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | When should IIP evaluate PostgreSQL 18 + AGE `PG18/v1.7.0-rc0`? | Architect | Post-v1 stability review; separate ADR required (no GA benefit — AGE 1.7.0-rc0 is also an RC) |
| 2 | Should the Kùzu/networkx analytics sidecar be a v1 or v1.x deliverable? | Architect/PM | When centrality algorithms become a product requirement |
| 3 | Is a graph-aware replication check needed beyond standard PG streaming replication? | Architect | Pre-PD-3 launch gate (VAL-7) |
