<!-- converted from IIP_Technical_Design_Document.docx -->

TECHNICAL DESIGN DOCUMENT
Impeachment Intelligence Platform
Knowledge-Graph + RAG Investigative Intelligence System




# Table of Contents
# 1. Purpose, Scope & Constraints
Translate the IIP product requirements into an unambiguous engineering design that build agents can implement without further product clarification.
## 1.1 Purpose
The Impeachment Intelligence Platform (IIP) ingests publicly available impeachment-related material - hearing transcripts, court records, official filings, press releases, and media coverage - and turns it into an explainable, evidence-backed knowledge graph queryable in natural language. This document specifies the system's architecture, data contracts, agent behaviours, APIs, and a phased build plan.
## 1.2 In scope
- Continuous ingestion of documents from registered government, court, and media sources.
- Extraction of entities, relationships, claims, and evidence into a canonical store and a traversable graph.
- Hybrid retrieval (graph + vector) with a citation engine that grounds every answer in source documents.
- Timeline, evidence, senator, narrative, and media-comparison read models.
- A multi-agent orchestration layer (Collector, Analyst, Graph Builder, Timeline Builder, Fact Checker, Narrative Builder, Query Planner).
## 1.3 Out of scope (v1)
- Authoring or publishing original political opinion. The system reports and attributes; it does not editorialize.
- Real-time sub-minute streaming ingestion (Phase 4+; v1 ingestion is scheduled/batch).
- Predictive modelling of vote outcomes or sentiment forecasting.
- Multi-tenant SaaS billing, org management, and quota enforcement.
## 1.4 Hard product constraints (treated as engineering invariants)
- Citation-or-silence: any factual assertion returned to a user MUST carry at least one document-backed citation, or it is not returned. There is no "uncited answer" code path.
- Provenance everywhere: every entity, relationship, claim, and evidence row is traceable to the document and character span it was extracted from.
- Neutral framing: the system distinguishes documented facts from attributed claims. Verbs matter - "alleged", "testified", "voted" are preserved verbatim from sources, never paraphrased into assertions of fact.
- Reproducibility: extraction is versioned; re-running an extractor version over the same input yields the same rows (idempotent upserts keyed by content + extractor version).
- FOSS + local-first: the entire stack runs on a single workstation via Docker Compose with no proprietary cloud dependency. Cloud LLMs are an optional, pluggable tier, never required.

# 2. System Overview
## 2.1 Logical components

## 2.2 Reference data flow
Figure 2.1 - End-to-end data flow. Each arrow is an idempotent, retryable step.
## 2.3 Deployment topology (v1, single node)
All services run as containers on one host. Horizontal scale is achieved later by moving workers and Postgres to separate hosts; the design assumes this but does not require it for v1.

# 3. Technology Stack & Rationale
Choices are locked to keep agents from re-litigating them. Each row lists the decision and the single most important reason. Alternatives are noted only where a swap is realistically expected.


