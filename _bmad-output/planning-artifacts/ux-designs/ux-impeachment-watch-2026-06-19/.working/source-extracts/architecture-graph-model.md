# Source Extract — Architecture & Graph Model

> Source: `architecture.md` + `reconcile-tdd.md`
> Extracted: 2026-06-19 by subagent

## 1. System Overview

IIP (Impeachment Intelligence Platform) is a **full-stack TypeScript data-platform monorepo** — a backend-heavy RAG + knowledge-graph platform with a high-integrity editorial control surface. Per the spec: *"HIGH complexity, LOW request volume, MONOTONICALLY-GROWING append-only data volume, HIGH per-query computational complexity. Correctness is the hard problem, not throughput."* Deployment is **single-workstation Docker Compose (transitional, AC-3)** running ~14 containers with **five OS-level processes arbitrating via the scheduler**: `api`, `ingest-worker` (sole AGE writer), `serve-worker` (read-path), `audit-worker` (append-only), `enqueuer` (control-plane). Data flow: *"Source → `ingest/fetch` → MinIO raw + `documents` → `ingest/gate` (2-sig approve, SEC-2) → `extract` (chunk+embed+substring prefilter+LLM) → `staging` → `Resolver` (conservative merge) → canonical → `graph-builder` (AGE projection, drop+rebuild) → `timeline` → `serve-worker/rag` (fusion + CRAG) → `generate` → **`render-queue` → render (fail-closed, NLI entailment)** → MinIO render object → `api /query` → `web <Citation>`."* No real-time / multi-tenancy in v1 — *"batch; internal-first single-case."*

## 2. Frontend Stack

- **Framework:** Next.js 15, App Router, RSC (`apps/web`).
- **Rendering model:** RSC `fetch` to `/api/v1` in server components for the initial payload on *"heavy data-dense pages: graph, timeline"*. No tRPC — *"the Fastify REST contract (validated by `packages/contracts`) is the single source of truth."*
- **UI library:** Tailwind 4.x + **shadcn/ui** (kept upgrade-safe in `components/ui/`), with **domain primitives separate** in `components/iip/` (Claim, TrustBadge, SourceVerbTag) and a compound `<Citation>` primitive in `components/citation/`.
- **Styling:** `app/styles/iip-tokens.css` semantic tokens *"named by meaning (`--trust-tier-verified`, `--trust-tier-contradicted`, `--claim-dashed`, `--defamation-risk-caution`; never `--green-500`)"*.
- **State management (D11/STR-10):** *"React Query 5.x (server state) + Zustand 5.x (ephemeral interaction: graph node selection, timeline filters, citation modal state, chat draft) + nuqs 2.x (URL-shareable: active entity, time range, view mode)"*. Zustand stores in `lib/state/{graph-store, timeline-store, chat-store, citation-store}.ts`; `lib/state/url-keys.ts` is *"the single nuqs URL-key registry (the URL is a public API for journalists — every param name/parser in one file, no drift)"*.
- **Data fetching:** *"RSC `fetch` to `/api/v1` in server components for the initial payload; React Query for client-side mutations/refetches."* One HTTP wrapper `lib/api.ts` (AbortController + retry; lint-bans raw `fetch`).

## 3. Surfaces / Screens

Routes from `apps/web/app/(routes)/` (STR-7):

- **`/chat`** — NL Q&A with citation-or-silence; the citizen entry point in the journey map ("citizen → `/chat`").
- **`/claim/[id]`** — *"The PD-1 essence made addressable"* — a URL-shareable claim surface; *"chat/timeline/evidence/senators link to it via `<Link href="/claim/${id}">`"*.
- **`/graph`** — interactive graph explorer (hop-capped); accepts `?seed=…` and `?renderer=cytoscape|react-flow|sigma`.
- **`/timeline`** — timeline view with date-precision (`date_precision ∈ {day, month, year, approx}`).
- **`/evidence/compare?ids=…`** — honest-split evidence explorer (exculpatory / inculpatory).
- **`/senators/[id]`** — early/lightweight senator/entity read-model dashboard (full dashboard deferred to Phase 2).
- **`/documents/[id]`** — document viewer (citation modal anchors to span).

