---
research_type: 'technical'
research_topic: 'Orchestration, Knowledge-Graph Construction & Retrieval Fusion'
project: 'Impeachment Intelligence Platform (IIP)'
author: 'technical-research'
date: '2026-06-19'
web_research_enabled: true
source_verification: true
complements: 'technical-iip-technology-stack-validation-research-2026-06-19.md'
---

# Architecture Validation: Orchestration, Knowledge-Graph Construction & Retrieval Fusion (mid-2026)

## 1. LangGraph.js — Current State & Limitations

**Repo:** `langchain-ai/langgraphjs` — **3.0k★**, 2,994 commits, **471 releases**, latest `@langchain/langgraph-sdk@1.9.23` (Jun 17 2026). MIT, 98.3% TypeScript. Used in production by **Replit, Uber, LinkedIn, GitLab**.

**Maturity vs Python:** LangGraph.js has reached **near feature-parity for the core primitives** that matter to IIP: durable execution (persistence-through-failure + resume-from-exact-point), `interrupt()` for human-in-the-loop, short- + long-term memory, and full streaming (tokens, state, custom events, "time travel" via checkpoint replay). The Python version still leads on: (a) breadth of checkpointer backends (Postgres, SQLite, MongoDB, Redis — JS has Postgres + SQLite + in-memory), (b) ecosystem cookbooks/examples, (c) newest experimental features land Python-first by ~2–6 weeks. For a **stateful graph with 7 nodes + HITL review**, JS parity is sufficient.

**When LangGraph.js is the right choice:** You need *explicit* control over the state machine (conditional edges, subgraphs, parallel fan-out), checkpointed state across long runs, and human review gates. This is exactly IIP's "Collector → Analyst → Graph Builder → Timeline Builder → Fact Checker → Narrative Builder → Query Planner" topology.

**When it's over-engineering:** If your agents are mostly "LLM + tool loop" without durable multi-step state or HITL, you don't need a graph engine — Mastra agents or OpenAI Agents SDK are lighter.

**LangGraph Platform / LangSmith pricing (2026, verified):**

- **Developer:** $0/seat, 5k base traces/mo included.
- **Plus:** $39/seat/mo, 10k traces/mo, **1 free dev deployment**, then **$0.005/deployment-run**, **$0.0036/min prod uptime**.
- Traces: **$2.50/1k base** (14-day retention) / **$5/1k extended** (400-day). Engine (autonomous fix): **$1.50/LCU**.
- **Enterprise:** custom; supports **hybrid + self-hosted (data stays in your VPC)**, SSO/RBAC, SLAs.
- LangChain **does not train on your data.**

**Scale caveats:** Production deployments run on LangSmith Deployment infra. Known scale issues are around **checkpoint store size** (serialize state carefully — keep blobs out of channel state, store references), and **concurrent HITL interrupts** under high fan-out. Both are manageable with discipline.

**Recommendation: keep LangGraph.js as the orchestrator.** The TDD lock is justified in 2026.

---

## 2. Multi-Agent Orchestration Alternatives (TypeScript-focused)

