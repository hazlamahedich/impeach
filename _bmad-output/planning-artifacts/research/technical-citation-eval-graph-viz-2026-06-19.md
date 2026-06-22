---
research_type: 'technical'
research_topic: 'Citation Engine, Evaluation Harness & Graph Visualization'
project: 'Impeachment Intelligence Platform (IIP)'
author: 'technical-research'
date: '2026-06-19'
web_research_enabled: true
source_verification: true
complements: 'technical-iip-technology-stack-validation-research-2026-06-19.md'
---

# IIP Validation Research: Citation Engine, Evaluation Harness & Graph Visualization

## A. Citation Engine Patterns (sub-document provenance)

### A.1 Landscape

| Layer | Option | Provenance granularity | Notable | URL |
|---|---|---|---|---|
| **1st-party API** | **Anthropic Citations** | Character-span (plain text), page-range (PDF), block-index (custom content) | `cited_text` not billed as output tokens; works w/ prompt caching + batch; **incompatible with Structured Outputs** | https://docs.anthropic.com/en/docs/build-with-claude/citations |
| 1st-party API | **Cohere Command-R / A+** | `start`/`end` indices + `text` snippet + `sources[]` + `content_index` | Citation `type` enum: `TEXT_CONTENT`, `THINKING_CONTENT`, `PLAN`; `citation_options.mode`: `ENABLED/DISABLED/FAST/ACCURATE/OFF`; designed ground-up for RAG | https://docs.cohere.com/reference/chat |
| 1st-party API | **Gemini (Google Search grounding)** | `groundingSupports[].segment.{startIndex,endIndex}` → `groundingChunkIndices[]` | Inline-citation linking out of the box; returns `groundingMetadata` | https://ai.google.dev/gemini-api/docs/grounding |
| 1st-party API | **OpenAI** | **No first-class citation API** | Workarounds: function-calling, structured-output schema, or `file_search` annotations (chunk-level only) | https://platform.openai.com/docs/guides/tools-file-search |
| OSS framework | **LlamaIndex `CitationQueryEngine`** | Source-node level with inline `[1]`/`[2]` markers; `citation_chunk_size` controls granularity | Drops a citation-only sub-chunk index; `response.source_nodes` carries provenance | https://docs.llamaindex.ai/en/stable/examples/query_engine/citation_query_engine/ |
| OSS framework | **Haystack** | Extractive QA readers (`ExtractiveReader`) return `Span` objects with char offsets; `CiteCloze`-style answerers | Pipeline-based; strong for quote-grounded answers | https://haystack.deepset.ai/ |
| OSS framework | **LangChain** | No built-in; pattern = `ContextualCompressionRetriever` + Structured Output citation schema | Manual but flexible | https://python.langchain.com/ |

**Sub-document span models (pick one canonical):**

- **Character-span** (Anthropic) — finest, but fragile across re-chunking; requires stable text anchors.
- **Paragraph/block** (Gemini `segment`, Anthropic `content_block_location`) — robust; **recommended for IIP** because impeachment docs (JSC minutes, pleadings, COA decisions) are paragraph-stable.
- **Token-level** — overkill, provider-internal.
- **Akoma Ntoso / fragment URIs** — legal-XML standard (`/act/chapter/3/section/12~para5`). Best for the *permanent* citation layer on primary legal text. https://docs.akomantoso.org/

### A.2 Citation *verification* (the libel-risk killer)

A citation existing ≠ a citation supporting. Three tiers, recommend stacking all:

1. **NLI / entailment model** (cheap, deterministic). Encode `(premise=cited_span, hypothesis=claim)`; require `entailment` label above threshold. `cross-encoder/nli-deberta-v3-base` or `MoritzLaurer/DeBERTa-v3-base-mnli-fever`. https://huggingface.co/MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli
2. **Cross-encoder reranking** as entailment proxy — reuse the retrieval reranker (e.g., `bge-reranker-v2`, `ms-marco-MiniLM`) to score `(claim ↔ cited_span)`; low score ⇒ drop claim.
3. **LLM self-verification** — second pass: "Does this exact quote entail this claim? Answer YES/PARTIAL/NO + reason." Use the same Claude/Cohere call that produced citations, or a cheaper model (Haiku/Gemini-Flash).

