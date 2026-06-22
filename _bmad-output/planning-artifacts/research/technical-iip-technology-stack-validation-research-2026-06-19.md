---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - Enterprise_PRD_Impeachment_Intelligence_Platform.md
  - IIP_Technical_Design_Document.docx
  - research/domain-philippine-impeachment-intelligence-political-knowledge-graphs-research-2026-06-19.md
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'IIP Technology Stack Validation (PostgreSQL+AGE, Firecrawl, LangGraph, Ollama, Next.js) vs Domain Constraints'
research_goals:
  - Validate Apache AGE vs alternatives for production graph use
  - Validate Firecrawl strategy given blocked PH gov sources
  - Identify OCR pipeline requirements (>80% scanned PDFs)
  - Validate local LLM (Qwen2.5-14B / Llama-3.1-8B) for legal-political JSON extraction
  - Validate LangGraph.js for multi-agent orchestration
  - Validate bge-m3 / nomic embeddings for Filipino/English code-switching
  - Identify hybrid retrieval fusion strategy (graph + vector)
  - Surface citation-engine patterns for sub-document citation
user_name: 'anti lustay'
date: '2026-06-19'
web_research_enabled: true
source_verification: true
companion_reports:
  - research/technical-graph-db-apache-age-evaluation-2026-06-19.md
  - research/technical-ingestion-architecture-blocked-ph-sources-2026-06-19.md
  - research/technical-local-llm-extraction-feasibility-2026-06-19.md
  - research/technical-orchestration-kg-construction-retrieval-2026-06-19.md
  - research/technical-citation-eval-graph-viz-2026-06-19.md
---

# Research Report: Technical — IIP Stack Validation

**Date:** 2026-06-19
**Author:** anti lustay
**Project:** Impeachment Watch (IIP)
**Reference TDD:** IIP_Technical_Design_Document.docx (Draft v1.0, 2026-06-16)

---

## Research Overview

The TDD locks an aggressive but defensible FOSS / local-first stack: **PostgreSQL 16 + pgvector + Apache AGE + Drizzle, BullMQ on Redis, LangGraph.js, Firecrawl self-hosted, Ollama (Qwen2.5-14B / Llama-3.1-8B + bge-m3 / nomic-embed), MinIO, Fastify, Next.js 15, Cytoscape.js + React Flow, OpenTelemetry + Prometheus + Grafana.**

This research validates each locked choice against the domain constraints surfaced in the companion Domain Research report — particularly: (1) PH gov sources block automated scraping, (2) >80% of primary docs are scanned PDFs requiring OCR, (3) Filipino/English code-switching, (4) hallucination-is-libel risk requiring citation-or-silence, (5) need for sub-document provenance.

**Methodology:** Web-verified technology benchmarks, GitHub activity, recent (2024–2026) production case studies, and direct comparison with alternatives. Confidence flags (🟢/🟡/🔴) throughout. **Findings are organized as go/no-go decisions per TDD component.**

---

## Executive Summary — Go/No-Go by Component

| TDD Component | Verdict | Action |
|---|---|---|
| **PostgreSQL 16 + pgvector + Apache AGE** | ✅ **GO** | Keep as-is; correct one factual error in TDD rationale |
| **Self-hosted Firecrawl as sole crawler** | ❌ **NO-GO** | Tiered ingestion: Firecrawl for Tier 1 only |
| **No OCR pipeline specified** | ❌ **NO-GO** | Add Docling + PaddleOCR-VL-1.6 + Tesseract fallback |
| **Qwen2.5-14B / Llama-3.1-8B local LLMs** | ⚠️ **AMEND** | Upgrade to Qwen3-14B (Filipino support) + XGrammar constrained decoding |
| **bge-m3 OR nomic-embed-text** | ⚠️ **AMEND** | Keep bge-m3 only; drop nomic (dimension mismatch) |
| **LangGraph.js orchestration** | ✅ **GO** | Keep; consider Inngest as outer durable envelope |
| **Cytoscape.js + React Flow frontend** | ⚠️ **AMEND** | Tiered rendering: add Sigma.js+graphology for >10K nodes, Cosmograph for full-corpus |
| **No citation engine** | ⚠️ **AMEND** | Add Anthropic Citations API + NLI verification gate |
| **No eval harness** | ⚠️ **AMEND** | Add DeepEval + RAGAS + Phoenix + Promptfoo/Inspect |
| **No FOI / manual-intake track** | ❌ **NO-GO** | Add tiered ingestion w/ Alaveteli fork for FOI |
| **KG construction approach** | ⚠️ **AMEND** | LightRAG algorithm ported to TS + GLiNER/RelEx schema-constrained extraction |

