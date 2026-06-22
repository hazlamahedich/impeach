# IIP Internal-First PRD — Addendum

Companion to `prd.md`. Holds depth that belongs downstream (architecture, UX, solution design) or earned a place but does not fit the PRD's main narrative. **Technology choices live here, not in the PRD body** — the PRD states capabilities and constraints; this addendum states which tools satisfy them and the options considered.

**Authoritative technical source:** the *Technical Design Document v1.0* (`IIP_Technical_Design_Document.docx`). Where this addendum and the TDD disagree on a technical decision, the TDD wins.

---

## §Personas

Persona context is used **inline** in the PRD's User Journeys (§7). Detail collected here for reference.

### P-1 Intake Operator (build team) — *v1 primary operator*
- **Role:** the small internal team that runs the platform during the internal-first period.
- **Motivation:** keep the corpus fresh, extraction clean, and integrity intact; surface and fix failures fast.
- **Failure mode that matters:** a bad extraction silently propagating; a source that was ingested unlawfully; an allegation that slipped through as fact.
- **Success signal:** clean ingestion dashboards; spot-checks pass; zero integrity violations in eval.

### P-2 Investigative Journalist — *future-user, presentation priority 1*
- **Role:** reporter at a Philippine broadsheet or digital outlet.
- **Motivation:** fast, sourced, verifiable answers and evidence trails they can cite in their own work; they will re-check every quote.
- **Failure mode that matters:** a citation that doesn't resolve, or an allegation shown as fact — both destroy trust permanently.
- **Success signal:** they click through to a source passage and it says what the platform claimed it says.

### P-3 Researcher / Academic — *future-user, presentation priority 2*
- **Role:** political science, law, or public administration researcher.
- **Motivation:** navigable structure, timelines, entity relationships for analysis and publication.
- **Success signal:** they can trace a multi-hop relationship and export the provenance.

### P-4 Legal / Civil-Society Analyst — *future-user, presentation priority 3*
- **Role:** advocacy, litigation-support, or public-interest analyst.
- **Motivation:** claim-vs-evidence mapping; framing differences; defensible sourcing.
- **Success signal:** the platform distinguishes what is *alleged* from what is *established* reliably enough to rely on for advocacy.

### P-5 Engaged Citizen — *future-user, secondary*
- **Role:** informed member of the public.
- **Motivation:** plain-language, cited answers.
- **Note:** lower tolerance for nuance, but the **integrity bar does not drop** for this audience.

> Senators and staff are **subjects**, not v1 users. Senator dashboards navigate them as entities.

---

## §Tech decisions (capabilities → chosen implementation)

The PRD states capabilities; this section records the TDD's concrete choices and the options considered. These are **implementation**, governed by the TDD; captured here for PRD-reader convenience.

### Stack posture
- **Constraint (in PRD):** full stack runs on one workstation; fully open-source; local models default; cloud optional. *(NFR-D-1…D-3)*
- **Implementation:** single Docker Compose host; containerized services; node 22 app/worker/web images.

### System of record & access patterns
- **Capability (in PRD):** one system of record combining relational, semantic-similarity, and graph-traversal access; deterministic, rebuildable graph projection. *(FR-2.4, NFR-A-2)*
- **Implementation:** PostgreSQL 16 as the single store — relational tables (system of record) + **pgvector** with HNSW (`vector(1024)`) for semantic search + **Apache AGE** for in-Postgres openCypher graph (a derived projection, rebuildable from relational). ORM/migrations via Drizzle. Extensions: `pg_trgm` (fuzzy name match), `uuid-ossp`.
- **Options considered:** standalone graph DB (**Neo4j Community**) if traversal complexity grows (open: OQ-2); standalone vector DB (rejected — pgvector avoids a second store).

### Extraction & embeddings
- **Capability (in PRD):** versioned, schema-validated extraction; conservative resolution; local by default. *(FR-2.1…2.3, NFR-D-2)*
- **Implementation:** local LLMs via **Ollama** in JSON mode — Qwen2.5-14B-Instruct or Llama-3.1-8B-Instruct; embeddings bge-m3 or nomic-embed-text (1024-dim). Optional pluggable cloud tier per task; model stamped into `extractor_version`.
- **Decision needed:** lock embedding model/dimension before building HNSW (OQ-1) — schema-affecting.

### Orchestration, queue, API, frontend
- **Implementation:** workers on **BullMQ** (Redis); multi-step agents via **LangGraph.js** state machines; agents communicate **only via DB + queue**, never directly. API via **Fastify** (schema-first JSON Schema). Frontend **Next.js 15** (App Router, RSC) + **Cytoscape.js** (large graphs) + **React Flow** (curated sub-views) + Tailwind/shadcn/ui. Monorepo via Turborepo + pnpm.
- **Options considered:** Trigger.dev as alternative to BullMQ (noted in TDD).

### Object store, search, observability
- **Implementation:** **MinIO** (S3-compatible) for immutable raw snapshots (private bucket; off serving path). Optional **Meilisearch** for media full-text/framing (baseline is Postgres FTS). **OpenTelemetry + Prometheus + Grafana** + pino structured logs. Testing: Vitest + Testcontainers + Playwright + custom eval harness.

### API surface (capability summary; full spec in TDD)
The PRD expresses these as capabilities (FR-3.x, FR-4.x). The concrete REST surface (base `/api/v1`, JSON, cursor pagination, `{error:{code,message,details?}}` envelope) lives in the TDD: `POST /query`, `GET /entities`, `GET /entities/:id`, `GET /graph/neighbors/:id`, `GET /timeline`, `GET /evidence/:id`, `GET /senators/:id/dashboard`, `GET /documents/:id`, `GET /health`. **v1 is read-only public; no user write endpoints.**