| Framework | Repo / Status | Strengths for IIP | Gaps |
|---|---|---|---|
| **LangGraph.js** | 3.0k★, `@langchain/langgraph-sdk@1.9.23` (Jun 2026) | Durable graphs, HITL interrupts, checkpointer, streaming, time-travel. **Best fit for 7-node stateful pipeline + review.** | Heavier abstraction; checkpoint discipline needed. |
| **Mastra** | `mastra-ai/mastra` **25.2k★**, `@mastra/core@1.42.0` (Jun 2026), Apache-2.0 (+ Enterprise license for `ee/`). From the Gatsby team, YC W25. | TS-first; agents + **graph workflows** (`.then/.branch/.parallel`), suspend/resume HITL, MCP servers, evals, observability, model router (40+ providers). Excellent DX + Studio UI. | Workflow graph is less "low-level" than LangGraph; `ee/` gating on some features. |
| **Inngest** | `inngest/inngest` **5.5k★**, v1.31.0 (Jun 2026), Go+TS. | Best-in-class **durable step functions**, flow control (concurrency/throttle/debounce/rate-limit/priority/batch), `waitForEvent`/`cancelOn`, self-hostable. | ⚠️ **SSPL + DOSP** license — **NOT OSI-open-source**. Not an "agent" framework — it's the *durable execution layer*. |
| **Trigger.dev v3** | TS-native durable workflows | Great DX, durable, good for background jobs. | Less LLM-agent native than Mastra; no built-in graph semantics. |
| **OpenAI Agents SDK** | `openai/openai-agents-python` **27.3k★**, v0.17.5; JS/TS sibling `openai-agents-js`. MIT. | Agents, handoffs, guardrails, HITL, sessions, tracing, sandbox agents. | No durable-graph/checkpointer story comparable to LangGraph. |
| **Anthropic Claude Agent SDK** | TS + Python | First-class Claude integration, citations support, MCP-native. | Vendor-leaning; lighter orchestration primitives. |
| **CrewAI / AutoGen / Google ADK** | Python-centric | Strong role-based + conversational multi-agent patterns. | Python-only; IIP is TS. Wrong fit. |
| **Plain BullMQ + state machine** | DIY | Zero framework lock-in. | You reimplement checkpointing, HITL, replay, observability. **High hidden cost.** |
| **Temporal / Step Functions / Airflow** | — | Bulletproof durable execution. | **Overkill for v1.** Wrong abstraction layer. |

**Verdict for IIP:** LangGraph.js for the orchestration graph; consider **Inngest as the outer durable envelope** (trigger on document-ingest events, fan out, retry, debounce) wrapping LangGraph runs if you need cross-process durability + scheduling that survives deploys.

---

## 3. Knowledge-Graph Construction Approaches (GraphRAG vs alternatives)

| Approach | Repo / Status | Architecture | Fit for IIP |
|---|---|---|---|
| **Microsoft GraphRAG** | `microsoft/graphrag` **33.9k★**, **v3.1.0** (May 2026), MIT, **Python only**. Paper: **arXiv 2404.16130**. | Entity+relationship extraction → **community detection (Leiden) → community reports** → global (map-reduce) + local (entity-neighborhood) search. | Strong on "global/holistic" questions. ⚠️ **Expensive indexing**. No TS port. |
| **LightRAG** | `HKUDS/LightRAG` **36.8k★**, 8.5k commits, **EMNLP 2025**, arXiv **2410.05779**. Python; **PostgreSQL all-in-one storage**. | Dual-layer (KG + vectors), dual-level retrieval (local/global/hybrid/naive/mix), **incremental updates**, reranker. **Beats GraphRAG 54.8% vs 45.2% overall** at far lower cost. | **Best-in-class for cost/quality.** Has citation support (Mar 2025), reranker (Aug 2025). |
| **nano-graphrag** | `gusye1234/nano-graphrag` **3.9k★**, ~1100 LOC. | Minimal GraphRAG reimpl. **Spawned LightRAG, fast-graphrag, HiRAG.** | Reference for *learning the algorithm*. |
| **Neo4j LLM GraphBuilder** | `neo4j-labs/llm-graph-builder` **4.8k★**, v0.8.6 (Jun 2026), Apache-2.0. | Schema-driven extraction; chat modes: `vector / graph / graph_vector / fulltext / graph_vector_fulltext / entity_vector / global_vector`. | The **reference implementation for hybrid graph+vector+fulltext retrieval**. |
| **LangChain `LLMGraphTransformer`** | `langchain-experimental` (Python) | Function-calling / JSON-based triple extraction into a property graph. | ⚠️ **Python-only. No direct JS/TS equivalent.** |
| **LlamaIndex PropertyGraph + KnowledgeGraphIndex** | `run-llama/llama_index` **50.2k★**, v0.14.22 (May 2026). **Python-first.** | Pluggable KG extractors + retrievers over a property graph abstraction. | Powerful but Python-centric; LlamaParse is the standout. |
| **GLiNER / GLiREL / GLiNER2** | `urchade/GLiNER` **3.3k★**, v0.2.27 (May 2026), Apache-2.0. NAACL 2024, arXiv **2311.08526**. GLiNER2 (Fastino) arXiv **2507.18546**. | **Zero-shot NER + joint relation extraction (RelEx)**; runs on CPU, FP16/INT8 quant, ONNX. **Ray Serve HTTP API (language-agnostic)**. | **Best extraction-quality-per-dollar.** No native TS — but serve over HTTP from Python. |
| **Custom triplet extraction (NER+RE)** | DIY | subject-relation-object via prompting or small models | Maximum control over Popolo/AIF/Toulmin schema. |
| **GraphRAG TS port** | — | **No mature/official one exists as of mid-2026.** | Don't depend on one. |

