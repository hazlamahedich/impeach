---
id: ADR-002
title: Apache AGE Version Pin and PostgreSQL 16 as the openCypher Path
status: Accepted
date: 2026-06-22
supersedes: null
superseded_by: null
deciders: [Winston (architect), user]
related: [AC-3, SC-5, STR-12, D1, ADR-003, ADR-015]
evidence:
  - _bmad-output/planning-artifacts/research/technical-graph-db-apache-age-evaluation-2026-06-19.md
  - https://github.com/apache/age/releases (verified 2026-06-22)
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-19.md (amendment T1)
---

# ADR-002: Apache AGE Version Pin and PostgreSQL 16 as the openCypher Path

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
   2024)." Verification against `github.com/apache/age/releases` on 2026-06-22
   shows **no such release exists**. The claim was stale. The current GA is
   **v1.7.0**, and it is the version the architecture already cited.

## Decision

1. **Pin Apache AGE to `1.7.0`** (exact major.minor.patch). AGE is pre-1.0 in
   semantics; minor releases have changed label/graph behavior. Floating
   `>=1.7.0` is not acceptable for a defamation-grade system — the pin is
   exact, and upgrades are explicit ADR-level decisions.
2. **Pin PostgreSQL to `16`** as the sole system of record (relational +
   pgvector + AGE, per architecture.md §Data Layer). AGE 1.7.0 supports PG11–18;
   PG16 is the target. Do **not** float to PG17/18 without a separate ADR —
   pgvector HNSW `ef_search` defaults and AGE label-index behavior can shift
   across PG majors.
3. **The custom F1 Docker image** builds AGE 1.7.0 and pgvector 0.8.x **from
   source** on a `pgvector/pgvector:pg16` base (NEITHER plain `postgres:16` nor
   a floating tag), pins the resulting image by **digest**, and is shared by
   `infra/docker-compose.yml` and the Testcontainers integration suite (same
   image, tagged once).
4. **SQL:PGQ is removed from the rationale** everywhere it appears. AGE is the
   committed single-path openCypher implementation, not a "strike" or stopgap.
   Neo4j Community remains excluded by AGPL + Commons Clause (ADR-003).
5. **AGE DDL coexists with Drizzle migrations** via a parallel versioned
   `infra/sql/age/migrations/` track applied by a dedicated boot runner (D1).
   CI migration order is **relational (Drizzle) first → AGE projection second**
   (AGE FK-deps on relational schema, STR-12), codified as turbo task-graph
   dependencies, never parallel.

## Alternatives Considered

1. **Wait for native SQL:PGQ in PostgreSQL.**
   - Rejected. Not shipping in PG17 or PG18. Building on a hypothetical future
     feature violates the "no pre-build for unbuilt features" rule. AGE is the
     path now.
2. **Apache AGE on PostgreSQL 18.**
   - Rejected as the v1 default. AGE 1.7.0 supports PG18, but PG16 is the
     mature, ops-conservative choice for a defamation-grade v1. PG18 upgrade is
     a future ADR with its own compatibility cell. (PG18 is not forbidden; it
     is simply not the default pin.)
3. **Neo4j Community (separate graph engine).**
   - Rejected (ADR-003). AGPL + Commons Clause contamination; violates single-
     container + FOSS constraints.
4. **Kùzu or networkx as the primary store.**
   - Rejected as primary. Both are valuable as **batch analytics companions**
     for centrality algorithms (PageRank, betweenness) that AGE lacks, writing
     computed scores back as AGE node properties. AGE remains the transactional
     store; Kùzu/networkx are read-side accelerators.
5. **Floating `>=1.7.0`.**
   - Rejected. AGE pre-1.0 semantics mean a minor bump can silently change
     graph/label behavior. Exact pin + explicit upgrade ADRs only.

## Consequences

### Positive
- Single PostgreSQL engine satisfies graph + vector + relational in one
  container — the conjunction no alternative clears (verified, see evidence).
- AGE 1.7.0 brings RLS support, `COPY`-based CSV ingest, id-column indexes, and
  the fix for the >41 vlabels drop crash — all load-bearing for IIP.
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
  runner.

### Neutral
- Custom Docker image build (~10–15 min for AGE from source) is a CI cost; cache
  aggressively. The image digest pin means reproducible Testcontainers runs.
- AGE version drift between dev/CI/prod is eliminated by the single shared
  image.

## Open Questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | When should IIP evaluate PostgreSQL 18 + AGE 1.7.0 PG18 branch? | Architect | Post-v1 stability review; separate ADR required |
| 2 | Should the Kùzu/networkx analytics sidecar be a v1 or v1.x deliverable? | Architect/PM | When centrality algorithms become a product requirement |
| 3 | Is a graph-aware replication check needed beyond standard PG streaming replication? | Architect | Pre-PD-3 launch gate (VAL-7) |

## Implementation Notes

- `infra/docker/Dockerfile.pg16-age-vector` builds from `pgvector/pgvector:pg16`,
  compiles AGE 1.7.0 from the `PG16/v1.7.0` tag source, enables `age`,
  `vector`, `pg_trgm`, `uuid-ossp`. Image pinned by digest in both
  `infra/docker-compose.yml` and `packages/contracts/__fixtures__/containers.ts`.
- `infra/sql/age/migrations/0001-iip-graph.sql` runs `CREATE EXTENSION IF NOT
  EXISTS age; SELECT create_graph('iip_graph');` with an explicit `COMMIT`
  boundary; applied by `scripts/age-migrate.ts` (the boot runner), ordered
  after `pnpm db:migrate` in `turbo.json` task graph (STR-12).
- All Cypher access via `packages/graph/src/cypher.ts → cypher(graph, query,
  params)` (PC-1e); `@iip/eslint-plugin` bans raw `ag_catalog.cypher(`
  outside that file.
- `packages/graph/package.json` `exports`: `"./reader"` public,
  `"./writer"` restricted to `apps/ingest-worker/src/graph-builder/**` (STR-5).
- Node/edge labels UPPERCASE matching type (`PERSON`, `VOTED_AGAINST`); each
  node carries its relational `id`; named graph = `iip_graph` (architecture.md
  §AGE Conventions).
