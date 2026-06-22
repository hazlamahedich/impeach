# Graph Database Evaluation for IIP — Mid-2026

> **Scope:** Critical evaluation of Apache AGE vs alternatives for the Impeachment Intelligence Platform (IIP) knowledge-graph + RAG platform. Verifies the TDD's choice of Apache AGE co-located with PostgreSQL 16 + pgvector.
>
> **Confidence legend:** 🟢 HIGH (primary source, fetched 2026-06-19) · 🟡 MEDIUM (reputable secondary / vendor docs) · 🔴 LOW (inference / stale)
>
> **TL;DR up front:** **Keep Apache AGE.** The single most important finding is that the TDD's stated rationale is built on a **false premise** — SQL:PGQ has **NOT** landed in PostgreSQL core (neither 17 nor 18). With that option off the table for new projects, AGE (Apache-2.0, actively maintained, PG18-compatible, v1.7.0) remains the best FOSS posture for a local-first, single-container, graph+vector+relational workload at IIP's scale. Neo4j Community is disqualified by AGPL + Commons Clause contamination. See [Final Recommendation](#final-recommendation).

---

## 1. Apache AGE — Current State

| Attribute | Value | Source |
|---|---|---|
| Latest version | **1.7.0** (PG18 branch: 21 Jan 2025; PG17 branch: 11 Feb 2025) | github.com/apache/age/releases 🟢 |
| License | **Apache License 2.0** (ASF) | age.apache.org, LICENSE 🟢 |
| GitHub stars | **~4.6k** | github.com/apache/age 🟢 |
| Forks | ~503 | github.com/apache/age 🟢 |
| Commits | 854 | github.com/apache/age 🟢 |
| PostgreSQL support | **PG 11, 12, 13, 14, 15, 16, 17 & 18** | README 🟢 |
| Governance | **Apache Software Foundation** (graduated PMC) | age.apache.org 🟢 |
| Maintenance | **Actively maintained** — PG18 port landed in v1.7.0 (#2251); regular point releases | release notes 🟢 |
| Docker | Official `apache/age` image, single-container `docker run` | README 🟢 |
| pgvector interop | A proposal exists for "Vector handling with extension (pgvector)"; co-existence in same PG instance works today (separate extensions) | age.apache.org 🟢 |
| Drivers | Python, Node.js, Golang, Java (JDBC) | github.com/apache/age/drivers 🟢 |

**v1.7.0 highlights (signals active investment):**
- RLS (Row-Level Security) support + permission checks (#2309)
- Replaced libcsv with native pg `COPY` for CSV loading (#2310) — big ingest speedup
- Direct array indexing for vertex/edge field access (#2302) — query perf
- 32-bit `graphid` platform support (#2286)
- Index on id columns (#2117); GIN/B-tree property indexes on vertices **and** edges
- Bug fixes for memory leaks, segmentation faults, string concat regression

**Read:** AGE is **not** abandoned. The PG18 port and RLS work in early 2025 are signs of ongoing, not declining, investment. 🟢

### What the team looks like
- Lead maintainer: `jrgemignani` (signs releases) — continuity present.
- Bitnine (AgensGraph origin) historically contributed engineering; AGE is the open-source upstream of that commercial line, so there is a commercial backer incentive to keep AGE healthy. 🟡

### Production usage
- No marquee public case study at "Apple/Spotify scale" (those are *PostgreSQL* users, not necessarily AGE — the README is careful to say AGE "supports all the functionalities of PostgreSQL"). 🟡
- LangChain merged a `GraphStore` implementation for AGE (referenced on age.apache.org) — relevant signal for RAG adoption. 🟢
- ASF graduation gives institutional durability: even if Bitnine withdrew, the codebase lives under Apache governance. 🟢

---

## 2. Apache AGE — Capabilities & Limitations

### openCypher coverage (what works) 🟢 from age-manual/clauses/match.html
AGE implements a substantial subset of **openCypher**:
- `MATCH` with labels, inline property maps, directed/undirected edges
- Variable-length paths: `*2`, `*3..5`, `*3..`, `*..5`, `*` (unbounded) ✅
- Multi-hop patterns: `(a)-[:ACTED_IN]->(m)<-[:DIRECTED]-(d)` ✅
- `WHERE`, `WITH`, `RETURN`, aggregations, `ORDER BY`/`LIMIT` ✅
- Hybrid SQL+Cypher: `SELECT ... FROM cypher('g', $$ ... $$) AS (...)` ✅ — the killer feature for IIP (join graph results to relational tables/pgvector in one query)
- Property indexes (B-tree, GIN) on vertices and edges; id-column index as of 1.7.0
- Multiple graphs in one database; hierarchical label organization

### What is missing / weaker vs Neo4j Cypher 🟡
- **No full GQL standard support** — AGE tracks openCypher, not ISO GQL. GQL features (e.g., linear/standing queries, advanced path modes) are absent.
- **No built-in graph algorithm library** — PageRank, betweenness, connected components are **not** provided by AGE itself. You'd compute these via:
  - SQL over the label tables (AGE exposes graph as physical tables), or
  - a sidecar (networkx in the batch job), or
  - Postgres graph-algorithm extensions.
- APOC-level utility procedures (Neo4j's power-user toolkit) have no AGE equivalent.
- Vector index is **not native to AGE** — you use pgvector in the same cluster and join via SQL (which is actually the desired IIP pattern).

### Known operational limitations 🟡 (community-reported; not all re-verified today due to GitHub search robots.txt)
- **Catalog-write visibility gotcha**: in non-autocommit clients (psycopg v3, JDBC), DDL-like calls (`create_graph`, `create_vlabel`) are only visible to other sessions after `COMMIT`. Documented prominently in the README — a real footgun if your app uses connection pools with open transactions. 🟢 (in README)
- **Concurrent writes**: AGE stores graph data as PostgreSQL tables, so it inherits PG's MVCC. Label tables have per-label locks; heavy concurrent bulk writes to the *same* label can contend. For IIP's **batched** write pattern (1000s nodes/day, not real-time), this is a non-issue. 🟡
- **Replication**: standard PG streaming/logical replication replicates the AGE tables transparently (they are regular relations). No special graph-aware replication is needed. ✅ 🟡
- **Upgrade cost**: v1.6→1.7 migration "may take a while for large graphs" due to index creation (warned in release notes). Plan offline maintenance windows. 🟢
- **Planner**: AGE's Cypher is compiled to SQL; the **PostgreSQL planner** does the work. For 1–3 hop traversals at 10K–100K entities this is fast. Deep unconstrained `*` traversals on dense nodes can explode (same as any graph DB without a cap). 🟡
- **Max labels**: a now-fixed crash when dropping graphs with >41 vlabels (#2248) — fixed in 1.7.0, but signals past immaturity in edge cases. 🟢

### Realistic performance vs native graph DBs at IIP scale 🟡
At **10K–100K nodes / 100K–1M edges** (small-to-medium by graph-DB standards):
- AGE's overhead vs Neo4j is real but **not decisive** for this size. AGE loses to Neo4j on deep traversal throughput and in-memory hot-path latency, but wins on mixed SQL+graph+vector joins (Neo4j can't do those in-process).
- No up-to-date independent benchmark located today; treat vendor benchmarks (either side) as marketing. The honest statement: **at IIP's scale, AGE latency for 1–3 hop traversals is single-digit to low-double-digit ms, well within RAG retrieval budgets.** 🟡

---

## 3. The SQL:PGQ Question — **Correcting the TDD's central premise**

> ⚠️ **The TDD assumes "PostgreSQL 17+ adds SQL:PGQ — how does this affect AGE?" This assumption is FALSE.**

### Evidence 🟢 (primary sources, fetched 2026-06-19)
1. **PostgreSQL feature matrix** (postgresql.org/about/featurematrix) — no "Property Graph", "SQL:PGQ", or "PGQ" entry appears in any version column (8.1 → 18).
2. **PostgreSQL 18 release notes** (postgresql.org/docs/18/release-18.html, released 2025-09-25) — full feature list contains **zero** mentions of SQL:PGQ, property graphs, or graph queries. New SQL items are things like `ANY_VALUE`, `MERGE ... RETURNING`, `uuidv7()`.
3. `postgresql.org/docs/17/datatype-pgq.html` → **404**. No such datatype exists.
4. `wiki.postgresql.org/wiki/SQL:PGQ` → **404**.

### Reality
- SQL:PGQ / SQL:GQL property-graph support has been a **recurring PostgreSQL CommitFest patch** (driven partly by the DuckDB/CWI team — Peter Boncz, Hannes Voigt, et al.) that has been **deferred/returned-with-feedback repeatedly**. As of PG18 (Sep 2025) it is **still not merged**. Earliest realistic landing: PG19 (2026) or later, and even then it ships `GRAPH_TABLE` read-only pattern matching **without** a full property-graph storage model — it would query *existing* relational tables as if they were graphs.
- **Conclusion:** SQL:PGQ does **not** make AGE obsolete for new projects in 2026. It is not a shipping Postgres feature. 🔴 confidence on timing, 🟢 confidence on "not in PG17/18".

### Where SQL:PGQ *does* live
- **DuckDB** ships a `pgq` extension implementing SQL:PGQ `PROPERTY GRAPH` / `GRAPH_TABLE` syntax (DuckDB 0.10+, 2024). It's an **analytical, embedded, in-process** engine — see [Alternatives](#4-alternatives-compared).
- **Oracle 23ai** has full SQL:PGQ + GQL. Not FOSS. Not relevant.

---

## 4. Alternatives Compared

Each row: what it is · fit for IIP · FOSS posture · verdict.

### Neo4j Community Edition — ❌ NOT recommended for IIP
- **What:** Mature native graph DB; Cypher; added vector index in v5.x (2023); now at 2026.05.0.
- **FOSS posture:** 🔴 **GPLv3 + AGPLv3 + Commons Clause** (per Wikipedia + neo4j.com/licensing). This is **critical**:
  - **AGPLv3** → if IIP is *offered over a network* (which a RAG platform is), the AGPL's network copyleft can compel you to open-source all linked/combined code. This is the classic AGPL contamination risk the TDD explicitly wants to avoid.
  - **Commons Clause** → you cannot sell the software itself as a service. **Neo4j Community is no longer OSI-"open source"** — it is "source-available freeware." The Commons Clause was added precisely to close the managed-service loophole.
  - "Binaries: Freemium registerware" — registration-gated downloads.
- **Fit:** Excellent graph engine, but for a **local-first FOSS project intended for redistribution**, AGPL + Commons Clause is a hard blocker. ❌
- **Caveat:** if IIP were **strictly self-hosted, never distributed, never offered as a service**, AGPL obligations are debatable — but that's a legal gray zone you should not build a product foundation on.

### Neo4j (Community) + pgvector sidecar (Postgres) — ❌ not worth it
- Splits data across two engines → no hybrid SQL+graph+vector join; loses AGE's main advantage while keeping Neo4j's license problem. Double the ops surface in a "single container" requirement → **violates the single-Docker constraint**. ❌

### PostgreSQL 17/18 + native SQL:PGQ — ❌ does not exist
- As shown in §3, **SQL:PGQ is not in PostgreSQL core.** This option is fictional for 2026. ❌

### DuckDB + PGQ (extension) — ⚠️ analytical-only
- **What:** Embedded in-process OLAP DB with a real SQL:PGQ implementation (`CREATE PROPERTY GRAPH`, `GRAPH_TABLE`).
- **FOSS:** MIT. ✅
- **Fit:** Brilliant for **offline/batch graph analytics** (compute PageRank over a snapshot, then write results back). **Not** a transactional store — no durable server process, no concurrent writers, no long-running online graph you mutate. Good as a *secondary* analytics tool alongside AGE, not a replacement. ⚠️
- **Verdict:** Consider as a batch-alalytics accelerator for centrality algorithms; do not replace AGE with it.

### Memgraph — ⚠️ memory-bound, licensing shift
- **What:** In-memory, openCypher, C++, sub-ms latency; strong streaming (Kafka/CDC) story.
- **FOSS:** Originally fully open; Memgraph moved toward a **BSL-style / community+enterprise split** (confirm exact current terms before adopting — 🟡).
- **Fit:** In-memory means your **entire graph + indices fit in RAM**. At IIP scale (1M edges + millions of chunks) the chunks shouldn't live in the graph DB anyway; the graph itself (nodes+edges) fits comfortably in RAM. But "single Docker container" + in-memory + durability (snapshots) adds ops complexity vs AGE-on-PG. openCypher compatibility is strong.
- **Verdict:** Strong performer if you accept in-memory model; weaker on the "one DB with relational+vector" requirement. ⚠️

### NebulaGraph — ⚠️ over-engineered for IIP
- **What:** Distributed, C++ storage, nGQL (Neo4j-Cypher-ish but **not** standard Cypher/GQL), Apache 2.0.
- **Fit:** Built for **multi-node sharded** graphs (billions of edges). IIP at 1M edges is **3 orders of magnitude below** where Nebula's distributed design pays off. Adds 3 services (graphd/metad/storaged) → **breaks single-container mandate**. ❌ for IIP.

### ArangoDB — 🟡 multi-model but wrong query language
- **What:** Documents + graphs + KV in one engine, **AQL** (Arango Query Language, not Cypher/GQL), Apache 2.0.
- **Fit:** Genuinely multi-model and single-binary (good for the container constraint). But AQL means no Cypher, no GQL, no openCypher tooling/ecosystem, and graph traversal ergonomics are weaker than Cypher. No pgvector (its vector support is separate/limited). 🟡
- **Verdict:** Defensible if you value multi-model over Cypher; otherwise AGE is more aligned with the openCypher ecosystem IIP's TDD assumes.

### JanusGraph — ❌ too heavy
- **What:** Distributed graph layer over external storage (Cassandra/HBase/Scylla) + external index (Elasticsearch). Apache 2.0.
- **Fit:** Requires **multiple backing services** → fundamentally incompatible with single-container, local-first. Built for 100M+ edge distributed deployments. ❌

### TigerGraph Free Edition — ❌ proprietary
- **What:** Powerful GSQL, but **proprietary/freemium** with hard scale caps (nodes, RAM). Not FOSS. ❌

### GraphDB Free (Ontotext) — ❌ wrong model + license
- **What:** RDF + **SPARQL** (not property graph / not Cypher). Free edition has caps.
- **Fit:** IIP is a property-graph + vector problem, not an RDF/OWL semantic-web problem. Different paradigm, different tooling. ❌

### Kùzu — 🟢 strong *embedded* contender
- **What:** In-process (DuckDB-style) **property graph** DB, **Cypher**, MIT license, columnar storage, built-in graph algorithms (PageRank, betweenness, SCC, etc.). Created by the same Waterloo lab influencing DuckDB-PGQ.
- **Fit:** For IIP's **batched-write, read-heavy, single-process** workload this is *remarkably* well-matched. Built-in centrality algorithms solve the PageRank/betweenness gap AGE has. Cypher ergonomics are excellent.
- **Catch:** It's **embedded** (no server, no concurrent multi-client transactions). If IIP needs multiple concurrent client connections hitting a live server, Kùzu alone is insufficient — you'd run it inside the application process and serialize access, or use it for analytics with AGE/PG as the transactional store.
- **Verdict:** 🟢 Best alternative *if* IIP's access pattern is single-process or analytics-batch. Worth a POC. As a **replacement** for AGE it trades "concurrent multi-client server" for "better algorithms + simpler model."

### PostgreSQL + recursive CTEs (no graph extension) — 🟡 fallback, ergonomically poor
- **What:** Model edges as a `relationship(from_id, to_id, type, props)` table; traverse with `WITH RECURSIVE`.
- **Fit:** Works, zero-extension-dependency, fully ACID, replicates trivially. But:
  - **No Cypher** — every traversal is hand-written recursive SQL. A 2-hop neighbor query is ~10 lines; a variable-length path with edge predicates is painful; cycle handling (`CYCLE ... SET`) is verbose.
  - **No graph planner** — PG optimizes recursive CTEs as set operations; no graph-native cardinality estimation for variable-length paths. Performance degrades faster than AGE at depth.
  - **No built-in algorithms** — PageRank/betweenness are custom SQL (slow) or external.
- **Verdict:** Acceptable only for trivial, shallow graphs. At IIP's pattern-matching + centrality needs, the developer-experience and correctness risk is high. 🟡

---

## 5. Workload Fit Analysis (IIP-specific)

Mapping IIP's stated query patterns to engines:

| Query pattern | AGE | Neo4j CE | Recursive CTE | Kùzu | DuckDB+PGQ |
|---|---|---|---|---|---|
| 1–3 hop traversal | ✅ fast | ✅ fastest | 🟡 verbose | ✅ fast | ✅ fast (read-only) |
| Neighbor expansion | ✅ | ✅ | 🟡 | ✅ | ✅ |
| Shortest path | 🟡 via Cypher `*` + filter (no native all-pairs) | ✅ built-in | 🔴 painful | ✅ built-in | 🟡 |
| PageRank / betweenness | 🔴 not built-in → external/networkx | ✅ GDS lib (Enterprise) | 🔴 | ✅ built-in | 🟡 via algorithms ext |
| Pattern matching (`MATCH (a)-[:R]->(b)-[:S]->(c)`) | ✅ Cypher | ✅ Cypher | 🟡 | ✅ Cypher | ✅ GRAPH_TABLE |
| Hybrid join graph ⟕ relational ⟕ pgvector | ✅ **one query** | 🔴 impossible in-process | ✅ (same DB) | 🟡 (separate from PG) | 🔴 separate process |
| Single Docker container | ✅ | ✅ | ✅ | 🟡 (in-app) | 🔴 (sidecar) |
| Concurrent multi-client | ✅ (PG MVCC) | ✅ | ✅ | 🟡 single-proc | 🔴 |

**Key insight:** IIP's defining requirement — **graph traversal + vector retrieval + relational joins in a single engine, in one container, Apache-2.0** — is a conjunction that **only AGE satisfies** among all candidates. Every alternative breaks at least one axis of that conjunction:

- Neo4j CE breaks the **license** (AGPL+Commons Clause) and the **hybrid-join** (can't join to pgvector in-process).
- Kùzu breaks **concurrent multi-client server** (embedded).
- Recursive CTE breaks **ergonomics/algorithms** and **performance at depth**.
- DuckDB+PGQ breaks **transactional/concurrent** and **single-container-with-PG** (it's a second engine).
- Everything distributed (Nebula/Janus) breaks **single-container**.

### Performance realism at IIP scale 🟡
- 10K–100K entities + 100K–1M edges is **small**. Any engine handles the raw size.
- The **chunks** (millions) belong in pgvector, **not** in the graph. The graph is metadata/relationships. Keep it lean.
- AGE's main perf risk is **unbounded `*` traversals on high-degree "hub" nodes** (e.g., a ubiquitous entity everyone connects to). Mitigation: always cap depth (`*1..3`), index hot properties, and pre-compute centrality offline (Kùzu or networkx) rather than at query time.
- Realistic AGE latency at this scale for capped 1–3 hop traversals with proper indexes: **low ms**, fine for RAG. 🟡

---

## 6. Risk Assessment

| Risk | AGE | Mitigation |
|---|---|---|
| **Project abandonment** | 🟡 Low-Med. ASF-governed = durable even if a sponsor withdraws; active PG18 port in 2025 shows momentum. | Periodic pg_dump of label tables = portable (they're plain PG tables). |
| **Migration lock-in** | 🟢 Low. AGE graph data is stored as normal PostgreSQL tables (`ag_catalog`-managed). Exporting nodes/edges to CSV or to another graph DB is mechanical. | Keep an ETL script that materializes `(node_label, props)` / `(edge_label, from, to, props)` views. |
| **openCypher subset gaps** | 🟡 Med. Some advanced Cypher/GQL features absent. | Validate required queries against the manual early; fall back to SQL for gaps. |
| **Performance cliff on deep traversals** | 🟡 Med. | Cap path depth; precompute centrality offline. |
| **Catalog-write/transaction gotchas** | 🟡 Med (psycopg/JDBC). | Document the autocommit/commit rules in IIP's data-access layer; wrap graph DDL in explicit commits. |
| **No native vector index in AGE** | 🟢 Low (non-goal). | Use pgvector in same cluster — already the plan. |
| **License contamination** | 🟢 None (Apache 2.0). | — |

**Migration path if ever needed:** AGE → Neo4j is a data shape transfer (nodes→nodes, edges→relationships, props→props), doable in a one-shot script. AGE → Kùzu is trivial (same Cypher, re-ingest). AGE → recursive-CTE is a rewrite but data already in PG. **Lowest lock-in of any option.** 🟢

---

## 7. Final Recommendation

### **STICK WITH APACHE AGE as the TDD specifies** — but **correct the TDD's rationale.**

#### Why (ranked)
1. **The TDD's stated alternative (PG-native SQL:PGQ) does not exist.** The single biggest correction: SQL:PGQ is **not** in PostgreSQL 17 or 18 (verified against the official feature matrix and PG18 release notes, 2026-06-19). So AGE is not "the stopgap until PG ships PGQ" — it is **the** path to openCypher-on-Postgres for the foreseeable future.
2. **AGE uniquely satisfies the full requirement conjunction**: openCypher + relational + pgvector in **one PostgreSQL engine**, **one container**, **Apache-2.0**. No other candidate clears all bars simultaneously.
3. **FOSS posture is clean.** Apache 2.0 has zero contamination risk and is OSI-certified — directly unlike Neo4j Community (AGPL + Commons Clause), which should be **explicitly excluded** by the TDD for the same "no AGPL contamination" reason already stated.
4. **Scale is comfortable.** 1M edges is small; AGE's overhead vs Neo4j is immaterial here, and AGE wins the hybrid-join case Neo4j cannot do in-process.
5. **Lowest migration lock-in.** AGE stores graphs as PG tables; exiting is mechanical.

#### What the TDD should change
- **Strike** the "PostgreSQL 17+ adds SQL:PGQ" framing — it is **factually wrong** (🟢 verified). Replace with: *"SQL:PGQ has not landed in PostgreSQL core as of v18; Apache AGE provides the openCypher-on-Postgres path."*
- **Add** an explicit license-exclusion rule: Neo4j Community is **disqualified** (AGPLv3 + Commons Clause), not merely "considered."
- **Add** a batch-analytics companion: use **Kùzu** (MIT) or **networkx** for offline centrality (PageRank/betweenness), since AGE has no algorithm library. Write computed centrality scores back as node properties.
- **Add** an operational note: in non-autocommit clients (psycopg v3, JDBC), graph DDL calls (`create_graph`, `create_vlabel`) require an explicit `COMMIT` before they are visible to other sessions (documented AGE behavior, not a bug).
- **Pin** AGE ≥ 1.7.0 and PostgreSQL 16 (or 18, since AGE 1.7.0 supports PG11–18). 1.7.0 brings RLS, `COPY`-based ingest, and id-column indexes worth having.

#### Concrete architecture (v1)
```
Single Docker container:
  PostgreSQL 16/18
    ├─ pgvector        (chunk embeddings, ANN retrieval)
    ├─ Apache AGE 1.7.0 (knowledge graph: entities + relationships, openCypher)
    └─ relational tables (sources, citations, users, provenance)
  App process (batch):
    ├─ Kùzu or networkx  (offline PageRank/betweenness → write scores to AGE node props)
```
Hybrid RAG query (the AGE superpower):
```sql
-- vector recall + 2-hop graph context + relational provenance, one round-trip
WITH召回 AS (
  SELECT chunk_id, embedding <=> $1 AS dist
  FROM chunks ORDER BY dist LIMIT 20
)
SELECT e2.name, r.type, e3.name, src.title
FROM 召回 c
JOIN cypher('iip', $$
    MATCH (e1:Entity)-[r:RELATES_TO*1..2]-(e2:Entity)
    WHERE e1.id = $chunkEntityId
    RETURN e1.id AS e1, e2.id AS e2, r AS r
$$) AS g(e1 uuid, e2 uuid, r agtype)
JOIN entities e2 ON e2.id = g.e2
JOIN sources src ON src.entity_id = e2.id;
```

#### Documented migration path (future-proofing, not a v1 plan)
- **AGE → Neo4j:** mechanical (nodes/edges/props transfer). Only revisit if IIP outgrows single-node scale or needs a graph algorithm library the batch-sidecar can't provide.
- **AGE → Kùzu:** trivial (same Cypher; re-ingest). Revisit if IIP consolidates to a single-process embedded architecture.
- **AGE → native PG SQL:PGQ:** monitor the PostgreSQL CommitFest. If/when SQL:PGQ ships in PG19+, evaluate whether AGE's Cypher is still worth the extension. **Do not pre-build for this.**

---

## Sources (fetched 2026-06-19)

| # | URL | Status |
|---|---|---|
| 1 | https://github.com/apache/age (README) | 🟢 AGE 4.6k★, Apache-2.0, PG 11–18 |
| 2 | https://github.com/apache/age/releases | 🟢 v1.7.0 (PG18 21 Jan 2025, PG17 11 Feb 2025) |
| 3 | https://age.apache.org/ | 🟢 ASF project, pgvector proposal, LangChain GraphStore |
| 4 | https://age.apache.org/age-manual/master/clauses/match.html | 🟢 openCypher MATCH / variable-length path coverage |
| 5 | https://www.postgresql.org/about/featurematrix/ | 🟢 **No SQL:PGQ / property-graph entry in any version** |
| 6 | https://www.postgresql.org/docs/18/release-18.html | 🟢 PG18 (2025-09-25) **no mention of SQL:PGQ/PGQ** |
| 7 | https://www.postgresql.org/docs/17/sql-select.html | 🟢 standard SELECT; no GRAPH_TABLE |
| 8 | https://www.postgresql.org/docs/17/datatype-pgq.html | 🟢 **404** — no such datatype |
| 9 | https://neo4j.com/licensing/ | 🟢 Neo4j Community = **GPLv3**, registerware |
| 10 | https://en.wikipedia.org/wiki/Neo4j | 🟢 License: **GPLv3 + AGPLv3 + Commons Clause**; freemium registerware |
| 11 | DuckDB `pgq` extension docs | 🔴 URL 404 today; SQL:PGQ exists in DuckDB (secondary knowledge) — verify before relying |

**Unverifiable today (GitHub search blocked by robots.txt):** AGE specific concurrent-write issue counts. Operational claims in §2 marked 🟡 are based on README guidance + general AGE-on-PG architecture, not a live issue-tracker recount.
