---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-06-19'
inputDocuments:
  - IIP_Technical_Design_Document.docx
  - _bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/prd.md
  - _bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/addendum.md
  - _bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/reconcile-enterprise-prd.md
  - _bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/reconcile-tdd.md
  - _bmad-output/planning-artifacts/research/technical-iip-technology-stack-validation-research-2026-06-19.md
  - _bmad-output/planning-artifacts/research/technical-graph-db-apache-age-evaluation-2026-06-19.md
  - _bmad-output/planning-artifacts/research/technical-orchestration-kg-construction-retrieval-2026-06-19.md
  - _bmad-output/planning-artifacts/research/technical-ingestion-architecture-blocked-ph-sources-2026-06-19.md
  - _bmad-output/planning-artifacts/research/technical-local-llm-extraction-feasibility-2026-06-19.md
  - _bmad-output/planning-artifacts/research/technical-citation-eval-graph-viz-2026-06-19.md
workflowType: 'architecture'
project_name: 'impeachment watch'
product: 'Impeachment Intelligence Platform (IIP)'
user_name: 'anti lustay'
date: '2026-06-19'
seed_case: 'Sara Duterte impeachment (Philippines)'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Party-Mode Consensus (Step 2)

This document's Project Context Analysis was refined through a five-agent roundtable (🏗️ Winston · 📊 Mary · 🧪 Murat · 📋 John · 💻 Amelia). The following consensus amendments (AC-1…AC-11) are binding on all downstream architectural decisions:

- **AC-1** Evaluation Harness is the 8th architectural plane (architecture, not infrastructure).
- **AC-2** Integrity enforcement is fail-closed at the render layer — a structurally separate code path from generation, unreachable by it; default action on citation support < threshold = WITHHOLD (P0); substring is a fast-fail prefilter backed by an NLI entailment gate; chaos-tested for silent citation-drop under load.
- **AC-3** Single-workstation constraint is TRANSITIONAL — all external dependencies accessed via interfaces so multi-node migration is a deployment change, not a rewrite.
- **AC-4** Citation provenance is decoupled from embeddings: `citation = (source_doc_id, span_start, span_end, content_hash)`; re-embedding preserves citation validity; migration = shadow re-index + diff.
- **AC-5** Where validation research and the TDD diverge, research wins; each divergence gets an ADR with cited evidence. TDD = baseline, ADRs = versioned overrides.
- **AC-6** Reproducibility scope stated precisely: reproducible = corpus snapshot + candidate set under frozen index + fixed `ef_search` + NLI scores for fixed claim+passage; NOT reproducible = generated prose across model versions.
- **AC-7** Recall split into exculpatory / inculpatory, reported per political-subject stratum.
- **AC-8** Inter-rater α ≥ 0.80 is a harness output computed from ingested reviewer judgments, not an external assertion. Mutation testing on EI enforcement code is gated behind harness maturity.
- **AC-9** v1 user = the build team (Intake Operator); journalists/researchers/legal-civil-society are v1's audience. Every FR is tagged against the build-team JTBD; non-serving FRs deferred to v2, not deleted.
- **AC-10** Adversary (subject/surrogate) is a first-class threat actor — DDoS resistance, disinformation-injection defense, citation-poisoning detection enumerated.
- **AC-11** Editorial workflow is a control plane: editorial actions are events on an append-only log with a defined API; the read path projects from the log.

**Deferred to v2 (not blocking v1):** per-stakeholder value map; competitive-landscape write-up; mutation testing on EI code (until harness matures).

**Resolved product decisions (Party Mode round 2 — 📋 John · 📊 Mary · 🏗️ Winston):**

**PD-1 — v1 essence (the one sentence).** The single sentence the presentation audience should be able to repeat back:
> *"Every claim IIP shows you cites a source you can open — or IIP shows you nothing."*