**Claim-without-entailment ⇒ suppress** = enforces the TDD's "citation-or-silence" invariant machine-enforceably.

### A.3 Recommendation for IIP

- **Primary generator: Anthropic Citations API** using **custom-content documents** so each pre-chunked RAG passage = one citable block → `content_block_location` citations. Rationale: native sub-doc provenance + token-bill efficiency + your corpus is already chunked. Fallback/diversity model: **Cohere A+**.
- **Canonical span model:** block/paragraph indices in DB + Akoma Ntoso fragment URIs as the *durable* legal cite. Store `{doc_id, block_index, start_char, end_char, akn_uri}` on every assertion.
- **Verification gate (mandatory in pipeline):** NLI cross-encoder (`DeBERTa-v3-mnli-fever`) score ≥ 0.6 → else LLM self-check → else **silence**.
- **UI pattern:** inline `[1]` footnote (LlamaIndex-style) → hover/expand → modal showing verbatim `cited_text` (Anthropic returns it free) + doc title + AKN URI deep-link.

### A.4 Integration notes (Next.js 15 + existing stack)

- Backend (route handler) calls Anthropic with `citations.enabled:true` on `document` blocks; pass each pg-vector chunk as its own content block. **Do not** combine with `response_format` (400 error).
- Persist the parsed `citations[]` array verbatim into a `claim` table; the verification worker reads `cited_text` (already free) → NLI → verdict.
- Next.js client renders citations as a `<Citation>` component keyed to block index; onClick opens the doc viewer scrolled to the anchored span.
- Cost: cache the source-document blocks with `cache_control: ephemeral` — impeachment corpus is static, so cache hits dominate.

---

## B. Evaluation Harness for Legal-Political RAG

### B.1 Landscape

| Tool | Style | Strength for IIP | License / note | URL |
|---|---|---|---|---|
| **RAGAS** | Metric library (Python) | **Faithfulness**, **Context Precision/Recall**, **Factual Correctness**, **Semantic Similarity**, Aspect-critic | MIT; the canonical RAG metrics | https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/ |
| **DeepEval** | **Pytest-native**, assertion-based | 50+ metrics, **G-Eval/DAG/QAG**, span-level traces, hallucination + faithfulness built-in, CI/CD-ready, LLM-judge w/ reasons | Apache-2.0; `assert_test(...)` in test files | https://docs.confident-ai.com/ |
| **Phoenix / Arize** | **OpenTelemetry** observability + eval + prompt playground + experiments | Self-hostable; ingest RAGAS/DeepEval/Cleanlab as evaluators; traces from LangChain/LlamaIndex/OpenAI | Apache-2.0; OTLP-native | https://docs.arize.com/phoenix |
| **LangSmith** | Commercial observability | Traces, dashboards, online evals, **Engine** auto-finds recurring failures | Commercial; tight if you're on LangChain | https://docs.smith.langchain.com/ |
| **Inspect AI** | Frontier-eval framework (UK AISI) | **200+ pre-built evals**, agents, **sandboxing (Docker/K8s)**, multi-agent, MCP tools | MIT; built for safety red-teaming | https://inspect.ai-safety-institute.org.uk/ |
| **Promptfoo** | CLI matrix eval + **red teaming** | Fast, declarative YAML, 100% local, hallucination/factuality guides; **now part of OpenAI (2026)** | MIT core | https://www.promptfoo.dev/docs/intro/ |
| **Braintrust / Helicone** | Commercial | Managed eval + observability | Commercial | https://www.braintrust.dev/ |

### B.2 Legal-political domain specifics (build, don't buy)

Generic faithfulness isn't enough. Add IIP-specific metrics:

- **Citation-fidelity rate** = % of returned claims that pass NLI-entailment vs their cited span (your verification gate, re-used as a metric).
- **Citation-or-silence compliance** = binary: any claim lacking ≥1 entailment-passing citation ⇒ test FAIL (directly enforces the invariant).
- **Named-entity attribution** = does a claim about *Person X* cite a passage where X is the actor? Use an NER/LLM judge.
- **Libel/defamation red-team** — Promptfoo + Inspect plugins: inject adversarial prompts ("Did Senator X commit treason?") → assert refusal-to-answer unless fully-cited.
- **Hallucination red-team** — paraphrase-perturbation + cross-examination (DeepEval `FaithfulnessMetric`, Promptfoo `factuality` assert).
- **Coverage bias** — RAGAS Context Recall per document class (House vs JBC vs SC pleadings) to detect corpus gaps.

### B.3 Recommendation for IIP

**Layered stack (all open-source):**

1. **DeepEval** as the test runner — pytest integration matches CI/CD; `assert_test` on citation-or-silence = a hard gate.
2. **RAGAS** metrics (faithfulness, context precision/recall, factual correctness) wired in as DeepEval/Phoenix evaluators — the gold-standard RAG math.
3. **Phoenix** for observability/tracing (self-hosted, OTLP) + dataset experiments — visualize per-doc-class regressions.
4. **Promptfoo** for fast local red-teaming iterations + **Inspect AI** for the periodic deep adversarial suite (sandboxed agent probes).

### B.4 Integration notes

- Eval dataset: hand-curated **golden Q&A** (lawyer-verified) per article/charge + adversarial set; DeepEval's golden synthesizer can augment.
- Gate in CI: `deepeval test run` in GitHub Actions; fail PR if citation-fidelity < threshold or any silence-violation.
- Export eval traces via OTLP to Phoenix → correlate regressions to specific doc/chunk versions.
- Avoid LangSmith unless already on LangChain (lock-in); Phoenix gives equivalent tracing self-hosted.

---

## C. Graph Visualization Frontend

### C.1 Landscape — performance vs. capability

| Library | Renderer | Scale (practical) | Strengths | Limitation | URL |
|---|---|---|---|---|---|
| **Cytoscape.js** (v3.34) | **Canvas** (2D) | ~10–50K nodes interactive; higher with batching | MIT, 70+ extensions, fCoSE/CoSE-Bilkent/Dagre/ELK/Cola layouts, selectors, compound nodes, headless Node use, Oxford-Bioinformatics-cited | Canvas ⇒ CPU-bound past ~50K; no native WebGL | https://js.cytoscape.org/ |
| **React Flow** (v12.11, `@xyflow/react`) | DOM/SVG | **<2–5K nodes** | MIT, 9.66M wkly installs, custom React nodes/edges, Minimap/Controls/NodeToolbar, whiteboard features, TS-first, multiplayer | NOT for large graphs — purpose-built for **curated node-based editors** | https://reactflow.dev/ |
| **Sigma.js** (v3, v4 alpha) + **graphology** | **WebGL** | ~100K–500K nodes | MIT; WebGL fast; graphology gives ForceAtlas2 + **Louvain community detection** + metrics; `@react-sigma` React wrapper | WebGL = harder custom rendering | https://www.sigmajs.org/ , https://graphology.github.io/ |
| **Cosmograph** | **GPU/WebGL (WebGPU)** | **Millions of nodes** | MIT `@cosmograph/org/chart`, GPU force-simulation, time-axis playback, designed for massive dynamic graphs | Fewer layout types; newer ecosystem | https://cosmograph.tech/ |
| **G6 / AntV** (v5.1.1) | Canvas + **WebGPU/WASM** accel, **3D** | 100K+ with WASM | MIT, Ant Group; React/Vue/Angular bindings, WebGPU/WASM layout accel, 3D scenes | Docs primarily Chinese; heavier bundle | https://g6.antv.antgroup.com/manual/introduction |
| **D3-force** | SVG/Canvas | ~1–5K | Ultimate flexibility | Hand-rolled; slow at scale | https://d3js.org/ |
| **vis.js Network** | Canvas | ~10K | Legacy, easy | Unmaintained-ish, dated | https://visjs.github.io/ |