**Bottom line:** The TDD's *architecture* is sound, but 8 of 11 components need amendment. None are fatal; all are fixable without rewriting the design. The two **no-go** findings (ingestion strategy + missing OCR) are the highest-priority fixes — without them, the IIP cannot acquire the documents it needs.

---

## 1. Graph Database: Apache AGE — ✅ GO (with one correction)

**Verdict:** TDD's choice is correct. **Keep Apache AGE.**

### Findings

- **AGE current state (mid-2026):** v1.7.0, supports PG11–18, Apache-2.0, actively maintained, 4.6k★
- **🚨 TDD factual error:** The TDD implies "PG17+ adds SQL:PGQ" as a future alternative. **SQL:PGQ has NOT landed in PostgreSQL core** — not in 17, not in 18 (released 2025-09-25). Verified against the official PG feature matrix and PG18 release notes. `postgresql.org/docs/17/datatype-pgq.html` → 404. **AGE isn't a stopgap — it IS the openCypher-on-Postgres path.**

### Disqualifications of Alternatives

- **Neo4j Community** → GPLv3 + **AGPLv3 + Commons Clause**. Not OSI-open-source. AGPL network copyleft + Commons Clause = exactly the contamination risk the TDD says to avoid. **Should be explicitly excluded**, not "considered."
- **PG-native SQL:PGQ** → doesn't exist.
- **Nebula/JanusGraph** → multi-service, break single-container mandate.
- **Neo4j+pgvector sidecar** → two engines, breaks single-container, keeps the license problem.

### TDD Amendments Needed

1. **Strike** the "PG17+ adds SQL:PGQ" framing (factually wrong, 🟢 verified).
2. **Add** explicit license exclusion for Neo4j Community (AGPL + Commons Clause).
3. **Add** a batch-analytics companion (**Kùzu**/MIT or networkx) for PageRank/betweenness — AGE has no algorithm library.
4. **Add** operational note: in non-autocommit clients (psycopg v3/JDBC), `create_graph`/`create_vlabel` need an explicit `COMMIT`.
5. **Pin** AGE ≥ 1.7.0 + PostgreSQL 16 or 18.

### Confidence