Cross-cutting surfaces: compound `<Citation>` modal + doc-viewer (anchored to `content_hash`-bound span); `<Citation.Empty>` no-evidence empty state; root layout `CitationContext` provider so a graph node selected at 2am flows to the citation modal without prop-drilling. PD-1 essence sentence (*"Every claim IIP shows you cites a source you can open — or IIP shows you nothing."*) *"must render verifiably on every answer surface."*

## 4. Knowledge Graph Data Model

The graph is **Apache AGE** (openCypher) as a **derived projection of canonical relational data** — *"labels 1:1 with canonical relational `entity_type`/`relation_type` (no staging enrichment, no LLM-derived props — AGE is a projection, not a store)"*. Named graph = `iip_graph`; node + edge labels are **UPPERCASE** (e.g. `PERSON`, `VOTED_AGAINST`); each node carries its relational `id`.

- **Node types** (inferred from `packages/db/src/schema/{entities,relationships,claims,evidence,timeline,staging}.ts` and the projection rule): `PERSON` (senators, political subjects), plus entity types extensible via *"adding an `entity_type` is config + index, no Resolver code change"*. `DOCUMENT`/source nodes implied. Claims and evidence are modeled as graph elements. Timeline events exist as derived read-models (not materialized SQL views).
- **Edge types / relationship types:** UPPERCASE, 1:1 with `relation_type`; e.g. `VOTED_AGAINST` shown verbatim in naming patterns. `source-verb preservation (EI-3) — verbatim from extraction; never paraphrased; enforced by prompt contract + output-parser + render-time test."`
- **Properties on nodes/edges:** Each node carries its relational `id`. **Trust tier assigned AT INGEST, persisted on the node, travels with every graph edge** (SEC-3) — *"single-source sensitivity is a structural graph property… an allegation about Senator X with exactly one Tier-4 source must surface an 'uncorroborated, single manual source' provenance string that survives the RAG pipeline end-to-end."* Trust tier is also an AGE edge property (queryable) and projected into the RAG index for retrieval filtering. Bi-temporal validity: *"as-of querying via bi-temporal `valid_from/valid_to`."* Confidence values = `NUMERIC(4,3)` in [0,1].
- **Citation tuple on edges/served claims (SC-2/AC-4):** `citation = (source_doc_id, span_start, span_end, content_hash)` — *"re-embedding preserves citation validity; migration = shadow re-index + diff."*
- **Supersession semantics (STR-6b/ADR-017):** *"a superseded node is never deleted, only marked; AGE rebuilds; citation retains the historical reference + a supersession flag — every render that cited the superseded node must be reproducible-as-was and flagged-going-forward."*
- **Approximate scale:** Single-case v1 (seed = Sara Duterte impeachment). *"Estimated components: ~8 planes… ~12-15 deployable/library modules."* Graph is **time-bounded per-case, drop-rebuild cheap** (vs entity-bounded — VAL-8 flags partition semantics as unresolved). Hop-capped exploration (NFR-P-3 *"hop/count caps"*). No multi-tenancy/real-time.
- **Query patterns supported:** Fusion router over 3 retrievers — *"pgvector ANN + AGE Cypher + BM25"*, CRAG correction node. Intent-aware hybrid retrieval; query planner consumes fused list. AGE Cypher reads via `@iip/graph/reader` (public); writes restricted to `apps/ingest-worker/src/graph-builder`. Retrieval filters by trust tier. HippoRAG = Query-Planner tool.

## 5. Graph Rendering Tech

**Tiered rendering (one shell, three renderers, STR-9):**

- **Cytoscape.js 3.30.x** — default renderer.
- **React Flow 12.x (`@xyflow/react`)** — *"curated sub-views"*.
- **Sigma.js + graphology** — *">10K nodes, deferred trigger"* (i.e. only swaps in above a node-count threshold).