Mechanism-tight (viewer-verifiable: open the deck, pick a sentence, find a citation or not), segment-portable (journalists hear "your sourcing standard met by a machine"; researchers hear "a reproducible, auditable methodology"; legal/civil-society hear "a record defensible line-by-line"), and journalist-testable. Maps to enforceable gates: citation CI = 100%, quote-validity CI = 100%, AC-2 fail-closed at render. An optional warm human-preamble sentence may lead the presentation, but the *repeatable claim* is the cold one above. Deliberately omits recall/precision/coverage (the audience can verify provenance, not recall — coverage is SM-7's adversarial-demo job) and the "Political Intelligence OS" ambition (round-3 story, not v1 essence).

**PD-2 — Post-presentation KPI (30/60/90 cascade, tightening SM-8's OR into AND).** All checkpoints logged as events in the AC-11 editorial event log:
- **Day 30 (leading):** ≥1 external-audience-segment partner has run independent spot-verification on a corpus slice **they themselves sampled** (defeats curation bias + demo decay), recorded as `external.verification.observed`.
- **Day 60 (mid):** ≥1 written rationale (from a partner/funder conversation) naming citation-provenance or auditability as a primary reason to engage.
- **Day 90 (strongest):** ≥1 audience-segment organization has **donated their own questions/documents for IIP to run** (voluntarily, unreimbursed — the strongest trust signal: reputation-risk skin-in-the-game) **OR** a concrete commitment (pilot access / partnership / funding next-step).

Time-bounded: the clock is the proceeding's, not just ours — if the proceeding concludes first, the KPI must be met by that inflection or v1 did not earn its purpose on a live case. Funding alone is *lagging*; independent verification labor + donated material are *leading* signals.

**PD-3 — Pre-External Presentation Gate (fail-closed; machine prefix + human suffix; FAIL is the default, any missing row = no go).** This is AC-2 lifted from render-time to presentation-time — the render path will not produce a presentation deck the gate has not blessed (render reads only from the frozen corpus hash; G1 is a precondition for render).

*Machine-checkable prefix:*
- **G1 — Corpus freeze (linchpin):** content hash of all presented claims + citations recorded in the AC-11 log; non-repudiable binding so the corpus can't be silently tweaked between gate-pass and presentation.
- **G2 — Adversarial pass:** SM-7 = 100% on the *frozen* corpus, re-run at gate time (not a stale result). Set is partly external-authored.
- **G3 — Hard CI gates:** citation 100%, quote-validity 100%, projection-determinism exact, fact/claim 100% — on the frozen corpus.
- **G4 — Recall split (soft, reported):** exculpatory ≥0.75, inculpatory ≥0.75, refutes-recall ≥0.70 — on the frozen corpus (AC-7). Reported even where not gating; hiding it is the failure mode.
- **G5 — Independent spot-verification:** ≥50% of sampled demo answers spot-verified by a reviewer **not on the authoring team**; **sample drawn by the verifier, not the author** (else gamable); recorded as `verification.spot`.

*Human sign-off suffix (recorded, corpus-hash-bound):*
- **G6 — Named editorial owner sign-off:** `editorial.signoff` covering demo-corpus version hash + curated-sample-set hash + assertion each sample traces to a citation.
- **G7 — Cyberlibel-aware legal clearance (blocking):** named PH-licensed counsel produces **per-answer risk tiers (green / amber / red)** addressing RA 10175 §4(c)(4) exposure + *Disini* republication analysis for quoted/republished third-party content. **All red-tier answers removed** before exposure; amber carry a written counsel note. Legal is blocking, not advisory — cyberlibel is existential and a non-blocking review is decorative.
- **G8 — Honest-framing slide (DR-4):** exists and is shown — v1's exclusions (no narrative generation, no contradiction engine, no influence analytics, no media comparison) stated as clearly as capabilities. Absent = fail.

**Kill-switch (if forced to name one):** G2/G3 — the invariant at 100% on the external-authored frozen set. Legal clearance (G7) is *permission to open the door*; the invariant is *whether there's anything worth opening the door for*. Under criminal cyberlibel with personal team exposure, the gate fails closed — no teammate's name sits on an uncited sentence for a smoother demo.

## Project Context Analysis

### Requirements Overview

**Functional Requirements (5 feature groups, ~25 FRs):**
- **FG1 Intelligence ingestion & provenance (FR-1.1…1.7):** Source registry with confirmed trust tiers; lawful-access gate (disable-not-bypass); discover/fetch/dedupe-by-checksum; immutable raw snapshots; per-artifact provenance (doc + char span); idempotent, observable, resilient ingestion with dead-letter triage.
  → Tiered ingestion bus (scrapable / WAF'd / FOI / manual / partnership), each tier with its own tooling and provenance contract; dual-store (MinIO raw + Postgres cleaned).
- **FG2 Extraction & knowledge graph (FR-2.1…2.5):** Schema-validated, versioned extraction with extraction-time substring prefilter; claim/evidence modeling with *active* refutes/contextualizes extraction; conservative entity resolution; deterministic graph projection (rebuildable from canonical relational data); fact/claim tagging + source-verb preservation.
  → Staged pipeline (staging → resolve/merge → canonical → AGE projection); NLI entailment verification gate before any claim is served; LightRAG-style KG construction.
- **FG3 Investigative query & evidence (FR-3.1…3.5):** NL Q&A with citation-or-silence (no uncited path); serving-time substring re-validation; intent-aware hybrid retrieval; honest-split evidence explorer; interactive graph explorer (hop-capped).
  → Fusion router over 3 retrievers (pgvector ANN + AGE Cypher + BM25), CRAG correction node, citation-assembly + entailment gate before generation.
- **FG4 Temporal & entity views (FR-4.1…4.2):** Timeline with date-precision; early/lightweight senator/entity read-model (full dashboard deferred to Phase 2).
  → Derived read-models, bi-temporal-lite validity on relationships.
- **FG5 Editorial integrity surface (FR-5.1…5.7):** Inline citations; visual claim distinction; no-evidence empty state; honest non-claims; **Pre-External Presentation Gate** (editorial + cyberlibel-aware legal sign-off); citation-quality display (trust tiers); retraction/correction supersession hook.
  → Governance/audit subsystem (gate records, supersession chain) load-bearing for any external exposure.

> **v1 user = the build team (Intake Operator).** Journalists/researchers/legal-civil-society are v1's *audience*, not its users. Every FR is tagged against the build-team JTBD: *"help me demonstrate, on demand and under scrutiny, that every claim traces to a citation — so I can earn a partner's trust."* Non-serving FRs are deferred to v2, not deleted (AC-9). **Per-stakeholder value map + competitive landscape are v2 inputs.**

**Non-Functional Requirements (the architecture drivers):**
- **Editorial integrity (NFR-EI-1…8)** — *co-primary driver* with the local-first/FOSS constraint envelope. 100% citation coverage; 0 allegation-as-fact; ≈0 merge-error; 100% provenance resolution; recall split into **exculpatory / inculpatory** (per-subject stratum); 100% fact/claim boundary; citation-quality floor. These are CI-enforceable **hard gates** — but only as hard as the eval harness is complete (see Evaluation Harness plane).
- **Performance (NFR-P-1…3):** Query p95 < 10s (p50 < 3s); ingestion ≥ few hundred docs/hour (extraction-bound); hop/count caps. **Latency is never bought by dropping the citation gate.**
- **Security (NFR-S-1…5):** Read-only public API; parameterized queries + UUID validation; per-IP rate limiting; secrets via env; private raw store. **Adversary (subject/surrogate) is a first-class threat actor** — DDoS resistance, disinformation-injection defense, citation-poisoning detection enumerated (AC-10).
- **Legal/ethical (NFR-L-1…5):** Public + lawfully-accessible only; robots respected; PH DPA 2012; cyberlibel/republication hard gate (RA 10175 §4(c)(4), *Disini*); retraction handling; NPC Advisory 2026-01 (PIA for scraping). **Team carries personal criminal exposure → local-first/FOSS is liability distribution, not preference.**
- **Provenance/auditability/reproducibility (NFR-A-1…3):** Every served fact → raw snapshot + span; **reproducibility scope stated precisely** (AC-6): corpus snapshot + candidate set under frozen index + fixed `ef_search` + NLI scores for fixed claim+passage ARE reproducible; generated prose across model versions is NOT. Idempotent upserts on dedupe anchors.
- **Reliability (NFR-R-1…3):** Single-node best-effort; per-agent queues + capped backoff + DLQ; persisted multi-step agent state for resume-after-crash.
- **Local-first/deployment (NFR-D-1…3):** Single workstation (binding for v1), no proprietary cloud; local models default, cloud optional+pluggable+recorded; fully FOSS. **Single-workstation is TRANSITIONAL (AC-3): all external dependencies accessed via interfaces so multi-node migration is a deployment change, not a rewrite.**
- **Observability (NFR-O-1…2):** Structured logs/metrics/traces + **runtime invariant monitoring** (sampled live NLI, citation-drop SLOs, refutes-recall on shadow traffic). Hard CI gates: quote-validity 100%, projection-determinism exact, citation 100%, fact/claim 100%; soft: recall ≥0.75 (split), entity-resolution ≥0.90.

**Scale & Complexity:**
- **HIGH complexity, LOW request volume, MONOTONICALLY-GROWING append-only data volume, HIGH per-query computational complexity.** Correctness is the hard problem, not throughput.
- **Primary domain:** data-platform with a **high-integrity editorial control surface** (not "backend-heavy" — the editorial review UI is where defamation-grade errors are caught or shipped).
- **Estimated components:** ~8 planes (Ingestion, Processing, Graph, Derivation, Serving, **Evaluation Harness**, Experience, Platform) comprising ~12-15 deployable/library modules.
- Real-time / multi-tenancy: none in v1 (batch; internal-first single-case). Both LOW.

### Technical Constraints & Dependencies
- **Binding:** single-workstation Docker Compose (transitional); fully FOSS (Apache-2.0 / MIT preferred; AGPL/Commons-Clause excluded); local models default; TypeScript monorepo (Turborepo + pnpm); PostgreSQL 16 as single system of record (relational + pgvector + Apache AGE).
- **Authority hierarchy (AC-5):** validation research is authoritative over the TDD where they diverge; each divergence gets an ADR with cited evidence. TDD = baseline; ADRs = versioned overrides. (8 of 11 TDD components flagged for amendment; TDD's "PG17+ SQL:PGQ" reference is non-existent → Apache AGE *is* the openCypher path.)
- **Schema-affecting gate (OQ-1):** embedding model/dimension locked before HNSW build. Research: **bge-m3 (1024) only** — drop nomic-embed (768-dim mismatch). **Citation provenance is decoupled from embeddings (AC-4): `citation = (source_doc_id, span_start, span_end, content_hash)` — re-embedding preserves citation validity; migration = shadow re-index + diff.**
- **Corpus gap:** no pre-built Philippine legal-political corpus; domain adaptation (annotation) is a first-class workstream.

### Cross-Cutting Concerns Identified
1. **Editorial integrity enforcement** — the differentiator; touches every plane. **Fail-closed at the render layer (AC-2):** integrity enforcement is a structurally separate code path from generation, unreachable by it; default action on citation support < threshold = WITHHOLD (P0); substring is a fast-fail *prefilter*, backed by an NLI entailment gate. Chaos-tested for silent citation-drop under load.
2. **Evaluation Harness as architecture (AC-1)** — the 8th plane. Owns versioned golden corpus (in-repo), per-plane eval hooks, per-stratum gate reporting, inter-rater α ≥ 0.80 computed from ingested judgments. The gates are only as hard as the harness is complete.
3. **Provenance & deterministic reproducibility (scoped, AC-6)** — versioned extraction, idempotent upserts, immutable raw snapshots, rebuildable projections. Reproducible = corpus + frozen-index candidate set + NLI; NOT generated prose.
4. **Observability-as-quality** — `no_evidence_ratio`, `quote_validation_drops_total`, merge-error rate, refutes-recall are product-quality signals; **plus runtime invariant monitoring** (sampled live NLI, citation-drop SLOs).
5. **Security + adversarial threat model (AC-10)** — read-only public surface, parameterized queries, rate limiting; subject/surrogate adversary enumerated (DDoS, disinformation injection, citation poisoning).
6. **Legal/ethical compliance** — lawful-access gate, robots respect, DPA/cyberlibel/republication, retraction supersession, NPC scraping advisory; team carries personal criminal exposure.
7. **Local-first / FOSS / transitional single-host posture (AC-3)** — governs every component license + deployability decision; all deps behind interfaces.
8. **Editorial workflow as control plane (AC-11)** — editorial actions are events on an append-only log with a defined API; the read path projects from the log. (Review queue, sign-off gates, audit trail = first-class.)
9. **Model & embedding migration seam** — re-embed corpus while keeping citations valid (AC-4); shadow re-index + diff. A versioning seam designed in, not bolted on.
10. **Data lifecycle & retention** — deletion/correction propagation through the graph; audit trail of corrections (open item OQ-5, but architecturally load-bearing).

## Party-Mode Consensus (Step 3 — Scaffold Round, 🏗️ Winston · 💻 Amelia · 🧪 Murat)

The bespoke-scaffold recommendation was pressure-tested and refined. The following scaffold consensus amendments (SC-1…SC-10) are binding on the foundation:

- **SC-1 (Polyglot eval, split by execution phase + subprocess invocation).** `packages/eval/` (TS) = orchestration shell, corpus loader, per-plane hooks, runner, per-stratum reporting, and **render-time metrics** (citation-or-silence compliance, named-entity attribution, render-time hallucination guard) that run *inside* `render` to catch silent citation-drop at the moment it happens (AC-2). `tools/eval/` (Python, containerized, a Turborepo task node invoked via **subprocess/CLI, NOT HTTP** — a network failure mode overlapping AC-2's is correlated risk in a gate) = DeepEval/RAGAS/Inspect + corpus-aggregate metrics (faithfulness, citation-fidelity, exculpatory/inculpatory recall per stratum, coverage bias) + inter-rater α via `krippendorff` + red-team generators. `packages/contracts/eval.ts` = zod → JSON schema → pydantic via `datamodel-code-generator` in CI (TS source of truth; drift impossible). Red-team = Python generators + TS assertion shims. Every metric has `OWNERS.yml` + `docs/eval/metrics/<name>.md` with documented failure mode + severity. Containerized so the single workstation (AC-3) needs no Python toolchain.
- **SC-2 (`packages/citation` extracted).** Owns the `(doc_id, span_start, span_end, content_hash)` schema (AC-4) + hash algorithm + emission/verification APIs. Produced in `ingest`, attached in `rag`, verified at the render gate (AC-2), scored in `eval`, preserved across edits by `editorial` (AC-11). NOT coupled into `rag` (that would make provenance a retrieval concern, which AC-4 forbids). Highest-leverage scaffold correction.
- **SC-3 (`packages/render` as fail-closed gate, AC-2).** Structurally separate from `packages/rag` (generation). Mechanical enforcement via ESLint `no-restricted-imports` boundary: `render` imports only `@iip/contracts`; `rag` may not import `render`; one-way data flow via `RenderInput` zod. Day-one, not aspirational.
- **SC-4 (`packages/adversary` added, AC-10).** Threat model + attack taxonomies + invariant definitions; consumed by both `eval` (red-team) and `observability` (runtime invariants). Prevents the threat model drifting between two readers.
- **SC-5 (AC-3 interface-scoping rule, ADR-documented).** Interface in F1 = `LlmRouter`, `DbClient`, `GraphClient`, `Retriever`/`Reranker`, `MetricCompute` (the Python boundary), `render` output sink. Direct use (plumbing) = Fastify, Next.js, BullMQ, Drizzle query builder, zod, vitest, pino. Rule: interface anything with >1 plausible 24-month swap, anything cross-language, anything on an AC-2/AC-4 seam; do NOT interface substrate (pgvector/AGE/Drizzle — Drizzle *is* the abstraction).
- **SC-6 (Chaos at F1, AC-2).** `tools/chaos` workspace. F1 assertion: under 500 RPS mixed traffic on the golden corpus, zero claim-responses return without source attribution AND zero ground-truth-cited responses return without citations. k6 + Playwright fault injection. Not deferred — silent citation-drop under load IS the defamation event; cost now ~2 weeks, cost if deferred ~4–6 weeks of retroactive refactor.
- **SC-7 (Gate artifact store, distinct from editorial log).** `eval/gates/<corpus-hash>/` content-addressed artifacts: `manifest.json`, `adversarial-rerun.json`, `recall-split.json`, `interrater.json`, `decision.json`. A primitive that (a) freezes a corpus to a SHA-256 hash, (b) re-runs the adversarial pass against that frozen hash at gate time, (c) emits a decision artifact bound to that hash. Supports PD-3 G1/G2 gate-time re-run on a frozen corpus. The AC-11 editorial log (human-judgment provenance) *references* this store; it does not replace it.
- **SC-8 (Retention/lifecycle owner).** `packages/lifecycle` (or named owner in `db`) — retention policies, snapshotting, tombstone semantics; enforces AC-1 golden-corpus immutability + AC-11 append-only-log bounds. Without an owner, neither is enforced and someone patches ad hoc.
- **SC-9 (ADR seed expanded to ~15).** Original 8 (Node 22 vs LTS 20; AGE strike SQL:PGQ; Neo4j license exclusion; bge-m3 only; Qwen3-14B supersede; Docling+PaddleOCR add OCR; tiered ingestion; NLI entailment gate) **+** ADR-009 (monorepo orchestrator: Turborepo vs Nx vs bare pnpm — the scaffold decision itself must be an ADR), ADR-010 (citation storage representation + hash algorithm — xxhash vs sha256), ADR-011 (golden-corpus versioning: git-lfs vs content-addressed store), ADR-012 (LLM observability fork: pure OTel vs Langfuse/Langsmith — the rejection must survive an ADR), ADR-013 (adversary formalism: STRIDE vs MITRE ATLAS vs attacker trees), ADR-014 (polyglot eval invocation: subprocess not HTTP — risk argument recorded), ADR-015 (AGE raw-SQL escape hatch for Cypher in Drizzle). "Strike" framings converted to committed single-path decisions (a "strike" ADR is a smell — two live paths).
- **SC-10 (F1 concrete acceptance criteria).** F1 is scaffold, not features. Red-green-refactor ACs:
  - **AC-F1-01:** `pnpm install && pnpm build` exits 0, zero TS errors across all workspaces.
  - **AC-F1-02:** `pnpm typecheck` passes everywhere.
  - **AC-F1-03:** ≥1 vitest placeholder passes in every TS package.
  - **AC-F1-04:** `packages/eval/corpus/golden/v0/` loads N≥1 items against zod `GoldenItem` (AC-1 seed).
  - **AC-F1-05 (KEYSTONE):** polyglot eval round-trip proven — the Python eval workspace (subprocess-invoked) returns an `EvalResult` that passes the TS-side zod parse against the shared, generated schema.
  - **AC-F1-06:** `docs/adr/` contains the SC-9 ADR set (≥15); each divergence cites research evidence (AC-5).
  - **AC-F1-07:** `.github/workflows/ci.yml` runs all the above AND **blocks merge on red**.
  - **AC-F1-08:** `packages/contracts/render.ts` imported by both `rag` and `render`; `RenderInput` zod is the only shared symbol; ESLint `no-restricted-imports` boundary enforced (AC-2 seed).
  - **AC-F1-09:** `turbo run eval` exits 0 on empty corpus (smoke); `turbo run chaos --rps 500` exits 0 with the citation-invariant assertion on the golden corpus.
  - **AC-F1-10:** corpus-freeze primitive emits SHA-256 `eval/corpus/<hash>/manifest.json`; gate-time re-run emits `eval/gates/<hash>/decision.json` with explicit pass/fail + per-metric values; inter-rater α computation runs and emits a value (threshold not required at F1; the *computation* must exist — else AC-1's α is a future promise, not a capability).
  - Root `docker-compose.yml` ships in F1 with `api`, `worker`, `web`, `tools/eval`, `tools/chaos`, `postgres+AGE+pgvector`, `redis` (AC-3 workstation story intact day one).

## Starter Template Evaluation

### Primary Technology Domain
**Full-stack TypeScript data-platform monorepo** (backend-heavy RAG + knowledge-graph platform with a high-integrity editorial control surface) — identified from the TDD, amended validation research, and the AC-1…AC-11 / PD-1…PD-3 / SC-1…SC-10 consensus. No `project-context.md` existed; the TDD + addendum + 6 research reports serve as the technical-preference source of record.

### Starter Options Considered
Generic full-stack starters (T3, RedwoodJS, Blitz, create-next-app+manual, NestJS) and AI/RAG starter kits were evaluated against the binding constraint conjunction: **Fastify (not tRPC) + Drizzle (not Prisma) + PostgreSQL+pgvector+Apache AGE in one store + Next.js 15 + a BullMQ/LangGraph worker layer + Docker Compose + FOSS + local-first single-host + deterministic reproducibility + an eval-harness plane + interface-wrapped transitional deps.** None cleared even half the bars — every generic starter forces at least one wrong default (tRPC/Prisma/GraphQL/Edge-functions) and omits the worker/graph/object-store/eval layers that are the bulk of the foundation. (Web-verified mid-June 2026: no maintained 2026 starter ships this combination.)

### Selected Starter: Bespoke Turborepo scaffold (TDD §4, amended by SC-1…SC-10)

**Rationale for Selection:**
The TDD §4 workspace layout is already the correct design and uniquely satisfies the full constraint conjunction plus the consensus amendments. Turborepo (vs Nx vs bare pnpm-workspaces) is chosen narrowly — its build graph earns its keep on AC-1's per-plane/per-stratum eval caching (the deciding factor; remote caching is irrelevant for a single-workstation transitional system per AC-3) — and the choice is recorded as ADR-009. Rolling the foundation to spec is cheaper than fighting an opinionated starter's defaults, and it bakes in AC-3 (interface-wrapped deps from day one, scoped per SC-5), AC-5 (ADR trail seeded at scaffold time), and AC-1 (eval harness as a first-class package + plane, polyglot per SC-1).

**Initialization Command:**
```bash
pnpm create turbo@latest iip --package-manager pnpm
# refactor to the amended TDD §4 layout (see Module Structure below)
# + tools/{eval,chaos} Python workspaces (SC-1, SC-6)
# + infra/docker-compose.yml with full platform stack
```

**Module Structure (TDD §4, amended by SC-1…SC-10):**
- **`apps/`** — `api` (Fastify 5.x serving API), `worker` (BullMQ 5.x + LangGraph.js), `web` (Next.js 15, App Router, RSC)
- **`packages/`** —
  - `db` (Drizzle 0.35.x + drizzle-kit 0.28.x schema = TDD §5 DDL + AC-4 citation-provenance-decoupled schema; ADR-015 raw-SQL escape for AGE Cypher)
  - `contracts` (zod — the inter-module API; **single source of truth, including `eval.ts` → JSON schema → pydantic** per SC-1; `render.ts` shared by rag+render per AC-2; `queue.ts` shared by api+worker)
  - `graph` (Apache AGE ≥1.7.0 client + projection logic + AC-6 reproducibility-scoped rebuild)
  - `llm` (router + prompts + XGrammar-constrained decoding; LlmRouter port per SC-5)
  - `ingest` (tiered: Firecrawl Tier-1 / Crawlee+stealth Tier-2 / FOI Alaveteli / manual upload / partnership — each tier a thin adapter behind a Crawler port; **v1 ships Tier-1 scrapable + Tier-4 manual upload only**; Tier-2 WAF'd crawling deferred pending TDD amendment + legal review; Tier-3 FOI and Tier-5 partnership are v1.x/v2)
  - `rag` (fusion router + CRAG + generation → emits `RenderInput`; Retriever/Reranker ports per SC-5)
  - **`citation`** (SC-2: `(doc_id, span_start, span_end, content_hash)` schema + hash algo + emission/verification APIs; ADR-010)
  - **`render`** (SC-3: fail-closed gate, structurally separate from `rag`; ESLint boundary; AC-2)
  - **`eval`** (SC-1: TS orchestration + corpus + hooks + runner + per-stratum reporting + **render-time metrics** that run inside `render`)
  - **`adversary`** (SC-4: threat model + attack taxonomies + invariant definitions; ADR-013 formalism)
  - `observability` (OTel + pino + Prometheus + runtime invariant monitoring; ADR-012 OTel-vs-Langfuse)
  - **`editorial`** (AC-11: append-only event log + sign-off gate API; references the SC-7 gate artifact store)
  - **`lifecycle`** (SC-8: retention policies + snapshotting + tombstone semantics)
  - `config` (env + zod-validated runtime config; seams named per Winston — tier routing, model IDs, gate thresholds, feature flags, secrets)
- **`tools/`** — `eval` (SC-1: Python, containerized, Turborepo task node invoked via **subprocess/CLI**; DeepEval/RAGAS/Inspect + corpus-aggregate metrics + `krippendorff` α + red-team generators), `chaos` (SC-6: k6 + Playwright fault injection)
- **`eval/`** (repo-root content-addressed) — `corpus/<hash>/manifest.json` (frozen golden corpus), `gates/<corpus-hash>/` (SC-7: machine-verifiable gate artifacts)
- **`infra/`** — `docker-compose.yml` (root-level, ships in F1) + `grafana/` `prometheus/` `otel/`
- `turbo.json` `pnpm-workspace.yaml` `tsconfig.base.json` `.npmrc` (`node-linker=hoisted` for native AGE bindings)

**Architectural Decisions Provided by the Scaffold:**

**Language & Runtime:** TypeScript (strict) across all planes; shared zod schemas as the inter-module contract (TDD §4 contract-first rule). Node 22 runtime images (current line; Node 20 is active LTS — pin in ADR-001). Python (strict, `uv` + `ruff`/`mypy`) for `tools/eval` + `tools/chaos` (SC-1, SC-6).

**Monorepo Tooling:** Turborepo 2.9.x + pnpm 9.x workspaces; `tsconfig.base.json`; `turbo.json` task pipeline (build/test/lint/**eval**/**chaos** as gated tasks; Python tasks shell out to `uv`).

**Data Layer:** Single PostgreSQL 16 instance — relational (system of record) + pgvector 0.8.x (HNSW, `vector(1024)`, bge-m3) + Apache AGE ≥1.7.0 (openCypher; **SQL:PGQ does NOT exist in PG17/18 — AGE *is* the path**, ADR-002, committed single-path not "strike"). Extensions: `pg_trgm`, `uuid-ossp`. AGE bootstrap SQL + `create_graph('iip_graph')`.

**Styling / UI:** Tailwind 4.x + shadcn/ui; tiered graph rendering — Cytoscape.js 3.30.x (default) + React Flow 12.x (`@xyflow/react`, curated sub-views) + Sigma.js+graphology (>10K nodes, deferred trigger).

**Build Tooling:** Turborepo caching; Next.js build for `web`; tsup/tsc for `api`/`worker`; Vitest 2.x (unit/contract) + Testcontainers 10.x (integration) + Playwright 1.50.x (E2E) + **`tools/eval` Python harness (AC-1 libel-aware)** + **`tools/chaos` (AC-2 citation-render chaos)**.

**Code Organization:** Contract-first — any cross-module shape is defined in `packages/contracts` FIRST (zod), then producers/consumers implement against it. A type duplicated in two files is a defect (TDD §4). **AC-2 import boundary mechanically enforced** (SC-3): `render` imports only `@iip/contracts`; `rag` → `render` is one-way.

**Constraint-Envelope Compliance (the "first filter" per Winston, AC-3/AC-5):**
- **FOSS-only:** Apache-2.0 / MIT preferred; AGPL/Commons-Clause excluded (Neo4j Community disqualified — ADR-003).
- **Local-first single-host (transitional):** external deps accessed via interfaces per SC-5's scoped rule (interface swap-risk/cross-language/AC-seam deps; substrate direct).
- **Research-over-TDD ADRs seeded at scaffold (SC-9):** 15 ADRs — ADR-001 (Node 22 vs LTS 20), ADR-002 (Apache AGE — SQL:PGQ non-existent), ADR-003 (Neo4j license exclusion), ADR-004 (bge-m3 only — drop nomic-embed), ADR-005 (Qwen3-14B — supersede Qwen2.5/Llama-3.1), ADR-006 (Docling+PaddleOCR-VL — add OCR), ADR-007 (tiered ingestion — Firecrawl Tier-1 only; **Tier-2 Crawlee+stealth deferred from v1**), ADR-008 (NLI entailment gate — add citation engine), ADR-009 (monorepo orchestrator — Turborepo), ADR-010 (citation storage repr + hash algo), ADR-011 (golden-corpus versioning), ADR-012 (LLM observability — OTel vs Langfuse), ADR-013 (adversary formalism), ADR-014 (polyglot eval — subprocess not HTTP), ADR-015 (AGE raw-SQL escape in Drizzle).

**Note:** Project initialization (`pnpm create turbo` + refactor to the amended TDD §4 layout + root `infra/docker-compose.yml`) maps to **TDD Phase-0 task F1** and is the first implementation story. F1 is gated by the **concrete, assertable acceptance criteria in SC-10 (AC-F1-01…10)** — keystone AC-F1-05 (polyglot eval round-trip) and AC-F1-08 (render-gate ESLint boundary) are the make-or-break checks; skipping either forces a Step-4 rewrite.

## Core Architectural Decisions

> The bulk of IIP's architecture is already locked by the TDD, the validation research, the AC-1…AC-11 / PD-1…PD-3 / SC-1…SC-10 consensus, and the 15 seeded ADRs. This section records the **16 genuinely open decisions (D1…D16)** not settled upstream. All technology versions web-verified mid-June 2026.

### Decision Priority Analysis

**Critical (block implementation):** D1 (AGE DDL coexistence with Drizzle), D4 (HNSW/embedding-swap — AC-4), D5 (internal-period access posture), D9 (reverse proxy), D14 (CI/CD + self-hosted runner for eval/chaos gates), D15 (GPU for Ollama).
**Important (shape architecture):** D2 (read-model materialization), D3 (caching), D6 (adversary defenses), D8 (OpenAPI), D10 (no-SSE v1), D11 (client state), D13 (Citation UI), D16 (backup/restore).
**Deferred (post-MVP / open item):** SSE streaming for `/query` (v2 — D10 explicitly defers); formal retention policy (OQ-5 — D16 ties the owner, not the policy); per-stakeholder value map (v2 — per AC-9).

### Data Architecture

- **D1 — Relational + AGE DDL migration coexistence.** drizzle-kit manages relational migrations; AGE graph DDL (`create_graph`, vlabels/elabels, property indexes) lives in a **parallel versioned `infra/sql/age/`** set applied by a dedicated boot runner at startup. AGE is outside Drizzle's awareness; the two migration tracks are sequenced (relational first, AGE projection second) and the projection-determinism test (AC-6) gates their agreement. *Cascades: F-0 bootstrap order (TDD §16.2).*
- **D2 — Read-model materialization.** `timeline_events`, senator/entity dashboard, and evidence packages are **derived tables populated by worker agents** (Timeline Builder et al.), not SQL materialized views. Rationale: rebuildable + observable + AC-6-reproducible; as-of querying via bi-temporal `valid_from/valid_to`. Matches TDD's "AGE/Meilisearch are derived projections" invariant extended to read models.
- **D3 — Caching strategy.** Redis caches GET endpoints (entity, timeline, evidence, `graph/neighbors`) by content-hash key, short TTL 60–300s. `/query` is NOT cached except identical-recent-question keyed by normalized text (TDD §14.3 — latency never bought by dropping the citation gate). Invalidation hooks on graph rebuild + AC-11 retraction/supersession events (editorial log event → cache-bust).
- **D4 — HNSW maintenance + embedding swap (AC-4).** Build HNSW after bulk load; incremental inserts thereafter. On embedding-model swap: **shadow re-index + diff + atomic alias swap** — citations remain valid throughout because they bind to spans (`content_hash`), not vectors. Reproducible candidate set requires a *frozen index snapshot* + fixed `ef_search` (AC-6).

### Authentication & Security

- **D5 — Access posture during the internal period.** The API is **NOT public during the internal period** — gated behind the reverse proxy (IP allowlist + shared bearer token issued to the presentation audience). It goes truly public **only after PD-3 Gate passes**. This reconciles NFR-S-1 (a launch posture, read-only public) with the internal-first reality and the team's personal criminal-exposure concern.
- **D6 — Adversary defenses (AC-10).** **Caddy** reverse proxy (rate-limit + auto-TLS + basic DDoS absorption). **Citation-poisoning detection** = SC-2 `content_hash` verification at the AC-2 render gate + a lineage-anomaly metric in `packages/observability` (unexpected provenance drift on a canonical entity). **Disinformation-injection defense** = the PD-3 editorial Gate + FR-1.1 confirmed trust tiers + provenance on every assertion. The threat catalogue lives in `packages/adversary` (SC-4, ADR-013).
- **D7 — Secrets management.** **sops 3.x + age 1.x** for at-rest encrypted secret files in the repo; env-injected at runtime via `packages/config`; the process refuses to start on invalid config (NFR-S-4). No plaintext secrets in git; `.env.example` documents every key.

### API & Communication Patterns

- **D8 — API documentation.** **OpenAPI 3.1** generated from the Fastify JSON Schema via `@fastify/swagger` (schema-first → spec is a derived artifact, not hand-written). Spec committed to repo; a contract test asserts spec ↔ `packages/contracts` zod on every PR (no drift).
- **D9 — Reverse proxy.** **Caddy 2.8.x** in front of `api` + `web`. Auto-HTTPS (ACME/Let's Encrypt) with a few lines of Caddyfile — the 2026 single-host Compose sweet spot (Traefik overkill for one host; nginx lacks built-in ACME). Sits inside `infra/docker-compose.yml`.
- **D10 — Streaming.** v1 `/query` returns a **complete `QueryAnswer`** (no SSE streaming). Rationale: simpler contract, deterministic for the AC-1 eval harness and PD-3 gate-time re-run. LangGraph streaming stays internal to the worker. **SSE deferred to v2.**

### Frontend Architecture

- **D11 — Client state.** **React Query 5.x (server state) + Zustand 5.x (ephemeral interaction: graph node selection, timeline filters, citation modal state, chat draft) + nuqs 2.x (URL-shareable: active entity, time range, view mode)** — the 2026 Next.js 15 App Router consensus. Zustand kept intentionally small (interaction only, not data fetching).
- **D12 — Data fetching.** RSC `fetch` to `/api/v1` in server components for the initial payload (heavy data-dense pages: graph, timeline); React Query for client-side mutations/refetches. No tRPC — the Fastify REST contract (validated by `packages/contracts`) is the single source of truth.
- **D13 — Citation UI component.** `<Citation>` component keyed to block index → opens a doc-viewer modal scrolled to the anchored span (cite span = `content_hash`-bound per SC-2/AC-4). Fact/claim visual distinction via shadcn variants. The PD-1 essence sentence (*"Every claim IIP shows you cites a source you can open — or IIP shows you nothing."*) must render verifiably on every answer surface.

### Infrastructure & Deployment

- **D14 — CI/CD.** **GitHub Actions with a self-hosted runner** on the build workstation (required: AGE + pgvector + MinIO testcontainers + GPU for the eval smoke). Workflows: `build` / `test` (Vitest) / `lint` / `typecheck` / **`eval` gate (AC-1)** / **`chaos` gate (SC-6)** / `adr-lint` (every divergence cites research evidence — AC-5). Branch protection blocks merge on red; hard gates non-relaxable.
- **D15 — GPU provisioning for Ollama.** Host GPU passthrough to the `ollama` container — **NVIDIA Container Toolkit** on a Linux build host (RTX 4090 24GB or RTX 6000 Ada 48GB per research) or **MLX/Metal** on a Mac Studio M3 Ultra. Models pre-pulled at first boot; model IDs are config, not code (TDD §13.3).
- **D16 — Backup & restore.** **Postgres `pg_dump` nightly + WAL archiving** (Postgres is the sole stateful system of record — AC-6/SC-8); **MinIO versioned append-only bucket** for raw snapshots (off the serving path). Restore-test cadence = monthly. Retention *policy* remains an open item (OQ-5); the **owner** is `packages/lifecycle` (SC-8).

### Decision Impact Analysis

**Implementation sequence (dependency order):**
F1 (scaffold + infra/compose + ADRs + polyglot eval seam + render-gate ESLint) → F3 (Postgres+pgvector+AGE compose + AGE boot runner = D1) → F4 (Drizzle schema + AC-4 citation storage = SC-2/ADR-010) → F5 (AGE client + projection) → P1–P3 (source registry + Collector tiered = D6 ingestion defenses; **v1 ships Firecrawl Tier-1 + manual upload only**) → P4–P5 (Analyst chunking/embed/extraction = D4 HNSW) → P6–P7 (Graph Builder + AC-2 render gate = D13) → P8 (RAG fusion + CRAG + citation engine) → P10 (API + D8 OpenAPI + D9 Caddy + D5 allowlist) → P11–P13 (web: chat + graph + timeline, D11/D12/D13) → P14 (eval harness + SC-1 polyglot + SC-6 chaos + D14 CI gates) → D1.x (senator dashboard) → PD-3 Gate before any external exposure.

**v1 ingestion scope note:** Tier-2 (Crawlee + Playwright + stealth + residential proxy for WAF'd government sites) is scaffolded as an adapter interface but **deferred from v1 implementation** pending legal review of the public-interest reporting justification and approval of proxy/residential-IP infrastructure. Tier-3 (FOI via Alaveteli) and Tier-5 (partnership SFTP drops) are v1.x/v2. v1 relies on Tier-1 scrapable sources (Official Gazette when accessible, GMA News, Rappler, Reuters, Lawphil) plus Tier-4 manual uploads for House, Senate, SC, PNA, ABS-CBN, and other blocked sources.

**Cross-component dependencies (the load-bearing ones):**
- **AC-4 (citation-decoupled) ↔ SC-2 (`packages/citation`) ↔ D4 (embedding swap) ↔ D13 (Citation UI):** the citation tuple is produced in ingest, stored via SC-2, verified at the AC-2 render gate, survives D4 re-embeds, and renders in D13's `<Citation>`. A break anywhere on this chain is a P0 libel defect.
- **D9 (Caddy) ↔ D5 (allowlist) ↔ D6 (adversary):** the reverse proxy is the single ingress enforcing access + rate-limit + TLS — one control point, three concerns.
- **D1 (AGE DDL runner) ↔ D14 (self-hosted runner) ↔ SC-1 (polyglot eval):** CI must stand up AGE + pgvector + MinIO + Python eval together; the runner choice is forced by the test topology, not preference.
- **AC-2 (fail-closed render) ↔ SC-3 (ESLint boundary) ↔ D10 (no-SSE) ↔ SC-6 (chaos):** the render gate's enforceability depends on a structural boundary, a deterministic (non-streamed) contract, and a chaos test that proves it holds under load.
- **PD-3 Gate ↔ SC-7 (gate artifact store) ↔ D5 (access posture):** the gate produces hash-bound artifacts; access flips from allowlist to public only on a passed gate decision.

## Party-Mode Consensus (Step 4 — Security Round, 🏗️ Winston · 💻 Amelia · 🧪 Murat)

The security cluster (D5/D6/D7) was red-teamed and found undersized by a full tier against the actual adversary (AC-10 = a Philippine senator with coordinated-inauthentic-behavior networks + rent-a-botnet budget = organized with state-aligned optionality). The cluster's central error — treating access (D5) and adversary (D6) as separate concerns when both are subordinate to **content provenance as the primary control** — is corrected here. The following security consensus amendments (SEC-1…SEC-9) are **binding and supersede the corresponding clauses of D5/D6/D7**. (Access limits the audience; provenance limits the liability. In a criminal-cyberlibel jurisdiction with named sign-offs, provenance is the load-bearing wall.)

- **SEC-1 (Per-issued JWT auth — supersedes D5's "shared bearer token").** Signed JWTs (kid + exp ≤1h + jti + scope); validation in **Fastify middleware `packages/auth/verify.ts`** (NOT Caddy — the edge can't do jti-revocation lookup or kid-rotation without external calls); jti revocation list + replay detection, revocation → AC-11 entry `auth.revoked`; every authenticated request resolves to a `principal {kid,sub,scope,jti,iat}`; ESLint boundary (no handler reads `req.auth` directly — only `req.principal` populated by middleware). AC-AUTH-1…4. **Rationale:** the shared bearer token destroyed attribution, revocation, and per-principal abuse signals — and in a system where teammates face personal criminal exposure, **collective attribution = collective liability**. The audit log is the team's affirmative defense; shared tokens make it hearsay. Cost delta ~3–4 dev-days.
- **SEC-2 (Code-enforced two-person intake — supersedes D6's policy-only "two-person review").** `packages/intake` state machine: `staging → reviewed_once → approved → extracting → indexed`; two DISTINCT principals sign Ed25519 over `content_hash` (reviewer → `reviewed_once`; different-`sub` approver → `approved`); the extraction worker **hard-refuses** any doc not in `approved` (throws + AC-11 entry `intake.bypass_attempt`); Tier-5 (partnership) additionally requires a partner provenance signature verified against a pinned keyring (fail-closed on unknown key). AC-INTAKE-1…5. **Mutation-test target:** flip the state check in `apps/workers/extract/worker.ts` → every extract test must fail red. **Rationale:** `content_hash` verifies integrity (rendered == stored), NOT authenticity (stored == true). Policy levers don't survive pressure (S5×P3 = P0).
- **SEC-3 (Provenance at ingest — supersedes D6's vague "lineage-anomaly metric").** Trust tier assigned AT INGEST, persisted on the node, travels with every graph edge; single-source sensitivity is a structural graph property (an allegation about Senator X with exactly one Tier-4 source must surface an "uncorroborated, single manual source" provenance string that **survives the RAG pipeline end-to-end** — prompt + output-parser contract, enforced in tests; AC-4 does double duty: tier is metadata, not embedding, so it can't be lost in retrieval); provenance check at ingest (credible publisher / verifiable signature or URL; Tier-4 without provenance = REJECT); cross-source corroboration requirement for load-bearing claims. **The "lineage-anomaly metric" is DROPPED as theatre** (anomaly detection without a baseline has ≈100% false-negative rate on slow deliberate poisoning) — **replaced by concrete zero-tolerance Prometheus rules** (`iip_lineage_chunks_missing_doc_total`, `iip_lineage_hash_collision_total`, `iip_lineage_orphan_citations_total`, `iip_lineage_unapproved_extracted_total`) computed by a nightly reconciliation job `apps/workers/audit/lineage_reconcile.ts`, alert `for: 0s` severity critical `defamation_risk: "true"`, **nonzero → deploy blocked at PD-3 G8**.
- **SEC-4 (Runner isolation — fixes the D7+D14 P0 supply-chain hole).** The self-hosted runner is **NOT on the corpus/GPU workstation** (separate box/VM, no `/corpus` mount, no `~/.config/sops/age/keys.txt` — `infra/runner/provision.pkr.hcl`); PR-triggered runs are **secret-less ephemeral containers** with restricted egress (network policy allows only named CI registries); secret access requires merged commit OR `secrets-ok` label + `@security` CODEOWNER approval; **OIDC ephemeral tokens (≤1h) replace persistent sops keys** (`actions/oidc` → STS → 1h token; sops decrypts with it, never persists; `infra/oidc/role-trust.json` with `sub` pinned to repo+branch+workflow); signed commits required for any prod-touching build; **the AGE decryption key lives on the deploy runner only, behind a hardware token or separate keystore.** AC-RUN-1…4. **Rationale:** D7 (sops+age) protects at-rest; it does NOTHING for runtime. Current D7+D14 = untrusted code with prod secrets + corpus on the same host = **RCE-as-CI** (Codecov/Solarwinds in miniature).
- **SEC-5 (Continuous AC-2 gating — internal + external).** The AC-2 fail-closed render gate fires on **EVERY render, internal or external**, with a stricter threshold for external. **PD-3 is the external-readiness sign-off, NOT the first time the gate runs** — the internal period is not liability-free (a teammate who sees an allegation-as-fact rendered internally is a republication audience). **Fail-closed under load:** if backing services degrade, the render refuses to serve — **unavailable > wrong.**
- **SEC-6 (Hash-chained + externally-witnessed AC-11 — the personal-criminal-exposure defense).** Append-only **hash-chained** editorial log (each entry includes the hash of the previous); each entry signed by the acting principal's key (NOT "the team bearer"); periodic root hash published to an external tamper-evident location (RFC 3161 trusted timestamping OR a read-only public mirror). For any published claim the team can regenerate + bit-for-bit verify the complete citation package. **Counsel review path is tiered** (redacted summaries first, full content only on documented need-to-know — counsel must not become another republisher in the chain). **Rationale:** in a defamation inquiry under RA 10175, the team's defense is *"cryptographic evidence of who published what, when, with what review"*; without SEC-6, the defense is "trust us" — not a defense in a PH court.
- **SEC-7 (Insider/coercion as first-class — spans SEC-2 + SEC-6).** Threat: a coerced or careless teammate (S5×P3 = P0) — the threat the original cluster was structurally blind to and the one most likely to actually fire. Controls: rotating reviewer pool (no fixed pair to compromise); reviewer disagreement → escalation, not silent acceptance; **insider/coercion tabletop exercise** as a documented recurring control (walk through a coerced teammate — what fails? output a gap list). **Team-comms-as-republishers** documented as policy (Slack/Gmail/Notion discussing allegation-as-content are exfil paths + additional republication surfaces).
- **SEC-8 (Red-team + mutation suite for the security cluster — extends SC-6).** `tests/redteam/*` (auth.chaos, intake.bypass, intake.same-signer, lineage.integrity, runner.exfil, render.auth-bypass, secrets.oidc). **Stryker mutation tests — 100% mutation score on `packages/render/gate.ts` + `packages/auth/verify.ts` (blocks merge <100%)**, ≥90% on `packages/citation/verify.ts`, `packages/intake/state.ts`, `apps/workers/extract/worker.ts`. **Evals (all block PD-3):** libel-injection red-team (<0.1% defamatory output; <0.01% with mandatory human spot-check on the long tail) — 100+ plausible-but-defamatory statements exploiting RAG failure modes (context conflation, source mixing, ambiguous pronouns, temporal confusion); slow-poisoning eval (<7-day time-to-detection on a simulated 90-day, one-poisoned-doc-per-week attack); republication-framing eval (allegation-as-fact detection, the Disini trap); adversarial-query eval (0% jailbreak success on canonical entities, post-PD-3); source-attribution eval (no Tier-4 contributor deanonymization above chance — retaliation protection); tamper eval (canonical-entity modification caught by audit log + blocked by render gate + attributed by signed-action log). Insider/coercion tabletop = P0, not code.
- **SEC-9 (Honest DDoS posture).** Caddy rate-limit = **OWASP-class noise control, NOT state-aligned DDoS defense** — documented as such (do not list auto-TLS/rate-limit as "controls" against AC-10; that inflates the inventory). Real absorption needs an edge (Cloudflare/Akamai-class), but routing PH political content through a US CDN raises sovereignty/surveillance questions → **open item, ADR candidate**. The architecture's actual answer to a state-aligned volume attack is **fail-closed under load** (SEC-5): the system becomes unavailable rather than serving degraded/wrong content.

### Revised D5 / D6 / D7 (superseded clauses)

- **D5 (revised):** Access posture = attack-surface reduction + **audience attribution / non-repudiation** (the existential control). Per SEC-1: per-issued JWTs (NOT shared bearer); per SEC-4: behind Caddy with a sandboxed runner. NOT liability prevention (provenance is). The API is not public during the internal period; flips to public only on a passed PD-3 gate decision.
- **D6 (revised):** Adversary defenses = **ingest-time provenance tiering (SEC-3) + code-enforced two-person intake (SEC-2) + continuous AC-2 gating (SEC-5)** are the load-bearing controls. Caddy rate-limit is reclassified as OWASP-noise (SEC-9). The theatre lineage-anomaly metric is replaced (SEC-3). DDoS vs a state-aligned actor is honestly concede-and-fail-closed (SEC-5/SEC-9).
- **D7 (revised):** Secrets = sops+age at-rest (unchanged) **PLUS** SEC-4 runner isolation + OIDC ephemeral tokens + AGE-key protection. The at-rest/at-use distinction is now explicit.

## Party-Mode Consensus (Step 5 — Patterns Round, 💻 Amelia · 📚 Paige · 🏗️ Winston)

The drafted Implementation Patterns section was reviewed and found to be "a style guide cosplaying as a contract" — many "MUST" rules lacked enforcement, six architectural patterns were missing, and the documentation contract layer (ADR template, glossary, cross-references) was absent. The following pattern consensus amendments (PC-1…PC-9) are binding. Thread: **if a rule can't be linted, linked, or diagrammed, it isn't a rule — it's a hope.** Defamation-grade systems can't run on hope.

- **PC-1 (Mechanical enforcement promotion).** Six rules promoted to CI-enforced MUSTs with named helpers/wrappers; the rest of the drafted "MUST"s demoted to a Guidelines doc. (a) Drizzle upsert via `packages/db/src/upsert.ts` (`upsertLastWriteWins` / `upsertFirstWriteWins` — policy pinned per dedupe anchor); (b) multi-writes via `packages/db/src/tx.ts → withTx(fn)` (lint-ban raw `BEGIN`/`COMMIT` + sequential awaits outside `withTx`); (c) LangGraph nodes kebab-case + `Annotation.Root` state + state keys declared in `packages/contracts/src/graph-state.ts` before any node file; (d) BullMQ job name `<domain>:<action>` + `jobId` = sha256(dedupe-anchor) + backoff config in `packages/config/src/queues.ts`; (e) AGE Cypher via ONE wrapper `packages/graph/src/cypher.ts → cypher(graph, query, params)` (lint-ban raw `ag_catalog.cypher(` — catches the `$id`-inside-`$$` positional-binding footgun that "parameterized queries only" misses); (f) citation emitted **synchronously in render** via `citation.emit(span, source)` (no async/side-channel). Rule of thumb: if you can't write a failing test for it, it's documentation.
- **PC-2 (Six architectural patterns as binding contracts).** (1) **LLM Router** — `Route<T>` in `routes.config.ts` with a stamped envelope `{output, modelId, promptVersion, schemaVersion, latencyMs, confidence}` persisted as `extractor_version`; a `verify` clause for confidence-routed verification (Qwen3 drafts → Claude verifies); **explicit `fallback` array only — no implicit cloud escalation; a Route with no `fallback` hard-fails when `preferred` is unavailable** (AC-2 provenance: we must prove which model ran). (2) **Retrieval Fusion** — `Retriever` port + `FusionPlan { intent, retrieverIds, strategy, k }`; Query Planner never imports retrievers directly; weights config-keyed by intent (callers pass `intent`, never a weights object — else AC-2 reproducibility dies on the first hot-tune); CRAG = post-fusion LangGraph node (the only ranking mutator, by replacement not in-place reorder); HippoRAG = Query-Planner tool (consumes the fused list, not a 4th retriever). (3) **Conservative Entity-Merge** — Resolver owns the decision; LLM strictly advisory (emits `{candidateId | null, score}`); `confidence_bar` config, per-type-overridable, **0.45 floor raise-only** (the conservative invariant); adding an `entity_type` is config + index, no Resolver code change. (4) **Worker/Concurrency** — one queue per stage `{domain}:queue` (`extract:queue`, `resolve:queue`, `canonical:queue`, `graph:queue`, `cite:queue`); **event-driven Enqueuer handoff** (stages emit `stage.completed`, a single Enqueuer listens and enqueues next — no inline enqueue, which loses the chain on crash and scatters the DAG); DLQs first-class + pager-able, never silently drained; LangGraph state checkpointed per node in `job_runs.state_run_id` (resume from last checkpoint). (5) **AGE Projection** — labels 1:1 with canonical relational `entity_type`/`relation_type` (no staging enrichment, no LLM-derived props — AGE is a projection, not a store); add via `projection.config.ts` + a determinism fixture (project twice, diff empty); AGE write is **drop + rebuild per affected partition**, NOT incremental upsert (bounded drift vs unbounded reconciliation). (6) **Config Surface** — `@iip/config` zod-validated at boot is the ONLY place env vars are read; output-affecting knobs (model IDs, thresholds, k, fusion weights) **stamped into `extractor_version`**; **business-critical knobs versioned in a `config_history` table** (proves threshold-at-time-T for AC-2 reproducibility — env vars don't).
- **PC-3 (ADR template — binding).** Nygard-adapted. Frontmatter: `id, title, status (Proposed|Accepted|Superseded|Deprecated), date, supersedes, superseded_by, deciders, related, evidence[]`. Sections: Context / Decision (one paragraph, imperative) / Alternatives (each considered, each with rejection reason) / Consequences (positive + negative + neutral, separated) / Open questions (explicit, dated). Filename `docs/adr/NNNN-kebab-title.md`, zero-padded, **1:1 with SC-9's seed list**, **no renumbering ever** (supersede — the trail is the point of AC-5). **`evidence:` YAML array required to flip Proposed → Accepted** (no cited evidence, no acceptance — an ADR without evidence is a feeling). **`related:` mandatory + machine-validated by adr-lint** (bidirectional — every cited AC/SC/D must exist; every AC/SC/D that necessitates an ADR must back-reference it). One ADR per divergence, not per topic.
- **PC-4 (Glossary — binding, lint-enforced).** `docs/glossary.md` is the ONLY place terms are defined (CitationTuple, renderGate, fail-closed gate, provenance, lineage, gate artifact, dedupe anchor, extractor_version, Route, FusionPlan, Resolver, Enqueuer, …); each entry has Type / Definition / Owner / Aliases / **Do-not-confuse-with** (the load-bearing field — glossaries fail when adjacent terms blur). **Markdown-lint: any glossary term used in a `.md` must be linked on first-use — unlinked first-use = CI failure.** New term → glossary entry in the same PR; entries versioned with `supersedes` discipline like ADRs. Disambiguation: **`renderGate` = the code unit** (`packages/render/gate.ts`); **"fail-closed gate" = the pattern**.
- **PC-5 (Cross-referencing as lint rule).** `/** @rules AC-2, SC-10, SEC-2 @adr ADR-0007 */` docblock in every gate test; `// diverges — see ADR-NNNN` after every divergence comment (no bare "see ADR" — the number is the contract); `Rules:` line atop every pattern example. ESLint/markdown-lint custom rules enforce: test files require ≥1 `@rules` tag; source files containing `// diverges` must be followed by `ADR-\d{4}`.
- **PC-6 (Five Mermaid diagrams replace prose).** citation-flow across packages (**sequence**); AC-11 event chain (**sequence**); polyglot schema generation zod→OpenAPI→pydantic (**data-flow**); gate-artifact lifecycle Proposed→Accepted→Superseded (**state-machine**); render-gate decision logic / fail-closed branches (**flowchart**). Mermaid (renders in markdown, lives in git, lintable via `mermaid-cli`); every node/edge label = a glossary term verbatim (no synonyms in diagrams).
- **PC-7 (Pattern Index + Start-Here tree — build first).** `docs/pattern-index.md` table: `| If you're touching… | Role | You MUST follow | You MUST cite |` (e.g., `packages/contracts/**` → Schema author → Contract-first per-entity rule, filename convention → AC-1, SC-1, ADR-0007). Start-Here Mermaid decision tree at the top ("What are you doing?" → "Which rules apply?" → "Which ADRs constrain you?"). Build the index FIRST — rows with empty "MUST follow" cells surface the remaining work items.
- **PC-8 (Polyglot behavior patterns — beyond shape generation).** `zod → JSON Schema → pydantic` unifies shape, not behavior. Python uses **`structlog`** with a pino-compatible JSON renderer (lint-ban stdlib `logging` direct calls — freeform logs can't join pino JSON). **Canonical error shape** in `packages/contracts/src/error.ts` + pydantic mirror (ban raw pydantic ValidationError serialization at the boundary — it doesn't match the zod error shape). **UTC helpers only** (`packages/contracts/src/time.ts → now()` TS; `tools/common/time.py → now()` Python; lint-ban `utcnow`/naive `new Date()` in domain code). Confidence = **string transport OR Decimal-aware compare** both sides (zod `number()` is float; pydantic `condecimal` is Decimal — equality/rounding diverge). **Absent-only optionals** (zod `.optional()` = key may be absent; pydantic `Optional[T]` = present-with-None — pin absent-only, ban explicit `null` in contracts). pytest fixtures `<entity>_factory` mirroring TS factories.
- **PC-9 (Test-pattern completeness).** Shared factories `packages/test-utils/src/factories/` (one `make<Entity>()` per zod schema, generated; lint-ban ad-hoc object literals in tests). Mock boundaries: DB/MinIO/AGE = testcontainers real; Ollama = recorded VCR cassettes in `tests/cassettes/` (no live network in CI); no in-memory pg substitute. Snapshots: `.toMatchFileSnapshot()` to `__snapshots__/` only (inline banned; update = labeled commit `test: update snapshots`). Contract tests: `packages/contracts/src/__contract-tests__/` (zod↔pydantic↔JSON Schema round-trip per CI). Stryker per-package `stryker.config.json` (100% on `render/gate.ts` + `auth/verify.ts`; ≥90% others). Red-team eval = nightly with hard-fail on regression >N% (PRs blocked only on adversarial delta). Integration DB = per-suite container + TRUNCATE between tests. **"No uncited path" property test**: fuzz every `render.*` export, assert every emitted span has non-null `citation.source_id`. **AC-11 hash-chain concurrent-writer test**: N BullMQ jobs, assert chain unbroken, no orphans.

## Implementation Patterns & Consistency Rules

> This section codifies the IIP-specific consistency rules that prevent multi-agent implementation conflicts. Per the Step-5 consensus, **only mechanically-enforceable rules are MUSTs** (PC-1); the rest are Guidelines. Authority for any rule that restates a binding amendment remains the cited AC/SC/SEC/PD identifier.

### Naming Patterns

**Database (Postgres):** `snake_case` tables/columns (TDD §5.2 — `sources`, `ingestion_jobs`, `content_checksum`, `source_entity_id`). UUID PKs via `gen_random_uuid()`. FKs = `<entity>_id`. Indexes = `idx_<table>_<cols>`; uniqueness = `uq_<table>_<cols>`. CHECK-constraint enums kept in sync with `packages/contracts` zod. **Drizzle schema single-source:** only `packages/db/src/schema/**/*.ts` (lint-ban table defs elsewhere).
**Apache AGE:** node + edge labels **UPPERCASE** matching the type (`PERSON`, `VOTED_AGAINST`); each node carries its relational `id`. Named graph = `iip_graph`.
**TypeScript / JSON API:** `camelCase` identifiers/functions/zod fields/JSON keys; `PascalCase` types/zod schemas; `kebab-case.ts` modules; `PascalCase.tsx` React components. **Contract filename convention (PC-4/PC-7):** `packages/contracts/src/<domain>/<EntityName>.ts`, one primary schema per file, filename = exported schema name.
**Python (`tools/eval`, `tools/chaos`):** `snake_case` (PEP 8). **Polyglot bridge (SC-1):** TS zod is source of truth → `datamodel-code-generator` emits JSON Schema → pydantic in CI. Agents MUST NEVER hand-write pydantic models that mirror zod schemas.
**Events (AC-11 log):** dotted lowercase `domain.action` — `auth.revoked`, `intake.bypass_attempt`, `intake.approved`, `verification.spot`, `editorial.signoff`, `legal.clearance`, `external.verification.observed`, `render.violation`, `retraction.superseded`, `stage.completed`. Each carries `{event, principal, ts, corpus_hash?, details}`.

### Structure Patterns

**Monorepo layout** = amended TDD §4 (apps/{api,worker,web}; packages/{db,contracts,graph,llm,ingest,rag,**citation**,**render**,eval,**adversary**,observability,**editorial**,**lifecycle**,config,**auth**}; tools/{eval,chaos}; eval/{corpus,gates}; infra/).
**Contract-first (PC-4 granularity):** *per-entity* — define the zod schema in `packages/contracts` BEFORE producers/consumers; one primary schema per file; composite contracts live in the same domain folder; only the canonical file owns the schema (derived `z.infer`/`.extend()` are NOT defects — duplicate sources are).
**Tests:** co-located `*.test.ts` (Vitest unit/contract); `tests/integration/` (Testcontainers); `tests/e2e/` (Playwright); `tests/redteam/` (SEC-8); `tools/eval/tests/` (pytest); `tools/chaos/` (k6 + Playwright). Factories in `packages/test-utils/src/factories/` (PC-9). Eval fixtures `eval/corpus/golden/v<N>/`; gate artifacts `eval/gates/<corpus-hash>/` (SC-7).
**Import boundaries (ESLint `no-restricted-imports`, mechanically enforced):** `packages/render` imports ONLY `@iip/contracts` (SC-3); `packages/rag` may NOT import `@iip/render`; `apps/api` handlers may NOT read `req.auth` — only `req.principal` (SEC-1); LangGraph imports pinned to `packages/rag`. **Architectural pattern bans (PC-2):** `ollama`/`@anthropic-ai/sdk` only via `@iip/llm-router`; `new Queue(` only via `@iip/queues`; `process.env` only in `@iip/config`; AGE writes only in `@iip/graph-builder`; raw `ag_catalog.cypher(` banned outside `packages/graph/src/cypher.ts`.

### Format Patterns

**API envelope:** success = resource directly (or `{data, nextCursor?}` paginated); error = `{error:{code, message, details?}}`, `code ∈ {bad_request, not_found, rate_limited, unprocessable, internal}`. No stack traces in responses.
**Dates/times:** TIMESTAMPTZ UTC in Postgres; ISO-8601 UTC in JSON. Timeline events carry `date_precision ∈ {day, month, year, approx}` (FR-4.1). **UTC helpers only** (PC-8) — `created_at` source-of-truth = DB `defaultNow()`; app may not send timestamps.
**IDs/confidence:** UUID v4 everywhere. Confidences = `NUMERIC(4,3)` in [0,1] **and** TS `z.number().min(0).max(1).multipleOf(0.001)` (PC-1 — zod alone doesn't enforce range). Confidence rounding pinned at contract parse (`z.number().transform(round3)`).
**Citation tuple (SC-2 / AC-4):** `(source_doc_id, span_start, span_end, content_hash)` — emitted synchronously in render via `@iip/citation` (PC-1f).

### Communication Patterns

**Inter-agent:** agents communicate **ONLY via DB + queue** (TDD §11) — enforced by `no-restricted-imports` banning `node:net`/`undici`/`fetch` outside `packages/llm/src/` + `apps/api/src/routes/` (PC-1). Job contracts in `packages/contracts/queue.ts` (shared api+worker, no duplication).
**Queues/jobs (PC-1d, PC-2.4):** one queue per stage `{domain}:queue`; job name `<domain>:<action>`; `jobId` = sha256(dedupe-anchor); backoff in `packages/config/src/queues.ts`; **event-driven Enqueuer handoff** (no inline enqueue); DLQs `dlq:{domain}` first-class + pager-able; LangGraph state checkpointed per node. Typed failure taxonomy (TDD §11.3).
**Editorial log (AC-11):** append-only, **hash-chained** (SEC-6); each entry signed by acting principal; periodic root hash externally witnessed. Read path projects from the log. The SC-7 gate artifact store is distinct (machine-verifiable, corpus-hash-bound) — the editorial log *references* it.

### Process Patterns (the enforced MUSTs per PC-1, plus architectural contracts per PC-2)

1. **Contract-first:** define zod in `packages/contracts` BEFORE any producer/consumer. (Guideline-level unless import-order lint is wired.)
2. **Route every served claim through `packages/render`** (SC-3 ESLint boundary; AC-2).
3. **Emit/attach/verify citations via `@iip/citation`** — synchronously in render (PC-1f); never re-implement the tuple or hash.
4. **`ON CONFLICT ... DO UPDATE` on dedupe anchors** via `packages/db/src/upsert.ts` helpers (PC-1a); blind inserts are a defect.
5. **Multi-writes via `withTx(fn)`** (PC-1b); raw `BEGIN`/`COMMIT` + sequential awaits outside `withTx` are lint-banned.
6. **Fail-closed defaults (AC-2 / SEC-5):** citation support < threshold → WITHHOLD; entity unresolved → hold in staging; retrieval empty → `noEvidence: true`; backing service degraded under load → refuse to serve. **Unavailability > wrongness.**
7. **Parameterize all SQL/Cypher** — SQL via Drizzle; **AGE Cypher only via `packages/graph/src/cypher.ts → cypher()`** (PC-1e — the `$id`-in-`$$` footgun is otherwise an injection vector); validate UUIDs from user input. String-built queries = P0.
8. **LLM calls only via `@iip/llm-router`** with a `Route<T>` (PC-2.1); stamp `extractor_version` on every extraction row (model + prompt + schema version); output-affecting config knobs stamped into the version.
9. **Entity resolution via Resolver (PC-2.3)** — LLM advisory only; `score < confidence_bar` → create new (0.45 floor, raise-only).
10. **Config via `@iip/config` only** (PC-2.6); env reads elsewhere = CI lint error; business-critical knobs versioned in `config_history`.
11. **Logging via pino** (TS) / `structlog` pino-compatible (Python, PC-8); `document_id`/`job_id`/`trace_id` on every line; no PII beyond what sources publish.
12. **Source-verb preservation (EI-3)** — verbatim from extraction; never paraphrased; enforced by prompt contract + output-parser + render-time test.
13. **Record every editorial/auth/intake action in the AC-11 hash-chained log** (SEC-6).
14. **Cite research evidence in an ADR for any divergence from the TDD** (AC-5/SC-9/PC-3).

### Enforcement

- **CI lint:** ESLint `no-restricted-imports` boundaries (SC-3, SEC-1, PC-2 bans); markdown-lint glossary link-on-first-use (PC-4); `@rules`/`ADR-NNNN` cross-ref rules (PC-5); `mermaid-cli` syntax (PC-6); adr-lint (PC-3: `evidence:` required for Accepted, `related:` bidirectional).
- **Tests:** contract tests (zod↔OpenAPI↔pydantic round-trip); Stryker mutation (100% `render/gate.ts` + `auth/verify.ts`, ≥90% others — PC-9); red-team/chaos/eval gates (AC-1/SC-6/SEC-8); the "no uncited path" property test (fuzz render exports → every span has `citation.source_id`); the AC-11 hash-chain concurrent-writer test (PC-9).
- **Process:** a PR that weakens a hard gate to pass is **rejected, not merged** (TDD §18; AC-2). Pattern violations → issues tagged `pattern-violation`.

### Pattern Examples (good) and Anti-Patterns (avoid)

*(Each example carries a `Rules:` line per PC-5.)*

**Good (Rules: AC-2, SC-2, SC-3, PC-1f):** `packages/render/gate.ts` calls `verifyCitation(renderInput)` from `@iip/citation` and throws `RenderViolation` on any claim lacking an entailment-passing citation; the API handler returns `noEvidence: true`.
**Anti-pattern:** an API handler that builds an answer inline, attaches a footnote, and returns it — bypassing the render gate. (P0; blocked by SC-3 ESLint.)

**Good (Rules: SEC-2, PC-1):** `apps/workers/extract/worker.ts` checks `doc.state === 'approved'` and throws on anything else, logging `intake.bypass_attempt` to AC-11.
**Anti-pattern:** a worker that "helpfully" extracts a `reviewed_once` doc to save time. (P0; SEC-2; mutation-tested.)

**Good (Rules: PC-1a, TDD §5.2):** `await upsertLastWriteWins(documents, row, documents.contentChecksum)` from `@iip/db/upsert`.
**Anti-pattern:** `await db.insert(documents).values(...)` without conflict handling. (Idempotency violation; lint-banned.)

**Good (Rules: PC-1e, NFR-S-2):** `cypher('iip_graph', $$ MATCH (n:PERSON) WHERE n.id = $id RETURN n $$, { id })` via `@iip/graph/cypher`.
**Anti-pattern:** `$$ MATCH (n) WHERE n.id = '${id}' RETURN n $$`. (Injection; lint-banned.)

**Good (Rules: PC-2.4):** extract stage emits `stage.completed { runId }`; the Enqueuer listens and enqueues `resolve:queue`.
**Anti-pattern:** the extract handler calls `resolveQueue.add(...)` at the end of its function. (Loses the chain on crash; banned.)

**Good (Rules: SEC-6, PC-4):** AC-11 entry `{event:'editorial.signoff', principal:'mary@iip', ts, corpusHash:'sha256:...', prevHash:'sha256:...', signature:'ed25519:...'}`.
**Anti-pattern:** `{type:'signoff', user:'mary', time:'yesterday'}`. (Event-naming + attribution + hash-chain violations.)

## Party-Mode Consensus (Step 6 — Structure Round, 💻 Amelia · 🏗️ Winston · 🎨 Sally)

The drafted project structure was reviewed and corrected on three layers: process boundaries (the AC-3-forced separation that package boundaries alone don't deliver), package granularity (18 was over-decomposed for a small team), and the frontend journey/invariant structure (the PD-1 essence was not URL-addressable). The following structure consensus amendments (STR-1…STR-12) are binding and supersede the corresponding clauses of the drafted structure / SC-3 / PC-2.4 / PC-2.5 where they conflict.

- **STR-1 (Package consolidation: 18 → ~13).** Merge: `ingest`+`intake` → `ingest` (sub-folders `src/fetch/` + `src/gate/`, the gate holding the SEC-2 state machine); `queues` → contracts (queue-name + job-schema) + worker (BullMQ wiring); `lifecycle` → `db` (sub-folder); `adversary` → `eval` (two entry points `eval:golden`, `eval:adversary`); `observability` → `config` (`config/telemetry`); `test-utils` → `contracts/__fixtures__/`. **Keep separate (load-bearing seams):** `contracts`, `db`, `graph`, `llm`, `rag`, `citation`, `render`, `editorial`, `config`, `eval`, `ingest`, **`auth`** (lean — verify.ts + revocation interface; the 100% Stryker target (SEC-8) travels with the file; defamation-defense isolation is cleaner as a package than scattered). Merged-away SEC/PC file targets become sub-paths under their new homes with mutation targets intact.
- **STR-2 (Worker split into 3 processes — AC-3 forcing function).** `apps/{api, ingest-worker, serve-worker, audit-worker, web}` (+ `apps/enqueuer`, see STR-3). **ingest-worker** = extract/resolve/graph-builder/timeline (write-path; sole AGE writer). **serve-worker** = rag/render/citation-precompute (read-path; synchronous request/response; sub-second latency budget). **audit-worker** = lineage_reconcile (append-only; pausable independently). Rationale: single-host means separate processes (not VMs) must arbitrate via the OS scheduler; different failure domains/scaling/latency; a runaway extraction loop must NOT starve the query path; PC-2.5 ("graph-builder sole AGE writer") becomes trivially provable when writer imports come from one app.
- **STR-3 (Enqueuer as own durable control-plane process — fixes PC-2.4's silent SPOF).** `apps/enqueuer` (or supervisor mode); NOT in a worker. **Event store = Redis Streams** (or Postgres outbox) — never in-process `EventEmitter`. Worker completes a stage → writes `<stage>.completed` to the stream → Enqueuer (consumer-group leader) reads + enqueues the next BullMQ job. Replayable on crash; jobs idempotent via content-hash dedup (at-least-once → effectively-once). DAG definition lives in `apps/ingest-worker/src/orchestrator.ts` (sole caller of `@iip/queues/enqueuer`). An in-process Enqueuer that dies with its consumer fails AC-2 reliability implicitly.
- **STR-4 (render←rag cross-process handoff — refines SC-3).** `packages/rag` pushes `{renderInput}` to `render-queue` (BullMQ); render executes in `apps/serve-worker/src/processors/render.ts`; output → MinIO object key (not an in-memory value). Both sides validate the `RenderInput` zod schema on receipt. The ESLint ban on `@iip/render` in `packages/rag/**` + `apps/serve-worker/src/processors/rag/**` is now trivially enforceable — in-process was unenforceable against dynamic `require()`/reflection.
- **STR-5 (AGE reader/writer exports split — refines PC-2.5).** `packages/graph/package.json` `exports` field: `"./reader"` PUBLIC (rag/citation/timeline import `@iip/graph/reader` for reads); `"./writer"` RESTRICTED to `apps/ingest-worker/src/graph-builder/**`. Wording fix: **"Graph Builder is the sole AGE WRITER; reads via `@iip/graph/reader` are allowed anywhere."** Enforced by the ESLint literal ban on raw `ag_catalog.cypher(` (PC-1e) + the `exports`-map import restriction + `@iip/eslint-plugin` `no-internal-import` rule. (The original wording conflated writes with reads; reads are needed in 4+ places.)
- **STR-6 (Four missing homes + ADRs 016–018).** (a) **Query Planner** (TDD §11.1) → `rag` for v1; **ADR-016** records the plan-to-extract to `packages/planner` when multi-step tool-calls land. (b) **Supersession orchestrator** → `packages/editorial/src/supersession.ts` coordinating db + graph + citation; **ADR-017**: *a superseded node is never deleted, only marked; AGE rebuilds (PC-2.5); citation retains the historical reference + a supersession flag* — every render that cited the superseded node must be reproducible-as-was and flagged-going-forward. (c) **Trust-tier metadata traveling the graph** (SEC-3) → `packages/contracts/src/trust.ts` (typed record, every package speaks the same shape) + AGE edge property (queryable) + projected into the RAG index (retrieval filters by trust tier — defamation-grade retrieval without trust filtering is malpractice). Owner: `packages/graph`. (d) **Partner-keyring rotation** (SEC-2) → **ADR-018**: N + N-1 keys valid concurrently for one rotation window; old revoked after grace; rotation event to audit. Policy → `config`; runtime (load current key, accept N-1 in window) → `apps/api`; rotate-and-flip job → BullMQ recurring in worker.
- **STR-7 (Frontend: `/claim/[id]` first-class surface — the PD-1 essence made addressable).** Add `apps/web/app/(routes)/claim/[id]/page.tsx` and `/evidence/compare?ids=...`. The claim is URL-addressable/shareable (pasteable into a Slack thread); chat/timeline/evidence/senators link to it via `<Link href="/claim/${id}">`. **Without this, IIP fails its own PD-1 essence outside the app** — the structure treated claims as content; they must be destinations. Journey map: journalist → `/claim/[id]` → citation modal; researcher → `/claim/[id]` → `/graph?seed=…`; analyst → `/evidence/compare?ids=…`; legal/civil-society → `/senators/[id]`; citizen → `/chat`.
- **STR-8 (Frontend: compound `<Citation>` primitive + root CitationContext).** `apps/web/components/citation/{index,chip,modal,doc-viewer,variants,citation-context}.tsx` — compound API (`<Citation><Citation.Chip/><Citation.Modal/></Citation>`); `CitationContext` provided at the **root layout** (a node selected in the graph at 2am flows to the citation modal without prop-drilling). This is NOT a shadcn atom (encodes domain invariants); `components/citation/` is separate from `components/ui/` so shadcn upgrades stay clean.
- **STR-9 (Frontend: shared graph model + tier-router + one-shell-three-renderers).** `apps/web/lib/graph/types.ts` (GraphNode/GraphEdge/SelectionState — the single shared model imported by the Zustand store, every renderer, the citation modal); `lib/graph/tier-router.ts` (pure function `(nodeCount, mode) → renderer`, unit-testable, URL-encodable `?renderer=cytoscape`); `components/graph-explorer/index.tsx` (one shell) + `renderers/{cytoscape,react-flow,sigma}.tsx`. Never three explorers. Data-flow: click node → Zustand graph-store → nuqs URL (`?active=senator-x`) → CitationContext → source surfaces.
- **STR-10 (Frontend: state layout + URL-key registry + invariants-as-defaults + semantic tokens).** `apps/web/lib/state/{graph-store, timeline-store, chat-store, citation-store}.ts` (Zustand; citation-store cross-cutting); **`lib/state/url-keys.ts`** = the single nuqs URL-key registry (the URL is a public API for journalists — every param name/parser in one file, no drift); React Query hooks co-located with routes, cross-route queries lifted to `lib/queries/`. **`components/claim/claim.tsx` renders `<Citation.Empty>` by default** and promotes to `<Citation.Chip>` only when provenance resolves — AC-2 enforced at the component boundary, not at code review. `lib/citation/source-verbs.ts` = verb → variant registry (EI-3; adding a verb is a one-line edit, not a grep-and-hunt). **`app/styles/iip-tokens.css`** = semantic tokens named by meaning (`--trust-tier-verified`, `--trust-tier-contradicted`, `--claim-dashed`, `--defamation-risk-caution`; never `--green-500`); `components/iip/` (domain primitives: Citation, Claim, TrustBadge, SourceVerbTag) separate from `components/ui/` (shadcn upgrade-safe).
- **STR-11 (Missing day-one files).** `packages/db/drizzle.config.ts` + `migrations/`; `infra/sql/age/migrations/` (`0001-*.sql`) + `apply.ts` (CI task `age:migrate`); `packages/contracts/scripts/gen-pydantic.ts` + `generated/py/` (committed); `infra/runner/ollama-pull.sh` (pull + verify digest); `apps/<worker>/src/processors/index.ts` (BullMQ registry) + `index.ts` (wires checkpoint + processors) per worker; `apps/api/src/server.ts` + `scripts/gen-openapi.ts` → `openapi.json`; `apps/web/src/middleware.ts` (auth gate) + `next.config.ts`; `tools/eval/src/structlog_config.py` + `package.json` shim; `packages/contracts/__fixtures__/containers.ts` (`withPostgresAge`/`withMinio`/`withOllama`); root `.nvmrc`.
- **STR-12 (Polyglot workspace wiring + CI migration ordering).** `tools/` is NOT a pnpm workspace member — `pnpm-workspace.yaml` lists `apps/*` + `packages/*` only; `tools/*/package.json` are **shims** (no JS; `scripts` shell to `uv run`) so Turborepo sees them as tasks. `turbo.json` declares `py:*` tasks (`py:lint`, `py:test dependsOn py:lint`). Generated pydantic is committed at `packages/contracts/generated/py/`; `contracts:gen` is a `dependsOn` of `py:test`. **CI migration sequence: `pnpm db:migrate` → `pnpm age:migrate`** (AGE FK-deps on the Drizzle schema), ordered not parallel (codified as turbo task-graph dependencies). TS Ollama cassettes in `tests/cassettes/` (vcr-ts); Python eval cassettes in `tools/eval/tests/cassettes/` (pytest-vcr) — do NOT share (different formats).

## Project Structure & Boundaries

> Consolidated per the Step-6 consensus (STR-1…STR-12). The structure optimizes for *process boundaries* (what matters on a single host, AC-3) and *protecting the PD-1 moment on every surface*, not merely for organizing files by feature.

### Complete Project Directory Structure

```
iip/
├── README.md  package.json  pnpm-workspace.yaml   # apps/* + packages/* only (tools/ excluded — STR-12)
├── turbo.json  tsconfig.base.json  .npmrc  .env.example  .nvmrc  .gitignore
│
├── apps/
│   ├── api/                          # Fastify 5 — the only public ingress
│   │   ├── src/{server.ts, routes/, middleware/auth.ts, plugins/swagger.ts, errors.ts, auth/keyring.ts}
│   │   ├── scripts/gen-openapi.ts    # → openapi.json (D8)
│   │   └── test/
│   ├── ingest-worker/                # WRITE-PATH (sole AGE writer)
│   │   ├── src/{index.ts, processors/index.ts, orchestrator.ts,   # orchestrator = sole Enqueuer caller (STR-3)
│   │   │            graphs/{extract,resolve,graph-builder,timeline}.ts,
│   │   │            graph-builder/}                                  # imports @iip/graph/writer (STR-5)
│   │   └── test/
│   ├── serve-worker/                 # READ-PATH (synchronous; sub-second)
│   │   ├── src/{index.ts, processors/{rag,render,citation-precompute}.ts}  # render via render-queue (STR-4)
│   │   └── test/
│   ├── audit-worker/                 # append-only; pausable independently
│   │   ├── src/{index.ts, processors/lineage-reconcile.ts}
│   │   └── test/
│   ├── enqueuer/                     # CONTROL-PLANE — durable DAG orchestrator (STR-3)
│   │   ├── src/{index.ts, stream.ts}   # Redis Streams consumer-group leader
│   │   └── test/
│   └── web/                          # Next.js 15 App Router
│       ├── app/
│       │   ├── (routes)/{chat,claim/[id],graph,timeline,evidence/compare,senators/[id],documents/[id]}/  # /claim/[id] = PD-1 (STR-7)
│       │   ├── _actions/  api/  error.tsx  loading.tsx  layout.tsx (CitationContext provider — STR-8)
│       ├── middleware.ts             # auth gate (STR-11)
│       ├── components/
│       │   ├── ui/                   # shadcn primitives (upgrade-safe)
│       │   ├── iip/                  # domain primitives: Claim, TrustBadge, SourceVerbTag (STR-10)
│       │   ├── citation/             # COMPOUND primitive (STR-8): {index,chip,modal,doc-viewer,variants,citation-context}
│       │   ├── claim/                # claim.tsx renders <Citation.Empty> by default (STR-10)
│       │   ├── graph-explorer/       # shell + renderers/{cytoscape,react-flow,sigma} (STR-9)
│       │   └── {EvidenceExplorer,Timeline,Chat,SenatorDashboard}/
│       ├── lib/
│       │   ├── api.ts                # ONE HTTP wrapper (AbortController+retry; lint-bans raw fetch)
│       │   ├── state/{graph-store,timeline-store,chat-store,citation-store,url-keys}.ts  # STR-10
│       │   ├── graph/{types,tier-router}.ts   # shared model + pure router (STR-9)
│       │   ├── citation/source-verbs.ts       # verb→variant registry (STR-10)
│       │   └── queries/              # cross-route React Query hooks (route-scoped co-located)
│       ├── styles/iip-tokens.css     # semantic tokens (STR-10)
│       └── test/
│
├── packages/                         # ~13 packages (STR-1)
│   ├── contracts/                    # KEEP — zod single source of truth; the ballast
│   │   ├── src/{ingest,extraction,query,render,eval,queue,http,error,time,graph-state,trust}.ts  # trust.ts = STR-6c
│   │   ├── src/<domain>/<EntityName>.ts   # one primary schema per file (PC-4)
│   │   ├── scripts/gen-pydantic.ts   # → generated/py/ (committed — STR-12)
│   │   ├── generated/py/             # pydantic mirror (SC-1)
│   │   ├── __fixtures__/             # was test-utils — make<Entity>() factories (PC-9)
│   │   ├── __fixtures__/containers.ts # withPostgresAge/withMinio/withOllama (STR-11)
│   │   └── __contract-tests__/       # zod↔pydantic↔JSON Schema round-trip (PC-9)
│   ├── db/                           # KEEP — Drizzle + migrations + lifecycle sub-folder
│   │   ├── src/schema/{sources,documents,entities,relationships,claims,evidence,timeline,staging}.ts
│   │   ├── src/{upsert.ts, tx.ts}    # PC-1a/b
│   │   ├── src/lifecycle/            # was packages/lifecycle (STR-1)
│   │   ├── drizzle.config.ts  migrations/
│   │   └── test/
│   ├── graph/                        # KEEP — AGE; exports reader/writer (STR-5)
│   │   ├── src/{cypher.ts, reader.ts, writer.ts, projection.ts, projection.config.ts}
│   │   ├── package.json              # exports: ./reader public, ./writer restricted
│   │   └── test/
│   ├── llm/                          # KEEP — @iip/llm-router (PC-2.1)
│   │   ├── src/{router.ts, retry.ts, routes.config.ts, prompts/}
│   │   └── test/
│   ├── ingest/                       # MERGED ingest+intake (STR-1)
│   │   ├── src/{fetch/{firecrawl,manual}, dedupe}                      # v1: Firecrawl Tier-1 + manual upload only
│   │   ├── src/{fetch/{crawlee-stealth,alaveteli-foi,partnership}}    # Tier-2/3/5 adapters: scaffolded interfaces, deferred implementation
│   │   ├── src/gate/{state-machine.ts, sign.ts, partner-keyring.ts}   # was packages/intake (SEC-2)
│   │   └── test/
│   ├── rag/                          # KEEP — Retrieval Fusion + Planner (v1); emits RenderInput (STR-4)
│   │   ├── src/{retrievers/{pgvector,age,bm25}, fusion.ts, crag.ts, generate.ts, planner/}
│   │   ├── {retrievers,fusion}.config.ts
│   │   └── test/
│   ├── citation/                     # KEEP — provenance, decoupled from embeddings (SC-2/AC-4)
│   ├── render/                       # KEEP — fail-closed gate; imports ONLY @iip/contracts (SC-3/STR-4)
│   ├── eval/                         # KEEP — TS orchestration + render-time metrics + adversary mode (was adversary — STR-1)
│   │   └── src/{corpus,hooks,runner,report,metrics,adversary}/
│   ├── editorial/                    # KEEP — AC-11 hash-chained log + supersession orchestrator (STR-6b)
│   │   ├── src/{log.ts, verify.ts, witness.ts, supersession.ts}
│   │   └── test/
│   ├── config/                       # KEEP — @iip/config + telemetry (was observability — STR-1) + keyring policy (STR-6d)
│   │   ├── src/{index.ts, telemetry/}  config_history/
│   ├── auth/                         # KEEP (lean) — verify.ts + revocation; 100% Stryker target (SEC-8)
│   │   ├── src/{verify.ts, revocation.ts}
│   │   └── test/
│   └── (queues → contracts + worker; lifecycle → db; adversary → eval; observability → config; test-utils → contracts/__fixtures__ — all merged per STR-1)
│
├── tools/                            # NOT a pnpm workspace member (STR-12)
│   ├── eval/                         # SC-1 — Python, containerized, subprocess-invoked
│   │   ├── pyproject.toml  package.json (shim → uv run)  Dockerfile
│   │   ├── src/{metrics, redteam, structlog_config.py}/
│   │   └── tests/{cassettes/, <entity>_factory}/
│   └── chaos/                        # SC-6 — k6 + Playwright (citation-render path, 3-worker blast radii)
│       ├── package.json (shim)  citation-drop.k6.js  scenarios/
│
├── eval/                             # repo-root content-addressed
│   ├── corpus/golden/v<N>/           # frozen + manifest.json
│   └── gates/<corpus-hash>/{manifest,adversarial-rerun,recall-split,interrater,decision}.json   # SC-7
│
├── infra/
│   ├── docker-compose.yml            # api, ingest-worker, serve-worker, audit-worker, enqueuer, web, tools/eval, tools/chaos, postgres+AGE+pgvector, redis, minio, ollama, caddy, otel/prometheus/grafana
│   ├── caddy/Caddyfile               # STR-2 ingress
│   ├── sql/age/{migrations/0001-*.sql, apply.ts}   # parallel to Drizzle (D1); apply.ts = age:migrate (STR-11/12)
│   ├── runner/{provision.pkr.hcl, ollama-pull.sh}  # SEC-4 isolated runner + model pull (STR-11)
│   ├── oidc/role-trust.json          # SEC-4
│   ├── grafana/  prometheus/  otel/  alerts/lineage.rules.yml   # SEC-3
│
├── docs/{adr/, glossary.md, pattern-index.md, diagrams/, runbooks/, guidelines.md}   # PC-3/4/6/7
│
├── tests/{integration, e2e, redteam, cassettes}/    # cross-cutting; cassettes TS-only (STR-12)
│
└── .github/workflows/{ci, eval, chaos, adr-lint, secrets-gate}.yml
```

### Architectural Boundaries (revised per STR)

**API boundary:** Fastify `/api/v1` is the ONLY public ingress (after PD-3); Caddy fronts (auto-TLS + rate-limit, D9/SEC-9); auth middleware (`packages/auth`) resolves every request to a `principal`. **A served claim can leave the system ONLY via the render processor in `apps/serve-worker`** (STR-4) — there is no alternate path.

**Process boundaries (the AC-3-forced separation, STR-2/3):** five processes arbitrate via the OS scheduler on the single host — `api`, `ingest-worker` (sole AGE writer), `serve-worker` (read-path), `audit-worker` (append-only), `enqueuer` (control-plane). A runaway extraction loop cannot starve the query path. The Enqueuer is durable (Redis Streams), not an in-process EventEmitter.

**Package import boundaries (ESLint `no-restricted-imports` + `exports` maps):** `packages/render` imports ONLY `@iip/contracts` (SC-3); `@iip/render` banned in `packages/rag/**` + `apps/serve-worker/src/processors/rag/**` (STR-4); `@iip/graph/writer` restricted to `apps/ingest-worker/src/graph-builder/**`, `@iip/graph/reader` public (STR-5); `apps/api` handlers read only `req.principal` (SEC-1); `ollama`/`@anthropic-ai/sdk` only via `@iip/llm`; `new Queue`/`*.add(` only in `@iip/queues/enqueuer` + `apps/ingest-worker/src/orchestrator.ts`; `process.env` only in `@iip/config` (+ entrypoint exemptions); LangGraph imports pinned to `packages/rag` (+ `apps/ingest-worker/src/graphs`).

**Data boundary:** Postgres = sole stateful system of record; MinIO = append-only raw, off the serving path; AGE graph + Meilisearch = derived/rebuildable (AC-6); Redis = cache + BullMQ broker + the Enqueuer's durable event stream (STR-3); `eval/gates/` = content-addressed artifacts (SC-7); `editorial` log = hash-chained human-judgment provenance (SEC-6, distinct from SC-7).

### Requirements → Structure Mapping (FG1–FG5)
- **FG1 (Ingestion & provenance):** `packages/ingest` (fetch + gate) + `packages/db` + MinIO + `packages/config/telemetry`. FR-1.1…1.7.
- **FG2 (Extraction & KG):** `apps/ingest-worker` (extract → resolve → graph-builder → timeline) + `packages/rag` (retrieval) + `packages/graph` + `packages/citation` (cross-cutting). FR-2.1…2.5.
- **FG3 (Investigative query & evidence):** `apps/serve-worker` (rag → render-queue → render) + `apps/api/routes/{query,evidence}` + `apps/web/claim/[id]` (STR-7). FR-3.1…3.5.
- **FG4 (Temporal & entity views):** `apps/ingest-worker/timeline` + `packages/db` (timeline_events, senator read-model) + `apps/api/routes/{timeline,senators}` + `apps/web/senators/[id]`. FR-4.1…4.2.
- **FG5 (Editorial integrity surface):** `packages/editorial` (gate records, supersession orchestrator STR-6b) + `packages/render` + `apps/web/components/{citation,claim,iip}` + the PD-3 gate workflow. FR-5.1…5.7.

**Cross-cutting:** `packages/citation` (FG1-5), `packages/render` (FG3/5), `packages/eval` + `tools/eval` (all — AC-1), `packages/config/telemetry` (all), `packages/editorial` (FG1/5), `packages/auth` (FG3/5), `packages/contracts` (all — the seam).

### Integration Points & Data Flow
**Internal:** DB+queue only; TS↔Python eval via **subprocess** (SC-1, never HTTP — STR-12 wiring); Web→API via `lib/api.ts`; **rag→render via BullMQ `render-queue`** (STR-4, cross-process); **stage→Enqueuer via Redis Streams** (STR-3, durable). **External:** source websites (tiered), Ollama, optional cloud LLM (via `@iip/llm` only), MinIO (S3), GitHub Actions OIDC (SEC-4), external timestamping/mirror for AC-11 witnessing (SEC-6). **Data flow:** Source → `ingest/fetch` → MinIO raw + `documents` → `ingest/gate` (2-sig approve, SEC-2) → `extract` (chunk+embed+substring prefilter+LLM) → `staging` → `Resolver` (conservative merge) → canonical → `graph-builder` (AGE projection, drop+rebuild) → `timeline` → `serve-worker/rag` (fusion + CRAG) → `generate` → **`render-queue` → render (fail-closed, NLI entailment)** → MinIO render object → `api /query` → `web <Citation>`. Parallel: `eval` samples every plane; `editorial` log records every action; `audit-worker/lineage-reconcile` reconciles nightly (SEC-3 metrics).

### File Organization Patterns (consolidated)
- **Config:** `packages/config` (single env reader + telemetry); `*.config.ts` per package (routes/retrievers/fusion/projection); versioned `config_history` for output-affecting knobs (PC-2.6).
- **Source:** one primary zod schema per file in `packages/contracts/src/<domain>/`; package + process boundaries enforced by ESLint + `exports` maps.
- **Tests:** co-located `*.test.ts`; `tests/{integration,e2e,redteam}` cross-cutting; `tools/{eval,chaos}/tests`; `eval/corpus` + `eval/gates` content-addressed; `contracts/__fixtures__` shared factories + testcontainers.
- **Docs:** `docs/adr/` (PC-3, 18 ADRs after STR-6), `docs/glossary.md` (PC-4), `docs/pattern-index.md` (PC-7), `docs/diagrams/` Mermaid (PC-6), `docs/runbooks/`, `docs/guidelines.md`.

### Development Workflow Integration
- **Dev:** `docker compose up` brings all 5 app processes + platform stack; `pnpm dev` hot-reloads api/workers/web; Ollama pre-pulls (STR-11).
- **Build:** Turborepo task graph — `build`/`test`/`lint`/`typecheck`/`eval`/`chaos`/`py:*`; `contracts:gen` before typecheck; `db:migrate` → `age:migrate` ordered (STR-12).
- **Deploy:** single-host Docker Compose (transitional, AC-3); 5 processes arbitrate via OS scheduler; all deps behind interfaces (SC-5) → multi-node = deployment change, not rewrite; Caddy ingress; isolated self-hosted runner (SEC-4).

## Party-Mode Consensus (Step 7 — Validation Red Team, 🧪 Murat · 🏗️ Winston · 📊 Mary)

The drafted validation verdict ("READY WITH MINOR GAPS, high confidence") was red-teamed and found **overconfident**. The architecture itself is a strong spec — none of the three reject it — but the verdict (a) blesses enforceability claims the proving-harness hasn't built yet, (b) lets a binding-constraint contradiction (SEC-4 ↔ NFR-D-1) slide as a "gap to monitor," and (c) launders three risk profiles (architecture / product / launch) into one confidence number. The following validation consensus amendments (VAL-1…VAL-9) are binding and **supersede the drafted "READY WITH MINOR GAPS, high confidence" verdict**.

- **VAL-1 (Split the verdict).** Replace the single verdict with a three-state verdict: **(a) READY TO BUILD — F1-conditional** (F1 may start WITH the VAL-3 conditions); **(b) NOT READY for claim-touching milestones** (any ingestion/serving work) until VAL-2's Critical gaps are closed; **(c) NOT READY TO LAUNCH** (any external exposure) until VAL-7's launch-gates are closed. The blanket green light is withdrawn.
- **VAL-2 (Critical gaps — block claim-touching milestones).** G-2 retention/takedown → **Critical** (blocks F1 schema-side; schema must encode retention metadata + takedown trigger fields; at defamation-grade ambiguity is itself a defect). G-3 Filipino eval-set spec → **Critical-design-gate** (lock in an ADR before F1; informs the data model + citation-faithfulness contract — Filipino is the PRODUCTION case, not i18n; without it there is no defamation-grade bar for the majority of the corpus). G-6 PD-2 KPI observation → **Critical** (the falsification instrument — without it the team cannot fail, and a thesis that cannot fail is a creed). **NEW Critical — numeric defamation-threshold ADR:** "defamation-grade" appears ~30× in the spec and is never quantified; define the max acceptable hallucination rate per language per citation class — the whole safety case reduces to this number. **NEW Critical — AC-11 hash-chain concurrency-model ADR:** hash-chain = tamper-evidence, orthogonal to concurrent-write correctness; a multi-writer Enqueuer needs single-writer consumer-group serialization OR CRDT merge — unspecified (two enqueuers racing the same chain index silently forks the chain); resolve before any audit-worker code. **NEW Critical — 5-process blast-radius matrix:** which N-of-5 failure combos are acceptable vs chargeable; "no uncited path" must hold under partial failure (when `api` or `audit-worker` dies, not just happy-path — an `audit-worker` death that silently drops audit events is a defamation-grade catastrophe).
- **VAL-3 (F1-gate additions — Murat's 8).** F1 must not merge without: (1) retention/takedown fields in the data model; (2) sampling-hook slot reserved in the served-response envelope (G-5 design-side); (3) Filipino eval-set spec locked in an ADR (G-3 design-side); (4) ADR-013/016/017/018 stubs with explicit "evidence pending F18/F19" markers (G-4 as tracking debt, not silent debt); (5) blast-radius matrix for the 5-process split; (6) contract-test skeleton for **gate-invocation-per-served-response under queue pressure** (fixes the VAL-9 Stryker category error); (7) hash-chain concurrency-model ADR; (8) numeric defamation-threshold ADR.
- **VAL-4 (T2 is a binary contradiction — ADR-019 before GPU-using code).** SEC-4 (isolated eval runner off the corpus workstation) ↔ NFR-D-1 (single workstation) **cannot both hold**. This is a **decision, not a gap.** Pick one in **ADR-019**: (a) eval time-slices the GPU (drop SEC-4 isolation for v1; accept noisy-neighbour risk on the gate; documented mitigation) OR (b) eval moves to a second box (drop NFR-D-1 single-workstation for the eval subsystem; the "transitional" framing narrows; multi-node arrives earlier than planned). The choice propagates into package layout, worker config, and the chaos harness. Resolve **before any GPU-using code** (F14 at latest; ideally at F1). The drafted validation's classification of this as an "Important gap (G-1) + non-blocking tension (T2)" was sleight of hand.
- **VAL-5 (Tension reclassifications).** **T1 (resource budget):** non-blocking for F1; **blocking before ~F3 or >5 concurrent users** — the validation must state the trigger explicitly, not just "transitional." **T3 (render-queue latency):** reclassify **blocking until benchmarked on the actual workstation with eval running** — p95 violations drive retries → load → more violations (cascade risk, not just latency risk); "probably fits the budget" is inadequate at defamation-grade.
- **VAL-6 (Confidence split — not one number).** **HIGH** in spec completeness; **MEDIUM / UNVERIFIED** in enforcement (the proving-harness — "no uncited path" property test, AC-11 concurrent-writer test, libel-injection red-team, slow-poisoning eval — is F18/F19 work; >70% probability the harness finds a hole requiring re-architecture at this complexity); **MODERATE** in product thesis (audience unvalidated — VAL-7d); **LOW** in launch plan (decay clock, legal-cooperation, competitive context unresolved — VAL-7). The single "high confidence" is withdrawn.
- **VAL-7 (Launch-readiness gates — Mary's five).** NOT READY TO LAUNCH until: (a) G-6 resolved (Critical, VAL-2); (b) **one named competitive alternative** (Rappler / Vera Files / PCIJ / Inquirer fact-check desk — positioning determines the v1 feature cut; "editorial integrity differentiates FROM WHOM?" is unanswered); (c) **decay-clock transition design** for post-proceeding state (the Sara Duterte proceeding is time-bounded by constitutional design; when it resolves, v1 transitions live-intelligence → archived-record; the design is currently absent and the demo artifact's shelf-life is a go/no-go variable — "build it well and they will come" ignores the countdown); (d) **a 3-interview audience-discovery probe entered into evidence** (cheap, fast, one week — before the defamation-grade investment compounds; "internal-first" must not also be "assumption-first"); (e) **a named legal-cooperation runbook** (evidence-preservation hold, fork-and-seal, key rotation preserving audit continuity — "we built a good log" is a trial defense, not a plan for the morning a teammate is served; PH defamation law reaches individuals, not just the platform).
- **VAL-8 (Missing architectural gaps to track).** **Enqueuer control-plane singleton** — SLO for stream re-establishment after restart + single-writer-assumption audit (for the multi-node exit, AC-3). **AGE partition semantics (PC-2.5)** — time-bounded (per-case, drop-rebuild cheap) vs entity-bounded (can't drop without losing history); nail before PC-2.5 is "READY." **Cross-process render MinIO GC owner** — serve-worker writes, api reads, neither owns cleanup; unbounded object growth on a defamation-grade retention regime. **`config_history` explicitly in G-2's retention scope** (unbounded legal hold by design — G-2 was scoped too narrowly). **ADR-018 nonce-store TTL** (default TTL'd = bounded replay window, acceptable; unbounded = memory growth + indefinite replay protection, a bug).
- **VAL-9 (Stryker target correction).** The 100% Stryker target on `packages/render/gate.ts` measures **gate-internal correctness**, NOT **gate-on-the-live-path-ness** (render crosses a queue hop per STR-4). A mutant that bypasses the gate via a queue fast-path (cached render returned without re-checking citations) is NOT caught by in-module mutation testing. **ADD a contract test: gate-invocation-per-served-response, run under queue pressure** — this is the defamation-relevant property. The Stryker 100% target stays (gate-internal) but is no longer the sole render-gate assurance.
- **VAL-10 (Language-premise correction — English is the volume-production case).** The G-3 premise — *"Filipino is the PRODUCTION case, not i18n"* — is **contradicted by the project owner's ground truth: most source articles are in English.** "Production case" conflated two axes that diverge: **volume** (English = the majority serving path) vs **defamation salience/risk** (Filipino/Taglish = the highest-risk subset). This is a category error that, left uncorrected, misroutes every downstream decision referencing G-3. **Amended premise:** *English is the **volume** production case — the majority serving path requiring the **first** extraction-quality gate. Filipino is the **salience** production case — the highest-defamation-risk subset requiring its own dedicated gate, sequenced after (not instead of) English. Both are production. Neither is i18n. The binary was false.* **Consequences:** (a) an **English extraction-quality eval gate (OQ-9-EN)** is a **missing work item** and the actual volume-critical path — see proposed Story 2.6c; (b) the Filipino eval (Story 2.6b) is **relabeled from "production eval" to "salience gate"** and remains required, but is no longer the critical-path blocker; (c) the defamation-grade standard **strengthens** under this frame — dual gates prove both majority-volume and highest-salience quality; (d) G-3 is NOT closed by the Filipino ADR alone; it closes when **both** the English (2.6c) and Filipino (2.6b) gates are specified. **This amendment supersedes the volume implication of the original G-3 wording while preserving its anti-deprioritization intent.** Surfaced by the Story 2.6 party-mode adversarial review (2026-07-03).

## Architecture Validation Results

### Coherence Validation ✅ (with tracked tensions)
**Decision Compatibility:** All technology choices mutually compatible and version-verified (mid-June 2026). The TS/Python polyglot is bridged by zod→JSON Schema→pydantic generation (SC-1, PC-8). **Tracked tensions (VAL-5):** (1) ~14 containers + Ollama VRAM on one workstation (NFR-D-1 vs STR-2) — non-blocking for F1, blocking before ~F3 or >5 concurrent users; (2) **SEC-4 ↔ NFR-D-1 binary contradiction (VAL-4)** — a decision (ADR-019), not a gap; (3) STR-4 render-via-queue latency — blocking until benchmarked on the actual workstation with eval running (cascade risk).
**Pattern Consistency:** PC-1…PC-9 enforce patterns mechanically. **Correction (VAL-9):** the Stryker 100% target on `render/gate.ts` measures gate-internal correctness only; a contract test for gate-invocation-per-served-response under queue pressure is added (the defamation-relevant property).
**Structure Alignment:** STR-1…STR-12 align structure with decisions. **Audit (VAL-8):** "transitional" (AC-3) is mostly honest — close the Enqueuer-singleton-assumption audit + local-filesystem-usage audit across all 5 processes before signing.

### Requirements Coverage Validation ✅ (with escalated gaps)
**Functional Requirements (FG1–FG5, ~25 FRs):** all mapped to packages/processes. Citation provenance cross-cutting (`packages/citation`).
**Non-Functional Requirements:** EI-1…8 (AC-2/SC-2/SEC-3/PC-9 + eval harness); P-1…3 (D4/fusion/hop caps — T3 reclassified); S-1…5 (SEC-1/2/4); A-1…3 (AC-4/AC-6/PC-1); R-1…3 (STR-3 durable Enqueuer); D-2/3 (cloud-optional, FOSS). **Escalated gaps (VAL-2):** L-4 retention (G-2 → Critical); OQ-9 Filipino eval (G-3 → Critical-design-gate); O-2 runtime sampling hook (G-5 → design-gate); PD-2 KPI observation (G-6 → Critical). **New Critical:** numeric defamation threshold; AC-11 hash-chain concurrency model; 5-process blast-radius matrix.
**Demo/Presentation (DR-1…6, SM-1…8):** covered by PD-1/PD-2/PD-3 + gate workflow; **launch-readiness gated (VAL-7).**

### Implementation Readiness Validation ✅ (F1-conditional)
**Decision Completeness:** D1…D16 documented; **19 ADRs** after VAL-4 (ADR-019 T2 resolution) + VAL-2's new defamation-threshold/hash-chain-concurrency ADRs. 4 prescriptive ADRs (013/016/017/018) need evidence — tracked with "evidence pending F18/F19" markers (VAL-3.4).
**Structure Completeness:** Complete directory tree (STR); day-one files defined (STR-11).
**Pattern Completeness:** PC-1…PC-9 + VAL-9 correction.

### Gap Analysis Results (final)
**Critical (block claim-touching milestones):** G-2 retention/takedown; G-3 Filipino eval-set spec; G-6 PD-2 KPI observation; numeric defamation-threshold ADR; AC-11 hash-chain concurrency-model ADR; 5-process blast-radius matrix; **VAL-4 T2 contradiction (ADR-019)**.
**Important:** G-1 second GPU box (before F14, gated by VAL-4); G-4 ADR evidence (013/016/017/018); G-5 runtime sampling hook (design-gate before F1); VAL-8 architectural gaps (Enqueuer SLO, AGE partition semantics, render MinIO GC, config_history scope, ADR-018 nonce TTL).
**Nice-to-have:** G-7 resource budget; G-8 render-queue latency assertion (folded into VAL-5/T3); G-9 Pattern Index empty cells.
**Launch-gates (VAL-7):** G-6; named competitor; decay-clock design; audience-discovery probe; legal-cooperation runbook.

### Architecture Completeness Checklist
**Requirements Analysis** — [x] Project context analyzed · [x] Scale/complexity assessed · [x] Technical constraints identified · [x] Cross-cutting concerns mapped.
**Architectural Decisions** — [x] Critical decisions documented with versions · [x] Technology stack fully specified · [x] Integration patterns defined · [x] Performance considerations addressed (T1/T3 triggers stated, VAL-5).
**Implementation Patterns** — [x] Naming conventions · [x] Structure patterns · [x] Communication patterns · [x] Process patterns.
**Project Structure** — [x] Complete directory structure · [x] Component boundaries · [x] Integration points mapped · [x] Requirements-to-structure mapping.
*(All 16 [x] — but see the split verdict below: [x] on the checklist ≠ blanket "READY.")*

### Architecture Readiness Assessment (split per VAL-1)
**(a) READY TO BUILD — F1-conditional.** F1 may start with the VAL-3 conditions met (8 F1-gate additions). F1 touches neither ingestion nor serving, so the Critical gaps don't block it.
**(b) NOT READY for claim-touching milestones** (any ingestion/serving work — roughly F2 onward into the P-series). Blocked until VAL-2 Critical gaps closed: retention/takedown, Filipino eval-set spec, PD-2 KPI observation, numeric defamation threshold, hash-chain concurrency model, blast-radius matrix, and VAL-4's ADR-019.
**(c) NOT READY TO LAUNCH** (any external exposure). Blocked until VAL-7 launch-gates closed: G-6, named competitor, decay-clock design, audience-discovery probe, legal-cooperation runbook.

**Confidence (split per VAL-6):** HIGH in spec completeness · MEDIUM/UNVERIFIED in enforcement (the proving-harness is F18/F19 work) · MODERATE in product thesis (audience unvalidated) · LOW in launch plan (decay clock / legal-cooperation / competitive context unresolved).

**Key Strengths:** editorial integrity as a mechanical property (fail-closed render gate, no uncited path, mutation-tested); process boundaries on a single host (STR-2/3 — the AC-3 forcing function); content provenance as the load-bearing wall (SEC cluster); PD-1 essence structurally enforceable (`/claim/[id]`, fail-closed `<Claim>`, compound `<Citation>`); a binding ADR trail (AC-5/PC-3); 7 party-mode rounds of pressure-testing producing AC/PD/SC/D/SEC/PC/STR/VAL consensus.

**Areas for Future Enhancement:** close VAL-2 Critical gaps before claim milestones; close VAL-7 launch-gates before any external exposure; build the PC-7 Pattern Index first; v2 extraction candidates (`packages/planner` ADR-016, SSE streaming D10, per-stakeholder value map AC-9, second seed case OQ-7).

### Implementation Handoff
**AI Agent Guidelines:**
1. Follow all architectural decisions exactly; cite the binding identifier (AC/PD/SC/D/SEC/PC/STR/VAL/ADR) on every divergence.
2. The enforced MUSTs (PC-1) are non-negotiable; Guidelines are advisory.
3. Respect process + package boundaries (STR-2/3/4/5) — ESLint/exports-map enforced.
4. Refer to `docs/pattern-index.md` (PC-7) for "if touching X → MUST follow Y → MUST cite Z."
5. Every divergence from the TDD gets an ADR with cited research evidence (AC-5/PC-3).
6. **Observe the split verdict (VAL-1):** F1 only between now and the claim-milestone gate; do not begin ingestion/serving work until VAL-2 Critical gaps close.

**First Implementation Priority:** TDD Phase-0 task **F1** — `pnpm create turbo@latest iip` + refactor to the STR-1 amended TDD §4 layout + root `infra/docker-compose.yml` + seed 19 ADRs (PC-3 + VAL-4) + the polyglot eval seam (SC-1) + the render-gate ESLint boundary (SC-3). Gated by **SC-10 AC-F1-01…10 AND VAL-3's 8 additions** (keystone: AC-F1-05 polyglot eval round-trip; AC-F1-08 render-gate ESLint boundary; VAL-3.6 contract-test skeleton for gate-invocation-per-served-response under queue pressure; VAL-3.7 hash-chain concurrency ADR; VAL-3.8 numeric defamation-threshold ADR). Close G-7 (resource budget) as part of F1's smoke.
