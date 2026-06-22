# Source Extract — Technical UX Constraints

> Source: 4 technical research docs + perplexity followup
> Extracted: 2026-06-19 by subagent

## 1. Knowledge Graph Visualization

**Tiered rendering** — the TDD's default pairing freezes at scale.

| Tier | When | Renderer | Renderer tech |
|---|---|---|---|
| Global overview / millions | "show me the whole corpus graph" | **Cosmograph** | WebGPU — "Only listed option credibly handling >500K nodes; GPU force-simulation; time-axis playback" |
| Medium cluster / community | 5K–100K after a query/filter | **Sigma.js + graphology** | WebGL — "ForceAtlas2 + Louvain community detection + metrics; `@react-sigma` wrapper" |
| Curated sub-graph / argument editor | <2K, user builds/edits an argument map | **React Flow v12** | DOM/SVG — "NOT for large graphs — purpose-built for curated node-based editors" |
| Medium, advanced layouts | medium | **Cytoscape.js 3.34** | Canvas 2D — "~10–50K nodes interactive; higher with batching"; "Canvas ⇒ CPU-bound past ~50K; no native WebGL" |

Practical node/edge ceilings:
- React Flow: "<2–5K nodes"
- Cytoscape.js: "~10–50K nodes interactive; higher with batching"
- Sigma.js + graphology: "~100K–500K nodes"
- Cosmograph: "Millions of nodes"
- D3-force: "~1–5K"; vis.js Network: "~10K" (legacy/unmaintained)

Known limitations / UX-relevant:
- Cytoscape is CPU-bound (Canvas); no native WebGL — performance degrades past ~50K.
- React Flow is not for large graphs; it is a curated editor surface (whiteboard, custom nodes, Minimap, Controls, NodeToolbar).
- Sigma.js WebGL means "harder custom rendering" — bespoke styling is harder than Cytoscape.
- Cosmograph has "Fewer layout types; newer ecosystem."
- G6/AntV (alternative): "Docs primarily Chinese; heavier bundle" — has WebGPU/WASM + 3D.

MVP guidance: "Cytoscape.js (default) + React Flow (argument editor) as the TDD says; **add Sigma.js+graphology the moment a view exceeds ~10K nodes**; reserve Cosmograph for the 'entire corpus' overview."

Argument visualization (AIF/IBIS/Toulmin): "Encode AIF/IBIS as typed edge data (`data.type: 'attack'|'support'|'premise'`), style via Cytoscape stylesheet / React-Flow edge types — don't adopt a foreign argument-viewer dependency." Visual conventions recommended: "red dashed = attack, green = support, bold = premise."

Integration notes for Next.js 15: "Lazy-load all three heavy libs behind route-level code-splitting (Next.js `dynamic()`) — only Cytoscape or React Flow loads per page." Cytoscape is SSR-safe (mount in client component, `"use client"`). React Flow custom nodes (`ArgumentNode`, `EvidenceNode`) can attach a citation block-id so click jumps to the doc viewer. Cosmograph streams graph as typed arrays (`Float32Array`) for GPU; "precompute layout server-side if WebGPU unavailable."

## 2. Graph Database

**Apache AGE 1.7.0** (Apache-2.0, ASF graduated PMC, ~4.6k★, supports PG 11–18, actively maintained). Co-located with PostgreSQL 16/18 + pgvector in a single Docker container. Verbatim rationale: "AGE uniquely satisfies the full requirement conjunction: openCypher + relational + pgvector in **one PostgreSQL engine**, **one container**, **Apache-2.0**. No other candidate clears all bars simultaneously."

**Query language:** openCypher (substantial subset). Supports `MATCH` with labels, variable-length paths (`*2`, `*3..5`, `*3..`, `*..5`, `*`), multi-hop patterns, `WHERE/WITH/RETURN`, aggregations, `ORDER BY/LIMIT`. Killer feature: "Hybrid SQL+Cypher: `SELECT ... FROM cypher('g', $$ ... $$) AS (...)`" — join graph results to relational/pgvector in one query.