**Entity-centric vs triplet-centric:** For a **fixed, rich domain ontology** (Popolo + AIF + Toulmin), **entity-centric extraction with a constrained schema beats free-form triplets.** GraphRAG/LightRAG default to open-schema triplets (great for exploratory corpora, noisier for a regulated legal-political domain).

**Recommendation for IIP:** **LightRAG's algorithm, reimplemented in TS on Apache AGE + pgvector**, with **schema-constrained extraction** as the primary path.

---

## 4. Hybrid Retrieval Fusion (graph + vector + BM25)

- **GraphRAG global vs local:** global = map-reduce over community reports (expensive, holistic); local = entity-neighborhood subgraph (cheap, specific). LightRAG shows **hybrid (mix) mode** dominates both.
- **Reciprocal Rank Fusion (RRF):** `score = Σ 1/(k + rank_i)`. The standard, parameter-light way to fuse vector + graph + BM25 ranked lists. **Default choice.**
- **Weighted fusion:** when graph hits are more trustworthy (in a curated legal KG), use `w_graph·s_graph + w_vec·s_vec + w_bm25·s_bm25`. **Tune per query type.**
- **Self-RAG** (arXiv 2310.11511): model self-selects retrieval + self-reflects on relevance. Heavy.
- **Corrective RAG / CRAG** (arXiv **2401.15884**): lightweight **retrieval evaluator** scores doc relevance → triggers *correct / incorrect / ambiguous* actions, optionally web-search fallback, then **decompose-then-recompose** to strip noise. **Plug-and-play.** **Strong fit for IIP.**
- **Adaptive RAG** (arXiv 2403.14403): route query → no-retrieve / single-step / multi-step based on complexity. Good *router* pattern.
- **HippoRAG** (arXiv 2405.14831): personalized PageRank-based memory for **multi-hop**. Great for "trace the connection between…" queries.
- **RAPTOR** (arXiv 2401.18059): recursive hierarchical summarization tree — strong for long-document "summarize this dossier" queries.
- **Agentic retrieval:** LangGraph + retrieval as tool calls — let the Query Planner agent decide which retriever and how many hops.

**For IIP:** Build a **fusion router** (Adaptive-RAG-style) → **3 parallel retrievers** (pgvector ANN, Apache AGE Cypher traversal, BM25/paradedb) → **RRF by default, weighted for entity/claim queries** → **CRAG correction node** → generate with citations. Add **HippoRAG-style multi-hop** behind a "trace" tool for the Query Planner.

---

## 5. Citation Engine Patterns