### C.2 Argument visualization (AIF/IBIS/Toulmin)

For impeachment *argument networks* (attack/support), generic node-edge renderers work but encode the schema in node/edge types:

- **AIF** — `IA-node` / `RA-node` (rule application) / `CA` (conflict) / `MA` (preference) edges. Map directly to Cytoscape/React-Flow edge types with styled arrows.
- **IBIS** — Issue/Position/Argument nodes — natural fit for React Flow (small curated trees).
- **OVA / Arvol / Carneades** viewers exist but are academic; recommend *reusing their visual conventions* (red dashed = attack, green = support, bold = premise) inside your own renderer rather than depending on them.

### C.3 Recommendation for IIP — **tiered rendering** (this is the key decision)

The TDD's "Cytoscape.js + React Flow" is correct but **incomplete for the full node-range**. Use a 3-tier routing:

| Tier | When | Renderer |
|---|---|---|
| **Global overview / millions** | "show me the whole corpus graph" | **Cosmograph** (WebGPU) — the only listed option credibly handling >500K nodes |
| **Medium cluster / community** | 5K–100K after a query/filter | **Sigma.js + graphology** (WebGL + Louvain communities + ForceAtlas2) |
| **Curated sub-graph / argument editor** | <2K, user builds/edits an argument map | **React Flow v12** (custom nodes, editing, whiteboard) |
| (Keep **Cytoscape.js** where the TDD already specifies it — rich layout ecosystem) | medium, advanced layouts | Cytoscape.js 3.34 |

Pragmatic MVP: **Cytoscape.js (default) + React Flow (argument editor)** as the TDD says; **add Sigma.js+graphology** the moment a view exceeds ~10K nodes; reserve Cosmograph for the "entire corpus" overview.

### C.4 Integration notes (Next.js 15)

- **Cytoscape.js**: load as React component via `cytoscape` + `useEffect` ref; bundle fCoSE/CoSE-Bilkent/Dagre extensions on demand (dynamic import); SSR-safe (mount in client component, `"use client"`).
- **React Flow v12**: `npm i @xyflow/react`; define custom `ArgumentNode`, `EvidenceNode` (attach citation block-id from Section A → click jumps to doc viewer); use `useNodesState`/`useEdgesState`; enable `<MiniMap/>`, `<Controls/>`, `NodeToolbar`.
- **Sigma.js**: pair with `graphology` + `graphology-layout-forceatlas2` (WASM) for layout; `@react-sigma/react-sigma` v4 wrapper; compute communities server-side (graphology-louvain).
- **Cosmograph**: `@cosmograph/charts` React component; stream graph as typed arrays (`Float32Array`) for GPU; precompute layout server-side if WebGPU unavailable.
- **Argument schemas**: encode AIF/IBIS as typed edge data (`data.type: 'attack'|'support'|'premise'`), style via Cytoscape stylesheet / React-Flow edge types — don't adopt a foreign argument-viewer dependency.
- **Notebook**: expose `ipysigma` or `pyvis` export for researchers; reuse same graphology graph object server-side.
- Lazy-load all three heavy libs behind route-level code-splitting (Next.js `dynamic()`) — only Cytoscape or React Flow loads per page.

---

### Summary — three go/no-go findings

- **A. Citation:** Anthropic Citations (custom-content blocks) + NLI verification gate **fully satisfies** citation-or-silence. ✅ Adopt.
- **B. Eval:** DeepEval + RAGAS + Phoenix + Promptfoo/Inspect gives a complete open-source libel-aware harness; no commercial lock-in needed. ✅ Adopt.
- **C. Graph:** TDD's Cytoscape+ReactFlow is right for small/medium; **add Sigma.js+graphology (and Cosmograph for full-corpus) or the >10K-node views will freeze**. ⚠️ Amend TDD to a tiered renderer.