Architecture: *"Never three explorers."* `apps/web/lib/graph/types.ts` is *"the single shared model (GraphNode/GraphEdge/SelectionState) imported by the Zustand store, every renderer, the citation modal"*; `lib/graph/tier-router.ts` is *"a pure function `(nodeCount, mode) → renderer`, unit-testable, URL-encodable `?renderer=cytoscape`"*. Data-flow: *"click node → Zustand graph-store → nuqs URL (`?active=senator-x`) → CitationContext → source surfaces."* Performance constraint: *"hop/count caps"* (NFR-P-3); graph explorer is hop-capped. Sigma is the only path for >10K nodes.

## 6. Citation System

- **Storage (SC-2/AC-4):** `citation = (source_doc_id, span_start, span_end, content_hash)` owned by `packages/citation` — *"NOT coupled into `rag` (that would make provenance a retrieval concern, which AC-4 forbids)"*. Decoupled from embeddings so re-embedding preserves validity.
- **Lifecycle:** *"Produced in `ingest`, attached in `rag`, verified at the render gate (AC-2), scored in `eval`, preserved across edits by `editorial` (AC-11)."*
- **Verification:** *"Fail-closed at the render layer (AC-2)… substring is a fast-fail prefilter, backed by an NLI entailment gate. Chaos-tested for silent citation-drop under load."* *"Citation emitted synchronously in render via `citation.emit(span, source)` (no async/side-channel)"* (PC-1f). Property test: *"fuzz every `render.*` export, assert every emitted span has non-null `citation.source_id`."*
- **Surfacing (D13/STR-8):** *"`<Citation>` component keyed to block index → opens a doc-viewer modal scrolled to the anchored span (cite span = `content_hash`-bound per SC-2/AC-4). Fact/claim visual distinction via shadcn variants."* Compound API: `<Citation><Citation.Chip/><Citation.Modal/></Citation>`; `CitationContext` at root layout. `components/claim/claim.tsx` *"renders `<Citation.Empty>` by default and promotes to `<Citation.Chip>` only when provenance resolves — AC-2 enforced at the component boundary, not at code review."*
- **Trust tiers surfaced:** citation-quality display (FR-5.5); `lib/citation/source-verbs.ts` = *"verb → variant registry (EI-3; adding a verb is a one-line edit, not a grep-and-hunt)."*
- **Supersession:** retraction/correction supersession hook (FR-5.7); *"retraction.superseded"* event in the AC-11 log; cache-bust on supersession.

## 7. Data Freshness / Update Model

**Batch, not real-time.** *"Real-time / multi-tenancy: none in v1 (batch; internal-first single-case). Both LOW."* Ingestion is a **staged worker pipeline** (extract → resolve → graph-builder → timeline) driven by an event-driven Enqueuer over Redis Streams (STR-3): *"Worker completes a stage → writes `<stage>.completed` to the stream → Enqueuer (consumer-group leader) reads + enqueues the next BullMQ job. Replayable on crash; jobs idempotent via content-hash dedup (at-least-once → effectively-once)."* Ingestion throughput: *"≥ few hundred docs/hour (extraction-bound)"*. AGE graph rebuilds are drop-and-rebuild per case. Caching: Redis GET endpoints TTL 60–300s; *"`/query` is NOT cached except identical-recent-question keyed by normalized text… latency never bought by dropping the citation gate."* Invalidations on graph rebuild + AC-11 retraction/supersession events. Streaming deferred to v2 (D10) — *"v1 `/query` returns a complete `QueryAnswer` (no SSE streaming). Rationale: simpler contract, deterministic for the AC-1 eval harness and PD-3 gate-time re-run."*

## 8. API Surface

**Fastify 5.x `/api/v1` is the ONLY public ingress** (after PD-3 gate passes; before that, gated behind Caddy + JWT allowlist, SEC-1/D5). Caddy 2.8.x fronts with auto-TLS + rate-limit. **OpenAPI 3.1** generated from Fastify JSON Schema via `@fastify/swagger` (D8); spec↔zod contract test on every PR. Auth: per-issued JWTs (kid + exp ≤1h + jti + scope), validated in Fastify middleware; handlers read only `req.principal`.