**Latency expectations:** "at IIP's scale, AGE latency for 1–3 hop traversals is single-digit to low-double-digit ms, well within RAG retrieval budgets." IIP scale is characterized as small: 10K–100K entities + 100K–1M edges. "The **chunks** (millions) belong in pgvector, **not** in the graph. The graph is metadata/relationships. Keep it lean."

**Known limitations:**
- "No built-in graph algorithm library — PageRank, betweenness, connected components are **not** provided by AGE itself." Mitigation: Kùzu (MIT) or networkx as batch sidecar; write centrality scores back as node properties.
- "No full GQL standard support — AGE tracks openCypher, not ISO GQL."
- "No APOC-level utility procedures."
- Vector index is not native to AGE — use pgvector in same cluster, join via SQL.
- "Catalog-write visibility gotcha": `create_graph`/`create_vlabel` need explicit `COMMIT` in non-autocommit clients.
- "AGE's main perf risk is **unbounded `*` traversals on high-degree 'hub' nodes**." Mitigation: "always cap depth (`*1..3`), index hot properties, and pre-compute centrality offline."

**TDD correction (verbatim):** "SQL:PGQ has **NOT** landed in PostgreSQL core (neither 17 nor 18). … AGE isn't a stopgap — it IS the openCypher-on-Postgres path." Neo4j Community is explicitly disqualified: "GPLv3 + **AGPLv3 + Commons Clause**. Not OSI-open-source."

## 3. Citation / Provenance System

**Primary generator: Anthropic Citations API** with custom-content documents — "each pre-chunked RAG passage = one citable block → `content_block_location` citations." Verbatim benefits: "`cited_text` not billed as output tokens; works with prompt caching + batch." Critical constraint: "**incompatible with Structured Outputs**" (combining with `response_format` returns a 400). Fallback/diversity model: **Cohere A+** ("`THINKING_CONTENT` + `PLAN` citation types map well to multi-step legal reasoning").

**Canonical span model:** "block/paragraph indices in DB + **Akoma Ntoso fragment URIs** as the durable legal citation layer. Store `{doc_id, block_index, start_char, end_char, akn_uri}` on every assertion." Span-model choice rationale: "Paragraph/block (Gemini `segment`, Anthropic `content_block_location`) — robust; **recommended for IIP** because impeachment docs are paragraph-stable."

**Verification gate (mandatory, three stacked layers):**
1. NLI cross-encoder (`MoritzLaurer/DeBERTa-v3-base-mnli-fever`) — score ≥ 0.6.
2. Cross-encoder reranking as entailment proxy (`bge-reranker-v2`); low score ⇒ drop claim.
3. LLM self-verification: "Does this exact quote entail this claim? Answer YES/PARTIAL/NO + reason."

Enforcement rule (verbatim): "**Claim-without-entailment ⇒ suppress** = enforces the TDD's 'citation-or-silence' invariant machine-enforceably."

**End-to-end citation flow:**
1. Chunking time: "Every generated span must map back to a `(chunk_id, char_offset_start, char_offset_end, source_doc_uri, confidence)`. Store this **at chunking time**, persist through extraction/retrieval/generation."
2. Backend route handler calls Anthropic with `citations.enabled:true`; each pgvector chunk passed as its own content block.
3. "Persist the parsed `citations[]` array verbatim into a `claim` table; the verification worker reads `cited_text` (already free) → NLI → verdict."
4. Next.js client renders citations as a `<Citation>` component keyed to block index; onClick opens the doc viewer scrolled to the anchored span.
5. Cost optimization: "cache the source-document blocks with `cache_control: ephemeral` — impeachment corpus is static, so cache hits dominate."

**UI pattern (verbatim):** "inline `[1]` footnote (LlamaIndex-style) → hover/expand → modal showing verbatim `cited_text` + doc title + AKN URI deep-link." And: "Quote + inline-link together outperform footnote-only in libel-sensitive contexts."

## 4. Ingestion Pipeline