- **Sub-document span tracking (the foundation):** Every generated span must map back to a `(chunk_id, char_offset_start, char_offset_end, source_doc_uri, confidence)`. Store this **at chunking time**, persist through extraction/retrieval/generation. Without it, no citation system works.
- **Cohere Citations API:** returns passage-level citations mapping generated sentences → source passages. Vendor-locked.
- **Anthropic "cite"/contextual citations:** Claude supports inline citation pass-through when you pass documents with explicit IDs; use `<doc id="x">` blocks and ask the model to emit `[doc_id]` markers, then post-process to spans.
- **LightRAG built-in citations** (added Mar 2025): source attribution + traceability over retrieved entities/relations/chunks.
- **Neo4j GraphBuilder chat** returns **metadata about the source of responses** (provenance via the graph).
- **Custom (recommended for IIP):** (1) deterministic span registry from chunking; (2) prompt the generator to emit `[src:chunkId]` tokens; (3) post-process tokens → map to spans; (4) cross-validate every claim against the CRAG-corrected retrieved set; (5) render inline citations with hover-to-source-doc.

---

## 6. Final Recommendation for IIP

### Orchestration

**Keep LangGraph.js** for the 7-agent stateful graph + HITL review. Add **Inngest as the outer durable envelope** (event-triggered ingest, fan-out, retries, debouncing) — its flow control solves the scale pains LangGraph doesn't. **Reject** plain BullMQ+FSM, Temporal/StepFunctions/Airflow, and Python-only frameworks.

### Knowledge-Graph Construction

**Do NOT depend on Python GraphRAG/LightRAG as a black box.** Adopt the **LightRAG algorithm** (cheaper + higher quality than GraphRAG) and **reimplement in TypeScript on Apache AGE + pgvector**. Use **schema-constrained extraction** as the primary path:

- **NER/RE:** self-host **GLiNER + RelEx** (Apache-2.0) behind a Ray Serve HTTP endpoint; fine-tune on a few hundred Popolo/AIF/Toulmin-annotated paragraphs. This gives **deterministic, cheap, CPU-deployable** extraction that beats LLM-prompting at 1/100th the cost.
- **Open-schema triples** as a secondary "evidence mention" layer.
- **Community reports / global summarization** as an *optional, offline* batch.

**TypeScript ecosystem honesty:** GraphRAG, LightRAG, nano-graphrag, LLMGraphTransformer, and LlamaIndex PropertyGraph are **all Python**. There is **no mature GraphRAG TS port**. Porting LightRAG's algorithm is feasible (~1–2k LOC) and gives you ownership.

### Retrieval Fusion (Apache AGE ↔ pgvector)

Single Postgres instance, two extensions:

- `pgvector` for chunk/entity/relation embeddings (HNSW ANN).
- `Apache AGE` for Cypher/openCypher traversal of the Popolo/AIF/Toulmin property graph.
- **BM25** via `pg_trgm`/`paradedb`.
- **Fusion node** (LangGraph): run all three in parallel → **RRF default**; **weighted (graph-up) for entity/claim/timeline queries**; add **CRAG correction node** (arXiv 2401.15884) before generation; expose **HippoRAG-style multi-hop** (arXiv 2405.14831) as a Query-Planner tool.

### Citation Engine

**Deterministic sub-document span registry** (built at chunking, persisted through the pipeline) + **prompted `[src:id]` markers** + **post-processing to spans** + **CRAG cross-validation** + inline rendering with source provenance. Non-negotiable for a platform whose output may feed legal/political scrutiny.

### Bottom line

- **Orchestration:** LangGraph.js ✓ (keep) + Inngest envelope.
- **KG construction:** LightRAG algorithm **ported to TS**, on **AGE + pgvector**, with **GLiNER/RelEx** schema-constrained extraction (primary) + open-schema triples (secondary).
- **Retrieval:** 3-way **RRF/weighted fusion** + **CRAG** correction + optional **HippoRAG** multi-hop tool.
- **Citations:** custom deterministic span-tracking engine.

**Key citations:** GraphRAG (arXiv 2404.16130), LightRAG (arXiv 2410.05779, EMNLP 2025), CRAG (arXiv 2401.15884), Self-RAG (arXiv 2310.11511), Adaptive-RAG (arXiv 2403.14403), HippoRAG (arXiv 2405.14831), RAPTOR (arXiv 2401.18059), GLiNER (arXiv 2311.08526, NAACL 2024), GLiNER2 (arXiv 2507.18546).