Implied endpoints (from routes dir + FG mapping):
- **`/query`** — NL Q&A, returns complete `QueryAnswer` (no SSE); citation-or-silence; serving-time substring re-validation + NLI entailment gate before generation. *"Query p95 < 10s (p50 < 3s)"* (NFR-P-1).
- **`/evidence`** (+ `/evidence/compare`) — honest-split evidence explorer (exculpatory/inculpatory per subject stratum).
- **`/graph/neighbors`** — hop-capped graph exploration (Redis-cached, D3).
- **`/timeline`** — timeline events read-model (date_precision).
- **`/senators/[id]`** — entity/senator read-model.
- **`/documents/[id]`** — document viewer (span-anchored).
- **`/claim/[id]`** — claim addressable surface (STR-7).
- Editorial gate API (`packages/editorial`): sign-off, supersession, AC-11 hash-chained log entries (`auth.revoked`, `intake.approved`, `editorial.signoff`, `legal.clearance`, `verification.spot`, `retraction.superseded`, `render.violation`, `stage.completed`).

**API envelope:** success = resource directly (or `{data, nextCursor?}` paginated); error = `{error:{code, message, details?}}`, `code ∈ {bad_request, not_found, rate_limited, unprocessable, internal}`. No stack traces. UUID v4 everywhere; ISO-8601 UTC dates.

## 9. Technical UX Constraints

- **Latency:** *"Query p95 < 10s (p50 < 3s)"* — but *"Latency is never bought by dropping the citation gate."* STR-4 render-via-queue adds a cross-process hop; VAL-5 reclassifies render-queue latency as *"blocking until benchmarked on the actual workstation with eval running — p95 violations drive retries → load → more violations (cascade risk)."*
- **Fail-closed UX (AC-2/SEC-5):** retrieval empty → `noEvidence: true`; citation support < threshold → WITHHOLD; *"backing service degraded under load → refuse to serve. Unavailability > wrongness."* `<Claim>` renders `<Citation.Empty>` by default. The "no-evidence empty state" is a first-class FR (FR-5.3).
- **No offline support; no SSE streaming v1.** No real-time / multi-tenancy.
- **Mobile considerations:** Not explicitly specified — Next.js App Router RSC + Tailwind + shadcn is responsive by default, but no dedicated mobile constraints stated. Single-case, internal-first, low request volume.
- **Browser support:** Not explicitly specified; Playwright 1.50.x E2E is the test surface.
- **Accessibility tooling:** Not explicitly specified beyond shadcn/ui primitives (WCAG-friendly defaults) and semantic token naming. No dedicated a11y tooling called out.
- **Scale cap / trigger:** *"~14 containers + Ollama VRAM on one workstation (NFR-D-1 vs STR-2) — non-blocking for F1, blocking before ~F3 or >5 concurrent users"* (VAL-5/T1). >10K graph nodes triggers Sigma renderer swap.
- **Auth gate on web:** `apps/web/src/middleware.ts` auth gate (STR-11) — JWT-protected during internal period.
- **URL as public API:** *"the URL is a public API for journalists"* (STR-10) — every nuqs param centralized; shareability is a constraint (`/claim/[id]`, `?seed=…`, `?renderer=…`, `?active=senator-x`).
- **Trust/provenance as visual constraint:** trust tier is structural graph property that must surface end-to-end; single-source Tier-4 allegations must display an *"uncorroborated, single manual source"* provenance string surviving the full RAG pipeline. Fact/claim visual distinction is enforced (FR-5.2). Honest-framing slide (DR-4) must state v1's exclusions as clearly as capabilities (no narrative generation, no contradiction engine, no influence analytics, no media comparison).
- **Legal/PH jurisdiction constraints shaping UX:** cyberlibel-aware legal clearance (G7) is **blocking** — *"All red-tier answers removed before exposure; amber carry a written counsel note."* Per-answer risk tiers (green/amber/red) imply a risk-tier surface in editorial review. Republication-awareness (*Disini*) affects what quoted/republished third-party content can be shown.