### Data model (capability summary; full DDL in TDD)
The PRD requires per-artifact provenance, idempotent writers, conservative merging, and deterministic projection (FR-1.5, FR-2.3, NFR-A-3). The concrete tables (`sources`, `ingestion_jobs`, `documents` w/ `content_checksum`, `document_chunks` w/ `embedding`, `entities` w/ `normalized_key`+aliases+confidence, `entity_mentions`, `relationships` w/ temporal `valid_from/valid_to` + `evidence_quote`, `claims`, `evidence`+`claim_evidence`, `contradictions`, `timeline_events`, `staging_extractions`) and idempotency anchors live in the TDD. AGE projection is 1:1 (node label ↔ entity_type, edge label ↔ relationship_type).

---

## §Demo targets

`[ASSUMPTION]` Specific numeric targets for the Sara Duterte seed case. To be confirmed/refined by the operator once ingestion is live; placeholders below.

| Dimension | v1 demo target (indicative) | Hard floor (demo does not proceed below) | Notes |
|---|---|---|---|
| Documents ingested | **≥500** | **≥300** | across gov/court/media/transcript/press sources |
| Tier-1 sources registered | **≥3** | **≥2** | primary/official (House, Senate, SC, Official Gazette) |
| Tier-2 sources registered | **≥3** | **≥2** | established media (Reuters, GMA, ABS-CBN, Rappler, Philstar, PNA) |
| Entities | **≥1,500** | **≥800** | persons, orgs, events, documents, claims, evidence |
| Relationships | **≥3,000** | **≥1,500** | typed (FILED, VOTED_*, SUPPORTED, OPPOSED, TESTIFIED_IN, etc.) |
| Curated "answerable" demo questions | **≥20** | **≥10** | all return cited, correctly-tagged answers |
| Curated "unanswerable" (adversarial) questions | **≥10** | **≥5** | all return "no sourced answer" (SM-7); partly external-authored |
| Languages covered | en (+ fil only if its eval fixture passes the integrity gates) | en | OQ-9 |

*Targets are indicative `[ASSUMPTION]` values aligned with SM-6; the operator confirms actuals once ingestion is live. They exist so "demo-ready" is falsifiable, not vibes. The hard floor is distinct from the indicative target — if the floor isn't met, the demo is delayed, not re-baselined.*

---

## §Deferred scope (Phase 2 / 3) — rationale

Captured so reviewers understand *why* these are out of v1, not merely unmentioned.

- **Narrative explorer / story generation (Phase 2):** high-value but high-risk (generation adjacent to the integrity core); defer until citation-bound generation is proven. Cached, citation-bound generation keyed by query hash is the TDD's planned approach.
- **Media framing comparison (Phase 2):** requires outlet-side-by-side framing analysis; depends on a stable multi-outlet corpus and the (optional) Meilisearch layer.
- **Contradiction detection engine (Phase 3):** active claim-pairing, detection + severity scoring + verification-status propagation. **v1, however, *actively extracts* refuting/contextualizing evidence (D-015) and surfaces the honest support/refute split** with an explicit one-sided empty-state (EI-7, FR-3.4); it just does not pair claims into labeled "contradictions" or score severity.
- **Senator dashboard — full version (Phase 2 per TDD):** v1 ships an **early/lightweight** senator/entity read-model (D-016); the full dashboard remains Phase 2.
- **AI debate simulator / AI witnesses / adversarial-reasoning (Phase 3):** generation-heavy features far from the integrity core; not appropriate for an internal-first credibility pitch.
- **Influence analytics — PageRank/betweenness/centrality (Phase 3):** analytical value-add, not integrity-critical.
- **Real-time sub-minute streaming (Phase 4+):** v1 is scheduled/batch; streaming adds operational complexity inappropriate for single-node v1.
- **Multi-tenant SaaS (billing/orgs/quotas/RBAC/SSO):** v1 is internally operated; no end-user accounts.
- **Predictive features (vote/sentiment forecasting):** out of scope — the platform is investigative/evidentiary, not predictive.

---

## §Options-considered (decisions log supplement)

- **Graph store:** in-Postgres AGE vs standalone Neo4j Community → **AGE for v1** (avoids second store; single-system-of-record invariant); Neo4j held as a Phase-2-gated option (OQ-2).
- **Vector store:** pgvector vs dedicated vector DB → **pgvector** (keeps one store; HNSW adequate at v1 scale).
- **Queue:** BullMQ vs Trigger.dev → **BullMQ** (durable, retryable, Redis-coupled); Trigger.dev noted as alternative.
- **Embeddings:** bge-m3 vs nomic-embed-text → **decision deferred** (OQ-1, schema-affecting); both 1024-dim compatible.
- **LLM tier:** local-default + optional cloud vs cloud-default → **local-default** (NFR-D-2; provenance + cost + sovereignty).
- **Entity merge policy:** aggressive vs conservative → **conservative** (EI-5; duplicates are cosmetic, wrong merges are corrupting).
- **v1 governance:** engineering-only vs human-editorial-owner → **engineering-enforced day-to-day + a mandatory Pre-External Presentation Gate** (human editorial sign-off + cyberlibel-aware legal review) before any external audience (D-014). Standing human editorial owner remains a full-launch gate.
- **Contradiction surfacing in v1:** disclaimer-only vs active refutes extraction → **active refutes/contextualizes extraction with a recall floor + honest split + one-sided empty-state** (D-015).
- **Substring validation scope:** serving-only vs extraction+serving → **both** (drops hallucinated quotes at extraction, counted; re-checked at serving) — aligns with the TDD's `quote_validation_drops_total`.
- **Senator dashboard:** Phase-2-only vs early-v1 → **early/lightweight v1 read-model**, full version Phase 2 (D-016).