# 4. Repository & Module Structure
A single Turborepo. apps/* are deployables; packages/* are shared libraries consumed by apps. Build agents add code only within these boundaries; cross-app imports go through packages/*, never app-to-app.
Figure 4.1 - Workspace layout. The contracts package is the inter-module API.

# 5. Data Layer Design (PostgreSQL)
One PostgreSQL instance hosts relational tables, pgvector embeddings, and the Apache AGE property graph. The relational tables are the system of record; the AGE graph and Meilisearch indexes are derived projections that can be rebuilt from relational data at any time.
## 5.1 Extensions & bootstrap

## 5.2 Core relational schema
DDL below is the canonical schema. Drizzle definitions in packages/db must match it exactly; drizzle-kit generates the migration. Conventions: UUID v4 PKs, TIMESTAMPTZ in UTC, NUMERIC(4,3) confidences in [0,1], soft enums via CHECK constraints kept in sync with packages/contracts.
### 5.2.1 sources & ingestion_jobs

### 5.2.2 documents & chunks

### 5.2.3 entities, mentions, relationships

### 5.2.4 claims, evidence, contradictions

### 5.2.5 timeline_events & staging


# 6. Domain Model & Property Graph
## 6.1 Node and edge types
The AGE graph is a projection of canonical entities and relationships. Node labels map 1:1 to entity_type (uppercased); edge labels map to relationship_type. Each node carries its relational id so the graph and tables stay joinable.

## 6.2 Projection contract
Graph Builder is the only writer to AGE. It never invents data: it mirrors rows that already exist in entities/relationships. A full rebuild (drop graph, replay from relational) must reproduce an identical graph - this is the projection-determinism test.

## 6.3 Representative traversal queries
These back specific product features and are the acceptance fixtures for the graph layer.

# 7. Ingestion Pipeline (Collector)
Ingestion turns a registered source into deduplicated, snapshotted document rows. It is split into discover and fetch jobs so discovery can run cheaply and often while fetch does the heavier crawl.
## 7.1 Stages
- Discover: per source.crawl_strategy (rss/sitemap/list_page/api), enumerate candidate URLs. Emit one fetch job per new URL not already present by URL or prior checksum.
- Fetch: call self-hosted Firecrawl to retrieve + clean to markdown. Store the raw response in MinIO under raw/{source}/{yyyymmdd}/{sha}.html|pdf and record raw_object_key.
- Normalize: strip boilerplate, collapse whitespace, detect language (en/fil), compute content_checksum = sha256 over normalized content.
- Dedupe gate: INSERT ... ON CONFLICT (content_checksum) DO NOTHING. If the row already exists, mark job 'skipped' and stop. This is the single ingestion idempotency point.
- Handoff: on insert, set extraction_status='pending' and enqueue an embed+extract job for the new document_id.
## 7.2 Politeness, robots, and provenance
- Respect robots.txt when sources.robots_respect is true; honour crawl-delay; cap per-source concurrency via a dedicated BullMQ queue.
- Never bypass paywalls, logins, or anti-bot challenges. A blocked fetch fails the job with a typed error; it is never "worked around".
- Persist the raw snapshot before cleaning so every downstream row can be re-derived and audited against exactly what was retrieved.
- Store source URL and retrieved_at on the document so citations can link back to the original.

## 7.3 Collector interface contract


# 8. Extraction Pipeline (Analyst)
The Analyst converts a document into chunks, embeddings, and a single validated ExtractionResult per chunk. Extraction is LLM-driven but never trusted blind: the model must return JSON conforming to a zod schema, every claim/relationship must carry a verbatim source span, and anything failing validation is rejected and retried, not patched.
## 8.1 Chunking & embedding
- Chunk on semantic boundaries (headings, paragraphs) targeting ~512 tokens with ~64-token overlap; record char_start/char_end into documents.content for provenance.
- Embed each chunk with the configured embedding model; store vector + embed_model. Re-embedding with a new model writes new rows tagged with the new model, never overwrites silently.
- Build the HNSW index after the initial bulk load; thereafter inserts maintain it incrementally.
## 8.2 Extraction output contract
This zod schema in packages/contracts is the extraction contract. The LLM is prompted to emit exactly this shape in JSON mode; the worker parses and validates before anything is written to staging_extractions.

## 8.3 Prompt construction rules
- System prompt fixes the role: a neutral extraction engine that records what the text says, never what is true. Distinguish reported claims from established facts.
- Inject the chunk plus its document metadata (source, date) and demand JSON only - no prose, no markdown fences.
- Forbid fabrication explicitly: if a field is unknown, omit it; if no items of a type exist, return an empty array. Every relation and claim MUST quote a span that literally appears in the chunk.
- Validate every evidenceQuote / sourceQuote against the chunk text (substring check). Quotes that are not literal substrings invalidate the item and trigger one retry; persistent failure drops the item and logs it.

## 8.4 Analyst job contract


# 9. Graph Construction & Entity Resolution
Graph Builder promotes staged extractions into canonical entities and relationships, then projects them into AGE. The hard problem is entity resolution: 'VP Sara Duterte', 'Vice President Duterte', and 'Sara Z. Duterte' must collapse to one node without merging genuinely different people.
## 9.1 Resolution algorithm
- Normalize: lowercase, strip diacritics, remove honorifics/roles (Sen., VP, Atty.), squeeze whitespace -> normalized_key.
- Exact match: look up entities by (entity_type, normalized_key). Hit -> reuse; record the surface form as an alias if new.
- Fuzzy candidate: on miss, use pg_trgm similarity over canonical_name within the same type, threshold >= 0.45, to find candidates.
- Disambiguation: for ambiguous candidates, ask the LLM router (cheap tier) a yes/no 'same real-world entity?' with both contexts; only merge on a confident yes.
- Create or merge: upsert via ON CONFLICT on the dedupe anchor; merging folds aliases, sums mention_count, and keeps the higher-trust metadata.

## 9.2 Relationship promotion
- Map ExtractedRelation.sourceName/targetName to resolved entity ids; if either side fails to resolve confidently, hold the relation in staging rather than guessing.
- Upsert into relationships on (source,target,type,document); keep the highest-confidence evidence_quote.
- Project the edge into AGE only after both endpoint nodes exist.
## 9.3 Graph Builder contract


# 10. Retrieval, Answering & Citation Engine
The serving path answers natural-language questions by combining graph traversal and vector search, aggregating evidence, and generating an answer that is constrained to the retrieved context. The citation engine is what enforces the citation-or-silence invariant from Section 1.
## 10.1 Query pipeline
- Intent detection: classify the question into {factual_lookup, list_entities, evidence_for_claim, timeline, comparison, narrative}. Drives which retrievers run.
- Plan retrieval: the Query Planner selects graph queries (for relational/who-voted questions) and/or vector search (for open semantic questions), and the k for each.
- Graph search: run parameterized Cypher templates (Section 6.3) bound to entities resolved from the question.
- Vector search: embed the question, retrieve top-k chunks by cosine distance, optionally rerank.
- Evidence aggregation: merge graph rows and chunks into a candidate evidence set, each item carrying its document_id, span, source, and date.
- Citation gate: drop any candidate without a resolvable source span. If the surviving set is empty, return the explicit no-evidence response - never free-generate.
- Answer generation: prompt the LLM with ONLY the cited evidence and instruct it to answer solely from that context, attaching citation markers to each sentence.
- Post-validation: verify every citation marker maps to a real evidence item and that no sentence asserts a fact lacking a marker; strip or regenerate offending sentences.
## 10.2 Answer contract


## 10.3 Fact vs attributed claim
Every returned sentence is tagged. A row from a vote record is a fact ('Senator X voted against'). A statement from a press release is an attributed claim ('Senator X said the charges were politically motivated'). The UI renders these differently and the generation prompt must preserve the distinction using the verbs in the source quotes.
# 11. Agent System & Orchestration
The seven PRD agents are implemented as BullMQ-backed workers; multi-step agents use LangGraph.js state machines internally. Agents communicate only through the database and the queue - never by calling each other directly - which keeps each step independently retryable and observable.
## 11.1 Agent responsibilities & contracts

## 11.2 Orchestration & state
- Each pipeline stage enqueues the next on success: Collector -> Analyst -> Graph Builder -> Timeline/Fact-Checker. The chain is data-driven via document.extraction_status transitions.
- Queues are per-agent with independent concurrency limits so a slow LLM step cannot starve ingestion.
- Every job is idempotent and retryable with capped exponential backoff; after max attempts it lands in a dead-letter queue with the typed error and the document/chunk id for replay.
- LangGraph state for multi-step agents is persisted per run so a crash resumes from the last completed node rather than restarting.
## 11.3 Failure taxonomy
# 12. API Specification
The Fastify API is the only public surface. All endpoints validate request and response against shared zod/JSON schemas. Every list endpoint is paginated; every error uses the common envelope. Read endpoints are cacheable; the system has no write endpoints exposed to end users in v1 (ingestion is internal).
## 12.1 Conventions
- Base path /api/v1. JSON only. UTC ISO-8601 timestamps. UUIDs for all ids.
- Pagination: cursor-based via ?cursor= & ?limit= (max 100); responses include nextCursor.
- Error envelope: { error: { code, message, details? } } with appropriate HTTP status.
- Rate limiting per IP on /query; 429 with Retry-After when exceeded.

## 12.2 Endpoints

## 12.3 POST /query example


# 13. Cross-Cutting Concerns
## 13.1 Configuration & secrets
- All runtime config loads through packages/config and is validated by a zod schema at boot; the process refuses to start on invalid config.
- Secrets (Postgres, MinIO, optional cloud LLM keys) come from environment only, never committed. .env.example documents every key.
- Model ids, k values, thresholds, and concurrency limits are config, not literals in code, so they can change without redeploys to source.

## 13.2 Observability
- OpenTelemetry traces span the whole pipeline; a document carries a trace id from fetch through to the answer that cites it.
- Prometheus metrics: documents_ingested_total, extraction_failures_total, quote_validation_drops_total, query_latency_seconds, no_evidence_ratio, entity_merge_total.
- Structured pino logs with the document_id/job_id on every line; no PII beyond what is already public in sources.
- Grafana dashboards: ingestion throughput, extraction quality, query latency, and the no-evidence ratio (a quality signal, not just an error rate).
## 13.3 LLM router
- A single packages/llm entry point exposes complete(task, prompt, schema). It selects a model by task tier from config and enforces JSON mode + zod parsing.
- Default tier is local Ollama. Cloud tier is used only when LLM_CLOUD_ENABLED and a task explicitly requests it; the chosen model is stamped into extractor_version for provenance.
- All prompts are versioned templates in packages/llm/prompts; changing a prompt bumps the extractor/detector version so outputs remain reproducible and attributable.
## 13.4 Security & abuse
- Read-only public API in v1; no user write paths reduces injection surface. Inputs are still validated and parameterized (no string-built SQL/Cypher).
- Cypher and SQL are always parameterized; entity ids from user input are validated as UUIDs before binding.
- Rate limits and payload caps on /query prevent prompt-flood abuse; oversized questions are rejected with 422.
- The raw object store is private; only derived, public-sourced content is served.
# 14. Frontend Architecture
The Next.js App Router app renders the read models. Heavy, data-dense pages (graph, timeline) use server components for the initial payload and client components for interaction. The client never talks to Postgres directly - only to the /api/v1 surface.
## 14.1 Routes

## 14.2 Key UI rules
- Every factual statement in the chat UI renders an inline citation chip linking to the source document; sentences tagged attributed_claim are visually marked as claims, not facts.
- The no-evidence response renders an explicit empty state ('No sourced answer found'), never a blank or a spinner that hangs.
- Graph explorer lazy-expands: it requests neighbors on node click and caps rendered nodes for performance; large neighborhoods paginate.
- Media-comparison view places outlets side by side and highlights differing framing of the same underlying event, with each framing linked to its source.
## 14.3 Performance
- Server-render initial timeline/dashboard payloads; stream graph data after first paint.
- Cache GET responses at the edge with short TTLs; /query is not cached except for identical recent questions keyed by normalized text.
- Cytoscape uses a web worker layout for graphs beyond a few hundred nodes.
# 15. Testing & Evaluation Strategy
Because the product makes evidence-backed claims about real people, correctness has two halves: software correctness (does the code do what the contract says) and extraction/answer quality (are the claims accurate and properly cited). Both are gated in CI.
## 15.1 Test pyramid

## 15.2 Quality gates (CI-enforced thresholds)


## 15.3 Eval harness
- A versioned gold set: hand-labelled chunks (entities/relations/claims) and a question->expected-citations set, stored in repo under eval/.
- Run per PR that touches extraction, resolution, retrieval, or prompts; emit a scorecard artifact and compare against the baseline.
- Groundedness uses an LLM-judge with a strict rubric plus a rotating human spot-check; never the same model that generated the answer.
# 16. Deployment & Infrastructure
v1 ships as a single docker-compose stack runnable on one workstation, matching the local-first FOSS posture. The same images later split across hosts: Postgres on its own node, a pool of worker replicas, and the API/web behind a reverse proxy.
## 16.1 Compose services & responsibilities

## 16.2 Bootstrap order
- Start postgres, redis, minio, ollama; run DB migrations (drizzle-kit) and the AGE bootstrap SQL.
- Pull Ollama models; create the MinIO bucket; seed the sources registry.
- Start api, worker, web; verify /api/v1/health reports all deps green.
- Enqueue an initial discover job per enabled source to begin ingestion.
## 16.3 Backup & rebuild
- Postgres is the only stateful system of record to back up; the AGE graph and Meilisearch indexes are rebuildable projections.
- MinIO snapshots are append-only and back the audit/replay story; back them up but they are not on the serving path.
- A documented 'rebuild from scratch' script replays relational data into AGE and re-indexes search - this doubles as the projection-determinism test.
# 17. Non-Functional Requirements, Risks & Open Questions
## 17.1 Non-functional targets

## 17.2 Key risks & mitigations

## 17.3 Open questions for human decision
- Embedding dimension/model: bge-m3 (1024) vs nomic-embed-text - lock one before building the HNSW index (schema-affecting).
- Graph store: stay on Apache AGE or adopt Neo4j Community if traversal complexity grows? Decide before Phase 2 graph features.
- Retention: how long to keep raw snapshots and superseded extractor versions? Affects MinIO sizing.
- Human-in-the-loop: should high-severity contradictions require human review before surfacing? Recommended yes for launch.
# 18. Phased Implementation Backlog (Agent-Executable)
Each task is sized for one agent work-unit, lists its dependencies by task id, names the contract/section it implements, and states how completion is verified. Implement in dependency order; a task is 'done' only when its acceptance check passes in CI.

## 18.1 Phase 0 - Foundation

## 18.2 Phase 1 - Ingest to Answer (MVP slice)

## 18.3 Phase 2 - Derivation & dashboards

## 18.4 Phase 3 - Verification & analytics


# Appendix A - Glossary

## Appendix B - Traceability to PRD

End of Technical Design Document - IIP v1.0
| Field | Value |
| --- | --- |
| Document type | Technical Design Document (TDD) |
| Source artifact | Enterprise PRD - Impeachment Intelligence Platform (IIP) |
| Primary audience | Autonomous AI build agents + human reviewers |
| Status | Draft v1.0 - ready for implementation |
| Stack posture | Local-first, fully FOSS, single-node deployable |
| Date | 2026-06-16 |
| How AI agents should read this document
Every component section is self-contained and ends with explicit interface contracts and acceptance criteria. Implement strictly against the contracts (schemas, types, API envelopes) - they are the source of truth. Where this document and the PRD disagree, this TDD wins for technical decisions; the PRD wins for product intent. Section 18 is the dependency-ordered task backlog: pick tasks whose dependencies are met, implement to the referenced contract, and verify against the stated acceptance criteria before marking complete. |
| --- |
| Editorial-safety invariant (do not optimize away)
This platform handles real, named public figures and contested allegations. The fact/claim distinction and the citation-or-silence rule are not "nice to have" - they are correctness requirements. An answer that states an unproven allegation as fact is a P0 defect, identical in severity to a crash. Agents must never relax these to make a feature pass. |
| --- |
| Plane | Component | Responsibility |
| --- | --- | --- |
| Ingestion | Collector workers | Discover URLs, fetch via Firecrawl, snapshot raw to object store, dedupe by checksum. |
| Processing | Analyst workers | Chunk, embed, extract entities/relationships/claims/evidence as validated JSON. |
| Graph | Graph Builder workers | Resolve/merge canonical entities; project nodes & edges into Apache AGE. |
| Derivation | Timeline / Narrative / Fact-Checker workers | Build read models: timelines, narratives, contradictions. |
| Serving | Query API (Fastify) | Intent detection, hybrid retrieval, citation assembly, answer generation. |
| Experience | Next.js web app | Graph explorer, timeline, evidence, chat, senator dashboards. |
| Platform | Postgres / Redis / MinIO / Ollama | Storage, queue, object store, local inference. |
| Registered Source
   |
   v
[Collector]  --discover--> candidate URLs --fetch(Firecrawl)--> raw HTML/PDF
   |                                                      |
   |  snapshot raw object -> MinIO                        v
   |                                            clean text/markdown
   v
documents (Postgres)  -- checksum dedupe gate --
   |
   v
[Analyst]  --chunk--> document_chunks --embed(Ollama)--> pgvector
   |        --extract--> {entities, relations, claims, evidence} (JSON, zod-validated)
   v
staging_extractions (Postgres, append-only, versioned)
   |
   v
[Graph Builder] --resolve+merge--> entities / relationships (canonical)
   |             --project--> Apache AGE graph (nodes + edges)
   v
[Timeline | Narrative | Fact-Checker] --derive--> read models
   |
   v
[Query API] : intent -> (graph search + vector search) -> evidence aggregation
             -> citation engine -> grounded answer
   |
   v
Next.js client |
| --- |
| docker compose services:
  postgres      (pgvector + Apache AGE + pg_trgm)
  redis         (BullMQ broker + cache)
  minio         (raw document snapshots, S3 API)
  ollama        (local LLM + embeddings)
  firecrawl     (self-hosted crawler/cleaner)
  api           (Fastify query/serving API)
  worker        (BullMQ consumers: all agent runtimes)
  web           (Next.js)
  meilisearch   (optional: media full-text + framing search)
  otel-collector + prometheus + grafana (observability) |
| --- |
| Concern | Choice | Why / Alternative |
| --- | --- | --- |
| Monorepo | Turborepo + pnpm workspaces | Shared types across api/worker/web; fast incremental builds. |
| Language | TypeScript (strict) | One language across all planes; shared zod schemas as contracts. |
| API runtime | Fastify | Low overhead, schema-first (JSON Schema) request/response validation. |
| Worker / queue | BullMQ on Redis | Durable, retryable jobs; per-queue concurrency; FOSS. (Alt: Trigger.dev if hosted.) |
| Agent orchestration | LangGraph.js | Explicit stateful graphs for multi-step agents; deterministic transitions. |
| Relational store | PostgreSQL 16 | Single store for relational + vector + graph. |
| Vector search | pgvector (HNSW) | Co-located with relational data; no separate vector DB to operate. |
| Graph store | Apache AGE (openCypher in PG) | Graph traversal without a second database. (Alt: Neo4j Community.) |
| ORM / migrations | Drizzle ORM + drizzle-kit | Typed schema = source of truth; SQL-first migrations. |
| Crawler | Firecrawl (self-hosted) | PRD-specified; HTML+PDF to clean markdown, robots-aware. |
| Local inference | Ollama | Local extraction + embeddings; zero external dependency. |
| LLM router | Custom thin router | Route by task tier; local default, optional cloud fallback. |
| Object store | MinIO | S3-compatible raw snapshots for provenance/replay. |
| Full-text (opt) | Meilisearch | Fast media search + framing comparison; PG FTS is the baseline. |
| Frontend | Next.js 15 (App Router) | SSR read models; React Server Components for heavy pages. |
| Graph UI | Cytoscape.js (+ React Flow) | Cytoscape for large graphs; React Flow for curated sub-views. |
| UI kit | Tailwind + shadcn/ui | Composable, themeable, no vendor lock-in. |
| Observability | OpenTelemetry + Prometheus + Grafana | Traces across ingestion->serving; pino structured logs. |
| Model selection (default profile)
Extraction/reasoning: a local instruct model (e.g. Qwen2.5-14B-Instruct or Llama-3.1-8B-Instruct) via Ollama with JSON-mode + zod validation. Embeddings: bge-m3 or nomic-embed-text (1024-dim). Model IDs are config, not code - see Section 13.3. All extraction prompts must work on a local 8-14B model; if a step needs a frontier model, it routes to the optional cloud tier explicitly and records that on the row's extractor_version. |
| --- |
| iip/
  apps/
    api/                 Fastify serving API (query, entity, timeline, evidence, graph)
    worker/              BullMQ consumers + LangGraph agent runtimes
    web/                 Next.js client
  packages/
    db/                  Drizzle schema, migrations, typed query helpers
    contracts/           zod schemas + TS types shared by api/worker/web
    graph/               Apache AGE client + Cypher builders + projection logic
    llm/                 LLM router, prompt templates, JSON-mode + zod parse
    ingest/             Firecrawl client, source registry, checksum/dedupe
    rag/                 retrieval planner, hybrid search, citation engine
    observability/       OTel setup, logger, metrics helpers
    config/              env loading + zod-validated runtime config
  infra/
    docker-compose.yml
    grafana/ prometheus/ otel/
  turbo.json  pnpm-workspace.yaml  tsconfig.base.json |
| --- |
| Contract-first rule for agents
Before implementing any feature that crosses a module boundary, define or update the zod schema in packages/contracts FIRST, then implement producers and consumers against it. Never duplicate a shape inline. A type that exists in two files is a defect. |
| --- |
| CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector
CREATE EXTENSION IF NOT EXISTS age;         -- Apache AGE graph
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy name matching
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- or pgcrypto for gen_random_uuid
 
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT create_graph('iip_graph');           -- AGE named graph |
| --- |
| CREATE TABLE sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,            -- 'Rappler', 'Senate of the Philippines'
  source_type   TEXT NOT NULL CHECK (source_type IN
                ('government','court','media','press_release','transcript','other')),
  base_url      TEXT,
  crawl_strategy TEXT NOT NULL CHECK (crawl_strategy IN
                ('rss','sitemap','list_page','api','manual')),
  config        JSONB NOT NULL DEFAULT '{}',     -- selectors, rss url, pagination
  trust_tier    SMALLINT NOT NULL DEFAULT 2,     -- 1 primary/official .. 3 aggregator
  robots_respect BOOLEAN NOT NULL DEFAULT true,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  last_crawled_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
 
CREATE TABLE ingestion_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID REFERENCES sources(id) ON DELETE SET NULL,
  job_type    TEXT NOT NULL CHECK (job_type IN
              ('discover','fetch','extract','embed','graph','derive')),
  status      TEXT NOT NULL DEFAULT 'queued' CHECK (status IN
              ('queued','running','succeeded','failed','partial','skipped')),
  idempotency_key TEXT UNIQUE,                   -- dedupe re-enqueues
  payload     JSONB NOT NULL DEFAULT '{}',
  stats       JSONB NOT NULL DEFAULT '{}',       -- counts, durations
  error       TEXT,
  attempts    SMALLINT NOT NULL DEFAULT 0,
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_status ON ingestion_jobs(status, job_type); |
| --- |
| CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     UUID REFERENCES sources(id) ON DELETE SET NULL,
  source_name   TEXT NOT NULL,
  source_type   TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT,
  publish_date  TIMESTAMPTZ,
  retrieved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  language      TEXT NOT NULL DEFAULT 'en',       -- 'en' | 'fil'
  raw_object_key TEXT,                            -- MinIO key of raw snapshot
  content       TEXT NOT NULL,                    -- cleaned markdown
  content_checksum TEXT NOT NULL,                 -- sha256(normalized content)
  word_count    INTEGER,
  ingestion_job_id UUID REFERENCES ingestion_jobs(id) ON DELETE SET NULL,
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN
                ('pending','embedded','extracted','graphed','failed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_documents_checksum UNIQUE (content_checksum)   -- idempotency gate
);
CREATE INDEX idx_documents_publish ON documents(publish_date DESC);
CREATE INDEX idx_documents_status  ON documents(extraction_status);
 
CREATE TABLE document_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  char_start   INTEGER NOT NULL,                  -- offset into documents.content
  char_end     INTEGER NOT NULL,
  token_count  INTEGER,
  section_path TEXT,                              -- e.g. 'III.B' heading trail
  embedding    vector(1024),                      -- bge-m3 / nomic-embed
  embed_model  TEXT,                              -- provenance of the vector
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_chunk UNIQUE (document_id, chunk_index)
);
-- ANN index; build after bulk load for speed
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_chunks_fts ON document_chunks
  USING gin (to_tsvector('simple', content)); |
| --- |
| CREATE TABLE entities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL CHECK (entity_type IN
                ('person','organization','event','document_ref',
                 'claim','evidence','location')),
  canonical_name TEXT NOT NULL,
  normalized_key TEXT NOT NULL,        -- lower, unaccented, role-stripped
  aliases       TEXT[] NOT NULL DEFAULT '{}',
  metadata      JSONB NOT NULL DEFAULT '{}',  -- role, chamber, party, dates...
  mention_count INTEGER NOT NULL DEFAULT 0,
  confidence    NUMERIC(4,3) NOT NULL DEFAULT 0.800,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_entity_key UNIQUE (entity_type, normalized_key)  -- dedupe anchor
);
CREATE INDEX idx_entities_trgm ON entities USING gin (canonical_name gin_trgm_ops);
 
CREATE TABLE entity_mentions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id     UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  surface_text TEXT NOT NULL,         -- as written in source
  char_start   INTEGER, char_end INTEGER,
  confidence   NUMERIC(4,3),
  extractor_version TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mentions_entity ON entity_mentions(entity_id);
CREATE INDEX idx_mentions_doc    ON entity_mentions(document_id);
 
CREATE TABLE relationships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN
     ('FILED','VOTED_FOR','VOTED_AGAINST','SUPPORTED','OPPOSED','TESTIFIED_IN',
      'PARTICIPATED_IN','REFERENCED','RESULTED_IN','SUPPORTED_BY','REFUTED_BY')),
  document_id   UUID REFERENCES documents(id) ON DELETE SET NULL,
  chunk_id      UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  evidence_quote TEXT,                  -- verbatim span supporting the edge
  valid_from    DATE, valid_to DATE,    -- temporal validity (bi-temporal-lite)
  confidence    NUMERIC(4,3) NOT NULL DEFAULT 0.700,
  extractor_version TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_relationship UNIQUE
    (source_entity_id, target_entity_id, relationship_type, document_id)
);
CREATE INDEX idx_rel_source ON relationships(source_entity_id);
CREATE INDEX idx_rel_target ON relationships(target_entity_id); |
| --- |
| CREATE TABLE claims (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_text    TEXT NOT NULL,
  claim_type    TEXT NOT NULL CHECK (claim_type IN
                ('allegation','counterclaim','denial','factual_assertion')),
  subject_entity_id   UUID REFERENCES entities(id) ON DELETE SET NULL,
  asserted_by_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  document_id   UUID REFERENCES documents(id) ON DELETE SET NULL,
  chunk_id      UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  source_quote  TEXT NOT NULL,        -- verbatim; preserves 'alleged' etc.
  stance        TEXT CHECK (stance IN ('pro_impeach','anti_impeach','neutral')),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK
                (verification_status IN ('unverified','supported','refuted','contested')),
  confidence    NUMERIC(4,3) NOT NULL DEFAULT 0.700,
  extractor_version TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
 
CREATE TABLE evidence (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN
                ('report','testimony','financial_record','document','statement')),
  description   TEXT NOT NULL,
  document_id   UUID REFERENCES documents(id) ON DELETE SET NULL,
  source_quote  TEXT,
  source_reliability NUMERIC(4,3),     -- derived from sources.trust_tier
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
 
CREATE TABLE claim_evidence (
  claim_id    UUID REFERENCES claims(id) ON DELETE CASCADE,
  evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE,
  relation    TEXT NOT NULL CHECK (relation IN
              ('supports','refutes','contextualizes')),
  confidence  NUMERIC(4,3) NOT NULL DEFAULT 0.700,
  PRIMARY KEY (claim_id, evidence_id, relation)
);
 
-- Detected contradictions between two claims / sources
CREATE TABLE contradictions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_a_id   UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  claim_b_id   UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  rationale    TEXT NOT NULL,
  severity     TEXT NOT NULL CHECK (severity IN ('low','medium','high')),
  detector_version TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_contradiction UNIQUE (claim_a_id, claim_b_id)
); |
| --- |
| CREATE TABLE timeline_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  event_date   DATE NOT NULL,
  date_precision TEXT NOT NULL DEFAULT 'day' CHECK
               (date_precision IN ('day','month','year','approx')),
  summary      TEXT,
  document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
  participants UUID[] NOT NULL DEFAULT '{}',   -- entity ids
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_timeline_date ON timeline_events(event_date);
 
-- Append-only landing zone for raw LLM extractions, before resolution.
CREATE TABLE staging_extractions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id      UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
  extractor_version TEXT NOT NULL,
  payload       JSONB NOT NULL,        -- validated ExtractionResult JSON
  processed     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_staging UNIQUE (chunk_id, extractor_version)  -- idempotent re-extract
); |
| --- |
| Idempotency anchors (memorize these)
documents.content_checksum gates re-ingestion; staging_extractions(chunk_id, extractor_version) gates re-extraction; entities(entity_type, normalized_key) is the entity dedupe anchor; relationships uq covers (src,tgt,type,document). Every writer MUST use ON CONFLICT ... DO UPDATE against these, never blind INSERT. This is what makes the whole pipeline safely re-runnable. |
| --- |
| Graph element | Label | Key properties |
| --- | --- | --- |
| Node | PERSON | id, name, role, chamber, party, mention_count |
| Node | ORGANIZATION | id, name, org_type (Senate/House/OVP/agency) |
| Node | EVENT | id, title, event_date, event_type |
| Node | DOCUMENT_REF | id, title, source_name, publish_date |
| Node | CLAIM | id, claim_type, stance, verification_status |
| Node | EVIDENCE | id, evidence_type, source_reliability |
| Edge | VOTED_FOR / VOTED_AGAINST | confidence, document_id, valid_from |
| Edge | FILED / TESTIFIED_IN / PARTICIPATED_IN | confidence, document_id |
| Edge | SUPPORTED_BY / REFUTED_BY | confidence, evidence_quote |
| // Upsert a node (idempotent on id)
SELECT * FROM cypher('iip_graph', $$
  MERGE (n:PERSON {id: $id})
  SET n.name = $name, n.role = $role, n.mention_count = $mc
  RETURN n
$$) AS (n agtype);
 
// Upsert an edge between two known nodes
SELECT * FROM cypher('iip_graph', $$
  MATCH (a {id: $src}), (b {id: $tgt})
  MERGE (a)-[r:VOTED_AGAINST {document_id: $doc}]->(b)
  SET r.confidence = $conf, r.valid_from = $from
  RETURN r
$$) AS (r agtype); |
| --- |
| -- Which senators voted against, with the document that proves it
MATCH (s:PERSON {role:'senator'})-[r:VOTED_AGAINST]->(e:EVENT {event_type:'impeachment_vote'})
RETURN s.name, r.confidence, r.document_id;
 
-- Multi-hop: evidence chain behind a claim (depth <= 3)
MATCH path = (c:CLAIM {id:$claimId})-[:SUPPORTED_BY|REFUTED_BY*1..3]->(x)
RETURN path;
 
-- Neighborhood for graph explorer expand (1 hop, capped)
MATCH (n {id:$id})-[r]-(m) RETURN n,r,m LIMIT 100; |
| --- |
| Legal/ethical ingestion boundary
Only public, lawfully accessible material is ingested. The Collector must not enter credentials, solve CAPTCHAs, or scrape sources whose terms forbid it. If a source requires any of these, it is disabled in the registry, not automated around. |
| --- |
| // packages/contracts/ingest.ts
export const FetchJob = z.object({
  sourceId: z.string().uuid(),
  url: z.string().url(),
  jobId: z.string().uuid(),
});
export type FetchJob = z.infer<typeof FetchJob>;
 
export const FetchResult = z.object({
  documentId: z.string().uuid().nullable(), // null when deduped/skipped
  status: z.enum(['ingested','skipped','failed']),
  checksum: z.string(),
  rawObjectKey: z.string().nullable(),
  wordCount: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
}); |
| --- |
| Acceptance criteria - Collector
(1) Re-running discover+fetch over an unchanged source inserts zero new documents. (2) A byte-identical article from two URLs produces one document row. (3) Every ingested document has a retrievable MinIO raw snapshot whose sha matches raw_object_key. (4) A blocked/forbidden fetch yields status='failed' with a typed error and never a partial row. |
| --- |
| // packages/contracts/extraction.ts
export const ExtractedEntity = z.object({
  type: z.enum(['person','organization','event','document_ref',
                'claim','evidence','location']),
  name: z.string().min(1),
  surfaceText: z.string().min(1),     // exactly as written in the chunk
  charStart: z.number().int(), charEnd: z.number().int(),
  attributes: z.record(z.string()).default({}),
  confidence: z.number().min(0).max(1),
});
 
export const ExtractedRelation = z.object({
  type: z.enum(['FILED','VOTED_FOR','VOTED_AGAINST','SUPPORTED','OPPOSED',
                'TESTIFIED_IN','PARTICIPATED_IN','REFERENCED','RESULTED_IN',
                'SUPPORTED_BY','REFUTED_BY']),
  sourceName: z.string(), targetName: z.string(),
  evidenceQuote: z.string().min(1),   // verbatim span, REQUIRED
  confidence: z.number().min(0).max(1),
});
 
export const ExtractedClaim = z.object({
  claimText: z.string().min(1),
  claimType: z.enum(['allegation','counterclaim','denial','factual_assertion']),
  subjectName: z.string().optional(),
  assertedByName: z.string().optional(),
  sourceQuote: z.string().min(1),     // preserves 'alleged','testified',...
  stance: z.enum(['pro_impeach','anti_impeach','neutral']).optional(),
  confidence: z.number().min(0).max(1),
});
 
export const ExtractionResult = z.object({
  entities: z.array(ExtractedEntity),
  relations: z.array(ExtractedRelation),
  claims: z.array(ExtractedClaim),
  extractorVersion: z.string(),       // e.g. 'analyst@2025-06-01:qwen2.5-14b'
}); |
| --- |
| No-hallucination enforcement is mechanical, not vibes
The substring check on every quote is the anti-hallucination backstop. If the model 'remembers' a fact not in the chunk, its quote won't be found and the item is discarded. Agents must keep this check; disabling it to raise recall is forbidden. |
| --- |
| export const ExtractJob = z.object({
  documentId: z.string().uuid(),
  reExtract: z.boolean().default(false),  // force re-run a new extractor version
});
 
export const ExtractJobResult = z.object({
  documentId: z.string().uuid(),
  chunks: z.number().int().nonnegative(),
  entities: z.number().int().nonnegative(),
  relations: z.number().int().nonnegative(),
  claims: z.number().int().nonnegative(),
  droppedForUnverifiedQuote: z.number().int().nonnegative(),
  extractorVersion: z.string(),
}); |
| --- |
| Acceptance criteria - Analyst
(1) For a fixture chunk, output validates against ExtractionResult or the job fails loudly. (2) Every persisted relation/claim has a sourceQuote that is a verbatim substring of its chunk. (3) Re-running the same extractor version over a document writes zero new staging rows (idempotent on chunk_id+version). (4) An eval set of N hand-labelled chunks meets the precision/recall thresholds in Section 16. |
| --- |
| Conservative-merge bias
When uncertain, DO NOT merge. A duplicated node is a cosmetic defect fixable later; an incorrect merge fuses two real people's records and corrupts every downstream answer. Resolution defaults to 'create new' below the confidence bar. |
| --- |
| export const GraphBuildJob = z.object({
  documentId: z.string().uuid(),
});
export const GraphBuildResult = z.object({
  entitiesCreated: z.number().int(),
  entitiesMerged: z.number().int(),
  relationshipsUpserted: z.number().int(),
  nodesProjected: z.number().int(),
  edgesProjected: z.number().int(),
  heldForUnresolved: z.number().int(),
}); |
| --- |
| Acceptance criteria - Graph Builder
(1) Projection determinism: dropping iip_graph and replaying from relational tables yields an isomorphic graph. (2) Known alias sets in the eval fixture collapse to exactly one entity each. (3) No edge exists in AGE whose endpoints are absent from entities. (4) Re-running over a document is a no-op on counts. |
| --- |
| // packages/contracts/query.ts
export const Citation = z.object({
  documentId: z.string().uuid(),
  documentTitle: z.string(),
  sourceName: z.string(),
  url: z.string().url().nullable(),
  quote: z.string(),                 // verbatim supporting span
  publishDate: z.string().nullable(),
});
 
export const AnswerSentence = z.object({
  text: z.string(),
  citationIndexes: z.array(z.number().int()), // refs into citations[]
  assertionType: z.enum(['fact','attributed_claim']),
});
 
export const QueryAnswer = z.object({
  question: z.string(),
  intent: z.string(),
  answer: z.array(AnswerSentence),   // empty => no-evidence path
  citations: z.array(Citation),
  graphContext: z.array(z.object({   // optional sub-graph for UI
    nodes: z.array(z.any()), edges: z.array(z.any()),
  })).optional(),
  confidence: z.number().min(0).max(1),
  noEvidence: z.boolean(),
}); |
| --- |
| The no-evidence path is a feature, not a failure
When retrieval yields nothing citable, the correct behaviour is to return noEvidence:true with an empty answer array and a clear message. 'I don't have a sourced answer' is a valid, desirable response. Agents must never add a fallback that free-generates to avoid an empty answer. |
| --- |
| Agent | Trigger | Reads | Writes | Idempotency key |
| --- | --- | --- | --- | --- |
| Collector | schedule / discover | sources | documents, MinIO | content_checksum |
| Analyst | document pending | documents | document_chunks, staging_extractions | chunk_id+version |
| Graph Builder | doc extracted | staging_extractions | entities, relationships, AGE | dedupe anchors |
| Timeline Builder | doc graphed | events, relationships | timeline_events | event entity+date |
| Fact Checker | claim created | claims, evidence | contradictions, verification_status | claim pair |
| Narrative Builder | on demand / batch | graph, timeline, claims | narratives (cache) | query hash |
| Query Planner | per user query | all read models | (none; returns plan) | n/a (stateless) |
| Failure | Detected by | Policy |
| --- | --- | --- |
| Source blocked / 4xx | Collector fetch | Fail job, typed error, no row; alert if source-wide. |
| LLM invalid JSON | zod parse | Retry once with stricter prompt; then drop + log. |
| Quote not in chunk | substring check | Drop the single item; keep valid siblings. |
| Entity unresolved | Graph Builder | Hold relation in staging; retry on next pass. |
| Empty retrieval | Citation gate | Return noEvidence:true (not an error). |
| Ollama timeout | LLM router | Backoff + retry; optional cloud-tier fallback if enabled. |
| // Common error envelope (packages/contracts/http.ts)
export const ApiError = z.object({
  error: z.object({
    code: z.enum(['bad_request','not_found','rate_limited',
                  'unprocessable','internal']),
    message: z.string(),
    details: z.record(z.any()).optional(),
  }),
}); |
| --- |
| Method & path | Purpose | Success body |
| --- | --- | --- |
| POST /api/v1/query | Natural-language question | QueryAnswer (Sec 10.2) |
| GET /api/v1/entities/:id | Entity detail + metadata | Entity + mention summary |
| GET /api/v1/entities | Search/filter entities | Paginated Entity[] |
| GET /api/v1/graph/neighbors/:id | 1-hop neighborhood (capped) | { nodes, edges } |
| GET /api/v1/timeline | Filtered timeline events | Paginated TimelineEvent[] |
| GET /api/v1/evidence/:id | Evidence package for a claim | Claim + evidence + sources |
| GET /api/v1/senators/:id/dashboard | Senator read model | Statements, votes, participation |
| GET /api/v1/documents/:id | Document + citation linkback | Document metadata + url |
| GET /api/v1/health | Liveness/readiness | { status, deps } |
| // Request
{ "question": "Which senators voted against the impeachment?",
  "maxCitations": 10 }
 
// Response 200 (QueryAnswer) - shape, not real data
{
  "question": "Which senators voted against the impeachment?",
  "intent": "list_entities",
  "noEvidence": false,
  "answer": [
    { "text": "<senator> voted against, per the Senate record.",
      "assertionType": "fact", "citationIndexes": [0] }
  ],
  "citations": [
    { "documentId": "...", "documentTitle": "Senate Journal No. ...",
      "sourceName": "Senate of the Philippines", "url": "https://...",
      "quote": "<verbatim span from the journal>",
      "publishDate": "2025-..." }
  ],
  "confidence": 0.86
}
 
// Response 200 - no-evidence path
{ "question": "...", "intent": "factual_lookup", "noEvidence": true,
  "answer": [], "citations": [],
  "confidence": 0.0 } |
| --- |
| API acceptance criteria
(1) Every /query 200 response validates against QueryAnswer. (2) No response ever contains an AnswerSentence of type 'fact' with an empty citationIndexes array. (3) Malformed requests return the ApiError envelope with code 'bad_request', never a stack trace. (4) /graph/neighbors caps node count and never returns endpoints absent from the entity store. |
| --- |
| // packages/config/schema.ts (excerpt)
export const Env = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  MINIO_ENDPOINT: z.string(),
  OLLAMA_BASE_URL: z.string().url(),
  EMBED_MODEL: z.string().default('bge-m3'),
  EXTRACT_MODEL: z.string().default('qwen2.5:14b-instruct'),
  LLM_CLOUD_ENABLED: z.coerce.boolean().default(false),
  RETRIEVAL_TOP_K: z.coerce.number().default(8),
  ENTITY_MERGE_THRESHOLD: z.coerce.number().default(0.45),
}); |
| --- |
| Route | Purpose | Primary data source |
| --- | --- | --- |
| / | Dashboard: latest events, key entities | GET /timeline, /entities |
| /graph | Interactive explorer (Cytoscape) | GET /graph/neighbors |
| /timeline | Day/week/month/year timeline | GET /timeline |
| /evidence/:id | Evidence + contradiction view | GET /evidence/:id |
| /chat | Natural-language Q&A with citations | POST /query |
| /senators/:id | Senator dashboard | GET /senators/:id/dashboard |
| Layer | Scope | Tooling / gate |
| --- | --- | --- |
| Unit | Pure functions: normalization, chunking, citation gate, resolution scoring | Vitest; runs on every commit |
| Contract | zod schemas accept valid / reject invalid fixtures for every contract | Vitest; fails build on drift |
| Integration | DB writers (upsert idempotency), AGE projection, retrieval over a seeded corpus | Testcontainers (PG+Redis+MinIO) |
| E2E | Ingest fixture source -> answer a fixed question with correct citations | Playwright + seeded stack |
| Eval | Extraction precision/recall, answer groundedness, citation coverage | Eval harness; thresholds below |
| Metric | Definition | Threshold |
| --- | --- | --- |
| Citation coverage | Fact sentences with >=1 valid citation | 100% (hard) |
| Quote validity | Persisted quotes that are verbatim substrings | 100% (hard) |
| Extraction precision | Correct entities/relations / extracted | >= 0.85 |
| Extraction recall | Correct extracted / gold labels | >= 0.75 |
| Entity-resolution accuracy | Correct merges on alias fixture | >= 0.90 |
| Answer groundedness | Answers entailed by their citations (LLM-judge + human spot) | >= 0.95 |
| Projection determinism | Graph identical after rebuild | exact (hard) |
| Query latency p95 | POST /query end-to-end | < 10 s |
| Hard vs soft gates
Citation coverage, quote validity, and projection determinism are HARD gates: a failure blocks merge regardless of other scores. Precision/recall/groundedness are tracked over time and block merge only on regression beyond a tolerance, so model/prompt iteration stays possible without lowering the safety floor. |
| --- |
| Service | Image basis | Notes |
| --- | --- | --- |
| postgres | postgres:16 + pgvector + AGE | Needs shared_preload_libraries='age'; init SQL creates extensions + graph. |
| redis | redis:7 | BullMQ broker + short-TTL query cache. |
| minio | minio/minio | Private bucket 'iip-raw' for snapshots. |
| ollama | ollama/ollama | Pre-pull EMBED_MODEL + EXTRACT_MODEL on first boot. |
| firecrawl | self-hosted firecrawl | Crawl/clean; honours robots. |
| api | node:22 (apps/api) | Fastify; depends_on postgres, redis. |
| worker | node:22 (apps/worker) | Scale via replicas; one queue set per agent. |
| web | node:22 (apps/web) | Next.js; talks only to api. |
| otel/prometheus/grafana | upstream images | Traces, metrics, dashboards. |
| Dimension | Target |
| --- | --- |
| Query latency | p95 < 10 s end-to-end (PRD); p50 < 3 s goal. |
| Ingestion throughput | >= a few hundred documents/hour on one node (LLM-bound). |
| Availability (v1) | Single-node best-effort; graceful degradation if a worker is down. |
| Reproducibility | Deterministic re-extraction and graph rebuild (versioned). |
| Auditability | Every served fact traces to a stored raw snapshot + span. |
| Portability | Runs fully offline on commodity hardware with local models. |
| Risk | Impact | Mitigation |
| --- | --- | --- |
| LLM hallucination in extraction | False claims about real people | Verbatim-quote substring gate; citation-or-silence; eval thresholds. |
| Incorrect entity merge | Corrupted records across the graph | Conservative-merge bias; LLM disambiguation; alias eval fixture. |
| Source bias / framing leakage | Non-neutral answers | Fact-vs-claim tagging; preserve source verbs; media-comparison view. |
| Local model quality ceiling | Lower recall on hard chunks | Pluggable cloud tier per task; track recall trend in CI. |
| Source ToS / legal limits | Ingestion of disallowed content | Registry trust tiers + robots respect; disable, never bypass. |
| Graph scale / traversal cost | Slow explorer queries | Hop caps + LIMITs; HNSW for vectors; Meilisearch for text. |
| Execution protocol
Pick a task whose dependencies are all done. Read the referenced section + contract. If a needed contract (zod schema in packages/contracts) does not yet exist, create it first as part of the task. Write the test/acceptance check alongside the code. Mark done only when the check is green. Do not start a task with unmet dependencies. |
| --- |
| ID | Task | Deps | Verify |
| --- | --- | --- | --- |
| F1 | Scaffold Turborepo (apps/api,worker,web; packages/*) | - | pnpm build passes; empty apps boot. |
| F2 | packages/config env schema + boot validation | F1 | Invalid env aborts start; valid env boots. |
| F3 | docker-compose: pg(+pgvector+AGE), redis, minio, ollama | F1 | All containers healthy; /health deps green. |
| F4 | packages/db Drizzle schema = Section 5 DDL + migrations | F1,F3 | Migration applies clean; schema matches DDL. |
| F5 | AGE bootstrap SQL + packages/graph client | F4 | create_graph + node/edge upsert smoke test. |
| F6 | packages/contracts: all zod schemas (Sec 8,10,12) | F1 | Contract tests accept valid / reject invalid. |
| F7 | packages/observability: OTel + pino + metrics | F1 | Trace + metric emitted from a sample span. |
| ID | Task | Deps | Verify |
| --- | --- | --- | --- |
| P1 | Source registry CRUD + seed official/media sources | F4 | Seeded rows; registry read API. |
| P2 | Collector: discover + fetch(Firecrawl) + MinIO snapshot | P1,F3 | Sec 7.3 acceptance criteria pass. |
| P3 | Checksum dedupe gate + document upsert | P2 | Re-run inserts zero new docs. |
| P4 | Analyst: chunking + embeddings into pgvector | P3,F4 | Chunks + vectors persisted; HNSW built. |
| P5 | Analyst: LLM extraction -> ExtractionResult + quote gate | P4,F6 | Sec 8.4 acceptance criteria pass. |
| P6 | Graph Builder: entity resolution + relationship upsert | P5,F5 | Sec 9.3 acceptance criteria pass. |
| P7 | Graph Builder: AGE projection + determinism rebuild | P6 | Projection-determinism test exact. |
| P8 | RAG: hybrid retrieval + citation gate + answer gen | P6,F6 | Sec 12.3 acceptance criteria pass. |
| P9 | Query Planner: intent detection + retrieval plan | P8 | Intents route to correct retrievers. |
| P10 | API: POST /query + GET entity/timeline/evidence/graph | P8 | All responses validate; error envelope used. |
| P11 | Web: /chat with citations + no-evidence empty state | P10 | Cited answers render; no-evidence shows. |
| P12 | Web: /graph explorer (Cytoscape lazy expand) | P10 | Click-expand within node cap. |
| P13 | Timeline Builder + /timeline route | P7 | Events derived; timeline renders. |
| P14 | Eval harness + Phase-1 gold set + CI gates | P5,P8 | Thresholds in Sec 15.2 enforced. |
| ID | Task | Deps | Verify |
| --- | --- | --- | --- |
| D1 | Senator dashboard read model + route | P7,P13 | Votes/statements/participation aggregate correctly. |
| D2 | Narrative Builder (cached, citation-bound) | P8,P13 | Narratives carry citations; no uncited claims. |
| D3 | Media comparison view + framing index (Meilisearch) | P10 | Same event across outlets, framing linked to source. |
| D4 | Evidence explorer + contradiction surfacing | F1,P5 | Evidence packages render; quotes verbatim. |
| ID | Task | Deps | Verify |
| --- | --- | --- | --- |
| V1 | Fact Checker: contradiction detection + severity | D4 | Contradictions written with rationale; HITL on high. |
| V2 | Claim verification_status propagation to answers | V1,P8 | Answers reflect supported/refuted/contested. |
| V3 | Influence analytics (degree/betweenness/PageRank) | P7 | Centrality metrics computed over graph. |
| V4 | Real-time-ish ingestion scheduling + alerts | P2 | Breaking docs ingested on schedule; alert on new. |
| Definition of done (applies to every task)
Code compiles under strict TS; touches no module boundary without a contract; has a passing unit/integration test; respects the citation-or-silence and verbatim-quote invariants; emits the relevant metric/trace; and updates .env.example / docs if it adds config. A task that weakens a hard gate to pass is rejected, not merged. |
| --- |
| Term | Meaning |
| --- | --- |
| Canonical entity | The single deduplicated record for a real-world person/org/event. |
| Mention | A specific textual reference to an entity in a document, with span. |
| Extractor version | Identifier of model+prompt that produced an extraction; enables reproducibility. |
| Projection | Derived data (AGE graph, search index) rebuildable from relational tables. |
| Citation gate | The step that drops any answer candidate lacking a resolvable source span. |
| No-evidence path | The valid response returned when nothing citable supports an answer. |
| Fact vs attributed claim | Distinction between recorded facts and statements ascribed to a source. |
| Hard gate | A CI check whose failure blocks merge unconditionally. |
| Dedupe anchor | A unique constraint used by ON CONFLICT to make writes idempotent. |
| PRD capability | Realized by (TDD section) |
| --- | --- |
| Continuous document ingestion | Sec 7 (Collector) + Sec 11 |
| Knowledge graph construction | Sec 6 + Sec 9 |
| Natural language QA | Sec 10 + Sec 12.3 |
| Interactive graph exploration | Sec 6.3 + Sec 14 |
| Timeline reconstruction | Sec 5.2.5 + Timeline Builder (Sec 11) |
| Evidence mapping | Sec 5.2.4 + Sec 12 /evidence |
| Senator dashboards | Sec 12 + Sec 14 + Phase 2 D1 |
| Narrative generation | Sec 11 Narrative Builder + Phase 2 D2 |
| Contradiction detection | Sec 5.2.4 + Fact Checker + Phase 3 V1 |
| Media comparison | Sec 14.2 + Phase 2 D3 |