- 🟢 HIGH: AGE state, license, SQL:PGQ-absence (all primary-source verified today)
- 🟡 MEDIUM: AGE perf-vs-Neo4j at scale (no fresh independent benchmark; immaterial at IIP's 1M-edge scale)

_See companion: `technical-graph-db-apache-age-evaluation-2026-06-19.md`_

---

## 2. Ingestion Architecture — ❌ NO-GO (single biggest risk)

**Verdict:** The TDD conflates "Firecrawl" with "ingestion." Tiered architecture required.

### 🚨 Critical Finding

**Firecrawl's own self-host docs explicitly state:** *"self-hosted instances of Firecrawl do not have access to Fire-engine, which includes advanced features for handling IP blocks, robot detection mechanisms, and more."*

**Self-hosted Firecrawl will fail on congress.gov.ph, senate.gov.ph (Cloudflare WAF), sc.judiciary.gov.ph, and coa.gov.ph BY DESIGN.** Fire-engine — the proprietary layer that handles the WAF/Cloudflare/TLS-fingerprint work — is cloud-only.

### Recommended Tiered Architecture

| Tier | Sources | Tool | Provenance |
|---|---|---|---|
| **1. Scrapable** | News sites, blogs, Comelec, OSG, LGUs | **Self-hosted Firecrawl v2.10** (TDD tool, kept here) | `scrape.firecrawl` |
| **2. WAF'd** | Senate, SC, COA, parts of House | **Crawlee v3.17 + Playwright + stealth + BrightData PH residential proxy** + FlareSolverr v3.5 fallback | `scrape.stealth` |
| **3. FOI** | Anything not on agency site, SALN archives, special audits | **Forked Alaveteli** w/ PH Commission-aware templates + foi.gov.ph | `foirequest.<agency>.<year>.<n>` |
| **4. Manual upload** | Leaked docs, partner-shared, paper scans | **IIP upload UI**: drag-drop + mandatory provenance form. Two-person review. | `manual.<uploader_id>` |
| **5. Partnership/licensed** | Inquirer/Star archives, PCIJ, VERA Files, Rappler | **SFTP drop + license metadata** per outlet; access-gated full text | `license.<outlet>.<agreement>` |

### Legal Posture (verify with PH counsel)

- **RA 10175 §4(a)(4)(b) Illegal Access:** PH DOJ has historically focused on breaches, not GET requests to public URLs. Public-interest reporting is widely understood to operate "with right."
- **No PH CFAA-equivalent.** No case law of PH government suing a scraper of public records.
- **Constitution Art. III §7** favors right to information on matters of public concern — strongest protection for IIP.
- **Practical stance:** risk is reputational/relational (getting cut off from source agencies), not criminal, for a journalistic platform acting in good faith. Document everything; honor opt-outs; never DoS; rotate slowly.

### Storage Mandate

- **MinIO** raw: S3-compatible, on-prem (DPA compliance — data stays in PH), immutable WORM buckets for chain-of-custody.
- **Postgres** cleaned: relational provenance graph + FTS + pgvector embeddings in one DB.
- **Mandatory dual-store** with sha256 provenance anchors.

_See companion: `technical-ingestion-architecture-blocked-ph-sources-2026-06-19.md`_

---

## 3. OCR Pipeline — ❌ NO-GO (absent from TDD)

**Verdict:** The TDD does not specify OCR. This is fatal — **>80% of primary PH documents are scanned images.**

### Recommended Stack (ranked)

| Rank | Tool | Version (2026) | License | Best for |
|---|---|---|---|---|
| **1** | **Docling** | v2.103.0 (Jun 17 2026), 61.8k★ | **MIT** | Default — best layout + reading-order + table structure |
| **2** | **PaddleOCR** | v3.7.0 (Jun 11 2026), 83k★ | Apache-2.0 | **PaddleOCR-VL-1.6** — SOTA for stamps/seals/tables (SALN, COA) |
| **3** | **Marker** | v1.10.2 | GPL-3.0 + OpenRAIL-M | Highest published accuracy BUT GPL taints distribution |
| **4** | **Surya** | OCR 2 (May 27 2026) | Apache-2.0 + OpenRAIL-M | 91 languages, layout + reading order |
| 5 | Unstructured | 0.23.1 | Apache-2.0 | Document-routing layer (not OCR engine) |
| 6 | Tesseract 5 (`fil+eng`) | stable | Apache-2.0 | Reliable baseline fallback |

### Recommendation

- **Docling as default**, **PaddleOCR-VL-1.6 for stamps/seals/complex tables** (SALN, COA), **Tesseract as fallback**.
- **Skip Marker** unless legal clears GPL+OpenRAIL.
- **OCR layer placement:** synchronous for Tier 1–2 (small docs, immediate markdown); async worker pool for Tier 3–5 (FOI batches).
- **Always store both** raw original in MinIO + cleaned markdown + OCR confidence scores in Postgres.

### PH-Specific Concerns

- **SALN forms (tables, signatures, stamps):** PaddleOCR-VL-1.6 (seal recognition) and Docling's table former.
- **SC en banc decisions (multi-column journals):** Docling's reading-order model.
- **Filipino/Tagalog text:** Latin-script family — all candidates cover `fil+eng`.

_See companion: `technical-ingestion-architecture-blocked-ph-sources-2026-06-19.md` (Section 3)_

---

## 4. Local LLM Strategy — ⚠️ AMEND (outdated models)

**Verdict:** The TDD's Qwen2.5-14B / Llama-3.1-8B are 18 months old. **Upgrade to Qwen3-14B.** The local-first philosophy is correct; three of four specific model/tool choices are now outdated.

### Why Qwen3

| TDD says | Recommend | Why |
|---|---|---|
| Qwen2.5-14B-Instruct (primary) | **→ Qwen3-14B** (primary) | Explicit PH-language support (Tagalog, Cebuano, Pangasinan, Iloko, Waray); hybrid thinking mode; ~2× effective capacity at same size; Apache 2.0 |
| Llama-3.1-8B-Instruct (fallback) | **→ Qwen3-30B-A3B** (bulk) | 3B-active MoE = faster than 8B dense yet 30B knowledge |
| — | **→ Llama-4-Scout** (optional) | Native Tagalog; 10M context for whole-docket ingestion |

**⚠️ CORRECTED (Perplexity follow-up, 2026-06-19):** Qwen3 *claims* coverage of 5 Philippine languages (Tagalog, Cebuano, Pangasinan, Iloko, Waray) per its tech-report language table, and was trained on 36T tokens across 119 languages. **However, no Filipino-specific benchmarks have been published.** Qwen's reported evaluations (MMLU, CMMLU, MGSM, etc.) contain little or no Filipino. Performance on PH legal-political code-switching is **inference from multilingual training + typologically-related language transfer, NOT verified.** Still the best available Apache-2.0 local option, but treat Filipino performance as optimistic until validated empirically. [Qwen3 tech report arXiv:2505.09388](https://arxiv.org/abs/2505.09388) | _Correction source: `perplexity-followup-targeted-gaps-2026-06-19.md` §4_

### Structured Output — Add Constrained Decoding

| TDD implies | Recommend | Why |
|---|---|---|
| JSON-mode + prompt | **→ XGrammar-constrained decoding via vLLM** (or Ollama native `format`) | 100% structural validity; eliminates malformed-JSON retries |
| — | Pair with **Instructor/Pydantic** for typed clients + 2 retries | Catches semantic errors constrained decoding can't |

**Empirical JSON-valid rates:** Qwen2.5-14B + plain JSON ~90–96%; Qwen3-14B + thinking ~95–98%; any model + XGrammar ~100% structural validity.

### Embeddings — Drop nomic

| TDD says | Recommend | Why |
|---|---|---|
| bge-m3 **OR** nomic-embed-text (1024-dim) | **→ bge-m3 ONLY** (drop nomic) | **Dimension mismatch** (nomic=768 vs bge-m3=1024); nomic is EN-strong; bge-m3's hybrid dense+sparse+ColBERT suits legal entities |
| — | Consider domain-adaptation fine-tune of bge-m3 on PH legal pairs | Largest ROI for closing the Filipino gap |

### Performance Reality Check

**General benchmarks (English/multilingual headliners):**

| Model class | Entity F1 | Claim extraction F1 | Citation hallucination |
|---|---|---|---|
| Frontier (Claude Sonnet / GPT-4o) | 88–93% | 80–88% | 2–5% |
| **Qwen3-14B (local, thinking mode)** | **78–86%** | **68–78%** | **8–15%** |
| Qwen2.5-14B (TDD) | 72–80% | 62–72% | 12–20% |
| Llama-3.1-8B (TDD) | 65–74% | 55–66% | 18–28% |

**⚠️ PH-specific expectations (Perplexity follow-up, code-switched legal-political NER):**

| Scenario | Expected macro-F1 |
|---|---|
| Zero-shot (no fine-tuning) | **0.50–0.65** |
| Light fine-tuning (few hundred labeled sentences) | **0.70–0.80** |
| **Serious domain adaptation (10–20K labeled sentences + 0.5–1.5M tokens)** | **0.80–0.88** in-domain |
| Out-of-distribution PH legal-political text | **0.75–0.82** |
| Statute-reference recognition (RA/BP/CA/EO + number) | **~0.75** even when fine-tuned |
| Relation extraction (entity → role/case/issue) | **0.55–0.70** |

**Implication:** Achieving production-grade extraction over PH legal-political text requires **domain adaptation with a self-built PH legal corpus** (no pre-packaged "Philippine LegalBERT" exists). Budget annotation work at ~₱2–5M for 10–20K labeled sentences, or partner with UP NCPAG / Arellano Law. _Correction source: `perplexity-followup-targeted-gaps-2026-06-19.md` §4_

### Recommended Hybrid Architecture

- **Local (Qwen3-14B, thinking mode)**: bulk entity/relationship extraction; draft claims/evidence.
- **Confidence-routed**: emit self-reported confidence; route low-confidence or high-stakes extractions to **Claude Sonnet** for verification.
- **NEVER** let local-only output become a final cited assertion without (a) constrained decoding + thinking self-check OR (b) frontier verification.

### Throughput (single-stream, Q4 quantization)

| Hardware | Qwen3-14B | Qwen3-30B-A3B | Mistral-Small-3.1-24B |
|---|---|---|---|
| RTX 4090 (24GB) | ~30–40 tok/s | ~40–55 tok/s | ~20–28 tok/s |
| RTX 6000 Ada (48GB) | ~45–60 tok/s | ~60–80 tok/s | ~30–40 tok/s |
| Mac Studio M3 Ultra (192GB UM) | ~25–35 tok/s | ~35–50 tok/s | ~18–28 tok/s |

**Qwen3-30B-A3B is the throughput champion** for bulk extraction — 3B active params per token.

### What Stays from the TDD

- ✅ **bge-m3 embeddings** (1024-dim)
- ✅ **Ollama as the local runtime** (prefer vLLM if adopting XGrammar)
- ✅ **8–14B local-first philosophy**

_See companion: `technical-local-llm-extraction-feasibility-2026-06-19.md`_

---

## 5. Orchestration & Knowledge-Graph Construction — ✅ GO + ⚠️ AMEND

### LangGraph.js — ✅ GO

**Verdict:** TDD lock is justified in 2026.

- `langchain-ai/langgraphjs` — 3.0k★, 471 releases, latest `@langchain/langgraph-sdk@1.9.23` (Jun 17 2026). MIT. Used by Replit, Uber, LinkedIn, GitLab.
- Near feature-parity with Python LangGraph for IIP's needs (durable execution, `interrupt()` HITL, checkpointing, streaming, time-travel).
- Right choice for a 7-node stateful pipeline with HITL review gates.

### Recommended Addition

- **Inngest as the outer durable envelope** — event-triggered ingest, fan-out, retries, debouncing. Solves scale pains LangGraph doesn't (cross-process durability, scheduling that survives deploys). ⚠️ Note: Inngest is **SSPL+DOSP** — NOT OSI-open-source, but self-hostable.

### KG Construction — ⚠️ AMEND

**The TDD doesn't specify how the graph gets built.** Critical decision required.

| Approach | Recommendation |
|---|---|
| Microsoft GraphRAG (Python, 33.9k★, v3.1.0) | **Reference only** — expensive indexing, no TS port |
| **LightRAG** (Python, 36.8k★, EMNLP 2025) | **PORT TO TS** — algorithm beats GraphRAG 54.8% vs 45.2% at lower cost |
| LangChain LLMGraphTransformer (Python) | Skip — Python-only, no TS equivalent |
| **GLiNER + RelEx** (Apache-2.0) | **ADOPT** — best extraction-quality-per-dollar; serve over HTTP from Python (Ray Serve) |
| Custom triplet extraction | Maximum schema control over Popolo/AIF/Toulmin |

**Recommendation:**

1. **Port LightRAG's algorithm to TypeScript** on Apache AGE + pgvector. ~1–2k LOC (nano-graphrag proved GraphRAG is ~1100 LOC).
2. **Self-host GLiNER + RelEx** behind a Ray Serve HTTP endpoint; fine-tune on a few hundred Popolo/AIF/Toulmin-annotated paragraphs.
3. Use **schema-constrained extraction as primary path** (better than open-schema triplets for a regulated legal-political domain); reserve open-schema triples for a secondary "evidence mention" layer.

### Hybrid Retrieval Fusion

**Three parallel retrievers fused via RRF (default) or weighted (per query type):**

- `pgvector` HNSW ANN for chunk/entity/relation embeddings
- `Apache AGE` Cypher traversal of Popolo/AIF/Toulmin property graph
- `pg_trgm` / `paradedb` for BM25 full-text

**Add CRAG correction node** (arXiv 2401.15884) before generation — lightweight retrieval evaluator scores doc relevance → correct/incorrect/ambiguous actions. **Strong fit for IIP** (factual rigor is core).

**Expose HippoRAG-style multi-hop** (arXiv 2405.14831) as a Query-Planner tool for "trace the chain" investigative queries.

_See companion: `technical-orchestration-kg-construction-retrieval-2026-06-19.md`_

---

## 6. Citation Engine — ⚠️ AMEND (currently absent)

**Verdict:** The TDD declares "citation-or-silence" as an invariant but doesn't specify the engine. **This is the libel-risk killer — must be added.**

### Recommendation

- **Primary generator: Anthropic Citations API** with custom-content documents (each pre-chunked RAG passage = one citable block → `content_block_location` citations). `cited_text` not billed as output tokens. Works with prompt caching + batch. ⚠️ **Incompatible with Structured Outputs** — design prompts accordingly.
- **Fallback/diversity model: Cohere A+** (designed ground-up for RAG; `THINKING_CONTENT` + `PLAN` citation types map well to multi-step legal reasoning).
- **Canonical span model:** block/paragraph indices in DB + **Akoma Ntoso fragment URIs** as the durable legal citation layer. Store `{doc_id, block_index, start_char, end_char, akn_uri}` on every assertion.
- **Verification gate (MANDATORY in pipeline):** Stack three layers:
  1. **NLI cross-encoder** (`DeBERTa-v3-mnli-fever`) — score ≥ 0.6
  2. **Cross-encoder reranking** as entailment proxy (bge-reranker-v2)
  3. **LLM self-verification** ("Does this exact quote entail this claim? YES/PARTIAL/NO")
- **Claim-without-entailment ⇒ suppress** — machine-enforceable citation-or-silence.
- **UI pattern:** inline `[1]` footnote → hover/expand → modal showing verbatim `cited_text` + doc title + AKN URI deep-link. Quote + inline-link together outperform footnote-only in libel-sensitive contexts.

### Integration Notes

- Backend route handler calls Anthropic with `citations.enabled:true`; pass each pg-vector chunk as its own content block. **Do not** combine with `response_format` (400 error).
- Persist the parsed `citations[]` array into a `claim` table; the verification worker reads `cited_text` → NLI → verdict.
- Next.js client renders citations as `<Citation>` component keyed to block index; onClick opens doc viewer scrolled to anchored span.
- Cost: cache source-document blocks with `cache_control: ephemeral` — impeachment corpus is static.

_See companion: `technical-citation-eval-graph-viz-2026-06-19.md` (Section A)_

---

## 7. Evaluation Harness — ⚠️ AMEND (currently absent)

**Verdict:** TDD specifies an "eval harness" but doesn't detail it. For a libel-sensitive legal-political platform, **generic faithfulness isn't enough.**

### Recommended Stack (all open-source)

1. **DeepEval** as the test runner — pytest-native, CI/CD-ready. `assert_test` on citation-or-silence = hard gate.
2. **RAGAS metrics** (faithfulness, context precision/recall, factual correctness) wired in as DeepEval/Phoenix evaluators.
3. **Phoenix / Arize** for observability/tracing (self-hosted, OTLP) + dataset experiments.
4. **Promptfoo** for fast local red-teaming iterations.
5. **Inspect AI** for periodic deep adversarial suite (UK AISI; MIT; 200+ pre-built evals, sandboxed agent probes).

### IIP-Specific Metrics (build, don't buy)

- **Citation-fidelity rate** = % of returned claims passing NLI-entailment vs cited span
- **Citation-or-silence compliance** = binary: any claim lacking ≥1 entailment-passing citation ⇒ test FAIL
- **Named-entity attribution** = does a claim about Person X cite a passage where X is the actor?
- **Libel/defamation red-team** — inject adversarial prompts ("Did Senator X commit treason?") → assert refusal unless fully-cited
- **Hallucination red-team** — paraphrase-perturbation + cross-examination
- **Coverage bias** — RAGAS Context Recall per document class (House vs SC vs media)

### Integration

- Eval dataset: hand-curated **golden Q&A** (lawyer-verified) per article/charge + adversarial set.
- CI gate: `deepeval test run` in GitHub Actions; fail PR if citation-fidelity < threshold or any silence-violation.
- Export eval traces via OTLP to Phoenix → correlate regressions to specific doc/chunk versions.

_See companion: `technical-citation-eval-graph-viz-2026-06-19.md` (Section B)_

---

## 8. Graph Visualization Frontend — ⚠️ AMEND (incomplete for scale)

**Verdict:** TDD's "Cytoscape.js + React Flow" is correct for small/medium but **will freeze at >10K nodes**. Tiered rendering required.

### Recommendation — Tiered Rendering

| Tier | When | Renderer | Why |
|---|---|---|---|
| **Global overview / millions** | "show me the whole corpus graph" | **Cosmograph** (WebGPU) | Only listed option credibly handling >500K nodes; GPU force-simulation; time-axis playback |
| **Medium cluster / community** | 5K–100K after a query/filter | **Sigma.js + graphology** (WebGL) | ForceAtlas2 + **Louvain community detection** + metrics; `@react-sigma` wrapper |
| **Curated sub-graph / argument editor** | <2K, user builds/edits an argument map | **React Flow v12** (TDD-locked) | Custom nodes, editing, whiteboard |
| Medium, advanced layouts | medium | **Cytoscape.js** (TDD-locked) | Rich layout ecosystem (fCoSE, CoSE-Bilkent, Dagre, ELK) |

**Pragmatic MVP:** Cytoscape.js (default) + React Flow (argument editor) as TDD says; **add Sigma.js+graphology the moment a view exceeds ~10K nodes**; reserve Cosmograph for the "entire corpus" overview.

### Argument Visualization (AIF/IBIS/Toulmin)

Encode AIF/IBIS as typed edge data (`data.type: 'attack'|'support'|'premise'`), style via Cytoscape stylesheet / React-Flow edge types — don't adopt a foreign argument-viewer dependency.

_See companion: `technical-citation-eval-graph-viz-2026-06-19.md` (Section C)_

---

## Cross-Cutting Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Self-hosted Firecrawl cannot reach Senate/House/SC/COA** | 🟥 Critical | Tiered ingestion; Crawlee+stealth+residential proxy for Tier 2; FOI+manual+partnership for Tiers 3-5 |
| 2 | **No OCR pipeline** | 🟥 Critical | Add Docling+PaddleOCR-VL+Tesseract; >80% of docs are scanned |
| 3 | **Qwen2.5-14B doesn't support Filipino** | 🟧 High | Upgrade to Qwen3-14B (Filipino *claimed* but unverified; budget for domain adaptation) |
| 4 | **nomic-embed dimension mismatch** | 🟧 High | Drop nomic; keep bge-m3 only |
| 5 | **No citation verification (libel risk)** | 🟥 Critical | Add NLI gate + Anthropic Citations + LLM self-verification |
| 6 | **No eval harness** | 🟧 High | Add DeepEval+RAGAS+Phoenix+Promptfoo |
| 7 | **Cytoscape freezes at >10K nodes** | 🟧 High | Tiered rendering: add Sigma.js+graphology (5K-100K) and Cosmograph (>100K) |
| 8 | **TDD references non-existent SQL:PGQ** | 🟨 Medium | Strike; pin AGE ≥1.7.0 |
| 9 | **AGE has no algorithm library (PageRank etc.)** | 🟨 Medium | Add Kùzu/networkx as batch companion |
| 10 | **GraphRAG/LightRAG are Python-only** | 🟧 High | Port LightRAG algorithm to TS (~1-2k LOC) or run Python extraction service via HTTP |
| 11 | **No FOI / manual-intake track** | 🟥 Critical | Add tier 3-5 of ingestion; Alaveteli fork for FOI lifecycle |
| 12 | **Local 14B hallucination rate (8-15%) too high for legal claims** | 🟧 High | Hybrid local+cloud; route high-stakes extraction to Claude Sonnet |
| **13** ⚠️ NEW | **NPC Advisory 2026-01 (Apr 13, 2026) — Guidelines on Data Scraping of Publicly Available Personal Data** | 🟥 Critical | PIA mandatory for ALL scraping; public ≠ consent; large-scale under "heightened scrutiny"; lawful basis = legitimate interest (Sec. 13[b] DPA) with documented balancing test; data subject rights workflow required |
| **14** ⚠️ NEW | **No PH legal corpus exists for domain adaptation** | 🟧 High | Build self-curated corpus (Arellano Law, Official Gazette, House/Senate transcripts); budget ₱2-5M for 10-20K labeled sentences; or UP NCPAG/Arellano partnership |
| **15** ⚠️ NEW | **Qwen3 Filipino performance unverified by any published benchmark** | 🟧 High | Treat as optimistic; run empirical eval on held-out PH legal-political set; symbolic augmentation (gazetteers for RA/BP/CA/EO patterns) |
| **16** ⚠️ NEW | **SALN access regime post-Remulla (Oct 14, 2025) unverifiable from public sources** | 🟧 High | Direct verification with Ombudsman required; design ingestion around most-restrictive plausible rule until confirmed |
| **17** ⚠️ NEW | **Senate Presidency volatile — 3 Senate Presidents in 6 weeks (Sotto → Cayetano → Gatchalian June 17, 2026). Gatchalian now presides over Sara Duterte trial.** | 🟥 Critical | Track presiding-officer procedural rulings; SC intervention / trial-aborted scenarios (cf. Estrada 2001); model further leadership changes |

---

## Confidence Summary

| Section | Confidence | Notes |
|---|---|---|
| Apache AGE state, license | 🟢 High | Primary-source verified |
| SQL:PGQ absence | 🟢 High | Verified against PG18 release notes |
| Firecrawl limits | 🟢 High | Per Firecrawl's own docs |
| Crawlee / stealth / proxy capabilities | 🟢 High | GitHub verified |
| OCR tool capabilities | 🟢 High | GitHub + papers verified |
| Qwen3 language support (Filipino) | 🟡 Medium → 🔴 corrected | *Claimed* in tech report; **no published Filipino benchmarks exist** (Perplexity follow-up §4). Treat as inference, not verified. |
| JSON-mode reliability rates | 🟡 Medium | Community benchmarks, varies |
| Local-LLM F1 vs frontier | 🟡 Medium | Inferred from general benchmarks, no PH-legal-IE benchmark exists |
| LangGraph.js maturity | 🟢 High | Used by major companies |
| LightRAG > GraphRAG | 🟢 High | EMNLP 2025 paper |
| Citation API capabilities | 🟢 High | Per vendor docs |
| Graph viz renderer limits | 🟢 High | Per docs + benchmarks |
| PH legal posture on scraping | 🟡 Medium | Statute text verified; case law sparse — verify with PH counsel |

---

## Recommended Next Steps

1. **Amend the TDD** with the 11 corrections above (highest priority: ingestion tiers, OCR, Qwen3, citation engine).
2. **Run a proof-of-concept spike** on the single riskiest path: Tier 2 ingestion (Crawlee+stealth+residential proxy against senate.gov.ph) + Docling OCR on a real SALN PDF + Qwen3-14B extraction. If this works end-to-end, the rest of the architecture follows.
3. **Proceed to Market Research** (final research step) to validate competitive positioning.
4. **After all three research streams complete**, run `bmad-correct-course` to formally align the PRD/TDD with the research findings, then proceed to `bmad-create-architecture` to formalize the revised schema.

---

## Companion Deep-Dive Reports

| File | Topic |
|---|---|
| `technical-graph-db-apache-age-evaluation-2026-06-19.md` | Apache AGE validation, license analysis, SQL:PGQ fact-check, alternatives disqualification |
| `technical-ingestion-architecture-blocked-ph-sources-2026-06-19.md` | Tiered ingestion, anti-bot toolkit, OCR pipeline ranking, FOI workflow |
| `technical-local-llm-extraction-feasibility-2026-06-19.md` | Qwen3 vs Qwen2.5, constrained decoding, embeddings, performance/cost analysis |
| `technical-orchestration-kg-construction-retrieval-2026-06-19.md` | LangGraph.js validation, LightRAG vs GraphRAG, fusion strategies, citation patterns |
| `technical-citation-eval-graph-viz-2026-06-19.md` | Citation engine patterns, eval harness, graph visualization tiered rendering |

---

*End of master technical research report. Next step: Market Research (MR) to map specific competitors.*