**The single biggest risk.** Verbatim: "Self-hosted Firecrawl will fail on congress.gov.ph, senate.gov.ph (Cloudflare WAF), sc.judiciary.gov.ph, and coa.gov.ph BY DESIGN."

**Recommended tiered architecture** (5 tiers), each with distinct provenance tags:

| Tier | Sources | Tool | Provenance tag |
|---|---|---|---|
| 1. Scrapable | News, blogs, Comelec, OSG, LGUs | Self-hosted Firecrawl v2.10 | `scrape.firecrawl` |
| 2. WAF'd | Senate, SC, COA, parts of House | Crawlee v3.17 + Playwright + stealth + BrightData PH residential proxy + FlareSolverr v3.5 fallback | `scrape.stealth` |
| 3. FOI | SALN archives, special audits | Forked Alaveteli w/ PH Commission-aware templates + foi.gov.ph | `foirequest.<agency>.<year>.<n>` |
| 4. Manual upload | Leaked docs, partner-shared, paper scans | "IIP upload UI: drag-drop + mandatory provenance form. Two-person review." | `manual.<uploader_id>` |
| 5. Partnership/licensed | Inquirer/Star archives, PCIJ, VERA Files, Rappler | SFTP drop + license metadata per outlet; access-gated full text | `license.<outlet>.<agreement>` |

**Storage mandate (UX-relevant for "verified" badges / chain-of-custody):** "MinIO raw: S3-compatible, on-prem (DPA compliance — data stays in PH), immutable WORM buckets for chain-of-custody." Postgres holds cleaned text + provenance graph + FTS + pgvector embeddings. "Mandatory dual-store with sha256 provenance anchors."

**OCR pipeline (was absent from TDD — critical):** ">80% of primary PH documents are scanned images." Recommended: **Docling** (default, MIT), **PaddleOCR-VL-1.6** for stamps/seals/complex tables (SALN, COA), **Tesseract** (`fil+eng`) as fallback. "Always store both raw original in MinIO + cleaned markdown + **OCR confidence scores** in Postgres."

**UX implications:**
- Each document carries a tier-specific provenance tag → surface as distinct source-type indicators.
- OCR confidence scores are persisted → can drive per-document or per-passage "extraction confidence" indicators.
- Two-person review on manual uploads → "reviewed" vs "unreviewed" state is a first-class UI concept.
- sha256 anchors + WORM storage → supports "chain-of-custody" / tamper-evidence display.
- **Legal/compliance flag:** "NPC Advisory 2026-01 (Apr 13, 2026) — Guidelines on Data Scraping of Publicly Available Personal Data. PIA mandatory for ALL scraping; public ≠ consent; large-scale under 'heightened scrutiny'; data subject rights workflow required." This implies a data-subject-rights workflow surface.
- "last updated" / freshness: ingestion is batched with sync (Tier 1–2) and async worker pools (Tier 3–5) — freshness indicators should distinguish per-tier latency.
- Coverage gaps are a measured metric: "RAGAS Context Recall per document class (House vs JSC vs SC pleadings) to detect corpus gaps" — coverage by document class is a known, tracked signal that UX could surface.

## 5. LLM Extraction

**Yes, LLM extraction is in the loop — hybrid local + cloud, with mandatory verification.**

**Models (TDD's choices are outdated — upgrade recommended):**
- Primary: **Qwen3-14B** (local, thinking mode, Apache 2.0). Explicit PH-language support (Tagalog, Cebuano, Pangasinan, Iloko, Waray); hybrid thinking mode. ⚠️ "no Filipino-specific benchmarks have been published. Treat Filipino performance as optimistic until validated empirically."
- Bulk throughput: **Qwen3-30B-A3B** — "3B-active MoE = faster than 8B dense yet 30B knowledge"; "the throughput champion."
- Optional: **Llama-4-Scout** — "Native Tagalog; 10M context for whole-docket ingestion."
- Cloud verification (high-stakes): **Claude Sonnet**.

**What is extracted automatically vs. manually:**
- Automatic (local LLM, bulk): "entity/relationship extraction; draft claims/evidence."
- Automatic (schema-constrained): **GLiNER + RelEx** (Apache-2.0) "self-host behind a Ray Serve HTTP endpoint; fine-tune on a few hundred Popolo/AIF/Toulmin-annotated paragraphs."
- Manual: Human-in-the-loop (HITL) review gates inside the LangGraph 7-node pipeline. Manual upload tier requires "Two-person review."

**Confidence / "AI-extracted" labeling implications:**

| Scenario | Expected macro-F1 |
|---|---|
| Zero-shot (no fine-tuning) | 0.50–0.65 |
| Light fine-tuning (few hundred labeled sentences) | 0.70–0.80 |
| Serious domain adaptation (10–20K labeled sentences + 0.5–1.5M tokens) | 0.80–0.88 in-domain |
| Out-of-distribution PH legal-political text | 0.75–0.82 |
| Statute-reference recognition (RA/BP/CA/EO + number) | ~0.75 even when fine-tuned |
| Relation extraction (entity → role/case/issue) | 0.55–0.70 |

**Hallucination / citation-risk by model class:**

| Model class | Entity F1 | Claim extraction F1 | Citation hallucination |
|---|---|---|---|
| Frontier (Claude Sonnet / GPT-4o) | 88–93% | 80–88% | 2–5% |
| Qwen3-14B (local, thinking mode) | 78–86% | 68–78% | 8–15% |
| Qwen2.5-14B (TDD) | 72–80% | 62–72% | 12–20% |
| Llama-3.1-8B (TDD) | 65–74% | 55–66% | 18–28% |

**Routing rule (verbatim):** "Confidence-routed: emit self-reported confidence; route low-confidence or high-stakes extractions to **Claude Sonnet** for verification." And: "**NEVER** let local-only output become a final cited assertion without (a) constrained decoding + thinking self-check OR (b) frontier verification."

## 6. Retrieval / Query

**Three parallel retrievers fused:**
- `pgvector` HNSW ANN for chunk/entity/relation embeddings.
- `Apache AGE` Cypher traversal of Popolo/AIF/Toulmin property graph.
- `pg_trgm` / `paradedb` for BM25 full-text.

**Fusion strategy:**
- Default: **Reciprocal Rank Fusion (RRF)** — "`score = Σ 1/(k + rank_i)`. The standard, parameter-light way to fuse vector + graph + BM25 ranked lists. **Default choice.**"
- Per-query-type: **Weighted fusion** — "when graph hits are more trustworthy (in a curated legal KG), use `w_graph·s_graph + w_vec·s_vec + w_bm25·s_bm25`. **Tune per query type.**"
- **CRAG correction node** before generation: "lightweight retrieval evaluator scores doc relevance → triggers *correct / incorrect / ambiguous* actions … **Strong fit for IIP.**"
- **Adaptive-RAG router**: "route query → no-retrieve / single-step / multi-step based on complexity."
- **HippoRAG-style multi-hop**: "personalized PageRank-based memory for **multi-hop**. Great for 'trace the connection between…' queries." Exposed "as a Query-Planner tool."
- **RAPTOR**: "recursive hierarchical summarization tree — strong for long-document 'summarize this dossier' queries."
- **Agentic retrieval:** "LangGraph + retrieval as tool calls — let the Query Planner agent decide which retriever and how many hops."

**Query patterns supported (from AGE workload-fit matrix):** 1–3 hop traversal, neighbor expansion, shortest path (via Cypher `*` + filter; no native all-pairs), pattern matching, hybrid graph⟕relational⟕pgvector joins in one query.

**Query-Planner agent** is one of the 7 LangGraph nodes — implies natural-language query is a first-class mode that routes to structured retrievers behind the scenes. HippoRAG multi-hop is behind a "trace" tool.

## 7. Performance Constraints

**Client-side graph rendering ceilings:**
- React Flow: hard ceiling ~2–5K nodes (DOM/SVG).
- Cytoscape.js: ~10–50K interactive; "CPU-bound past ~50K; no native WebGL."
- Sigma.js + graphology: ~100K–500K (WebGL).
- Cosmograph: millions (WebGPU) — but "precompute layout server-side if WebGPU unavailable" (i.e., device capability gating needed).
- G6: "heavier bundle."

**Bundle size / loading:** "Lazy-load all three heavy libs behind route-level code-splitting (Next.js `dynamic()`) — only Cytoscape or React Flow loads per page." Cytoscape extensions (fCoSE/CoSE-Bilkent/Dagre/ELK) loaded "on demand (dynamic import)." Sigma.js uses `graphology-layout-forceatlas2` (WASM) — WASM load cost. Cosmograph streams typed arrays (`Float32Array`) for GPU.

**Mobile / device constraints:**
- WebGL required for Sigma.js; WebGPU required for Cosmograph at full scale — "precompute layout server-side if WebGPU unavailable" implies a fallback path / capability detection is needed.
- Canvas-based Cytoscape is CPU-bound — mobile devices will hit the ~50K ceiling sooner.
- No explicit mobile benchmarks in the research.

**Backend / query latency:**
- AGE: "single-digit to low-double-digit ms" for capped 1–3 hop traversals at IIP scale.
- "Deep unconstrained `*` traversals on dense nodes can explode" — must cap depth (`*1..3`).

**LLM throughput:** Qwen3-14B at ~30–40 tok/s on RTX 4090; Qwen3-30B-A3B at ~40–55 tok/s. Mac Studio M3 Ultra: ~25–35 tok/s (14B). These are single-stream; bulk extraction is offline.

**Eval gates that affect what ships:** "CI gate: `deepeval test run` in GitHub Actions; fail PR if citation-fidelity < threshold or any silence-violation." Citation-or-silence compliance is binary — a claim lacking ≥1 entailment-passing citation ⇒ test FAIL. This means the UX must gracefully render "silence" / refusal states, not just answers.

## 8. Tech Stack Summary

Confirmed (validated) stack: **PostgreSQL 16 (or 18) + pgvector + Apache AGE 1.7.0 + Drizzle ORM** in a single Docker container, with **MinIO** (S3-compatible, on-prem, DPA-compliant WORM buckets) for raw immutable storage and **Redis + BullMQ** for job queues. Orchestration is **LangGraph.js** (MIT) for the 7-node stateful agent graph with HITL review, wrapped by **Inngest** (SSPL, self-hostable) as the outer durable envelope. Ingestion is tiered: self-hosted Firecrawl v2.10 (Tier 1), Crawlee + Playwright + stealth + BrightData PH residential proxy + FlareSolverr (Tier 2), forked Alaveteli for FOI (Tier 3), manual upload UI with two-person review (Tier 4), SFTP partnership drops (Tier 5). OCR: Docling + PaddleOCR-VL-1.6 + Tesseract fallback. Local LLMs via Ollama (or vLLM for XGrammar): Qwen3-14B primary, Qwen3-30B-A3B bulk, Claude Sonnet for high-stakes verification; embeddings bge-m3 (1024-dim) only. KG construction: LightRAG algorithm ported to TypeScript (~1–2k LOC) on AGE + pgvector, with GLiNER + RelEx served via Ray Serve for schema-constrained extraction. Retrieval: 3-way fusion (pgvector ANN + AGE Cypher + BM25/paradedb) via RRF/weighted, CRAG correction node, optional HippoRAG multi-hop. Citations: Anthropic Citations API + NLI verification gate (DeBERTa-v3-mnli-fever ≥ 0.6) + Akoma Ntoso fragment URIs as durable layer. Frontend: Next.js 15 with tiered graph rendering — Cytoscape.js (default), React Flow v12 (argument editor, <2K nodes), Sigma.js + graphology (5K–100K), Cosmograph (millions, WebGPU). Backend Fastify. Observability: OpenTelemetry + Prometheus + Grafana; eval harness DeepEval + RAGAS + Phoenix + Promptfoo/Inspect AI. License posture: FOSS/local-first, Apache-2.0 preferred; Neo4j explicitly excluded (AGPL + Commons Clause). 8 of 11 TDD components require amendment; none fatal.