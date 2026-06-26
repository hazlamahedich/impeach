---
id: ADR-020
title: Embedding Serving Runtime — Ollama for v1, TEI as F3+ Upgrade Path
status: Accepted
date: 2026-06-22
supersedes: null
superseded_by: null
deciders: [Winston (architect), user]
related: [ADR-004, ADR-005, ADR-019, OQ-1, AC-4, SC-5, D4, D15, PC-2.1, STR-11]
evidence:
  - https://ollama.com/library/bge-m3 (verified 2026-06-22: 4.8M downloads, shipping ~1 year)
  - https://github.com/huggingface/text-embeddings-inference (verified 2026-06-22)
  - _bmad-output/planning-artifacts/research/technical-local-llm-extraction-feasibility-2026-06-19.md
  - _bmad-output/planning-artifacts/architecture.md (OQ-1, D4, D15)
---

# ADR-020: Embedding Serving Runtime — Ollama for v1, TEI as F3+ Upgrade Path

## Context

ADR-005 (LLM Model Tier) locks the embedding **model** as `bge-m3` (1024-dim,
dense-only) but explicitly punts the **serving runtime** decision on line 31:
*"served locally via Ollama or the chosen embedding runtime."* An internal note
(`project-context.md`) further flagged: *"Ollama's embedding catalog is shallow
and may not ship bge-m3. Decide the runtime before F3: TEI / vLLM /
sentence-transformers Python sidecar. The choice changes the embedding client's
API shape. Schema-affecting (OQ-1)."*

This ADR closes that open question. Verification on 2026-06-22:

1. **Ollama ships bge-m3.** `ollama.com/library/bge-m3` is live with **4.8M
   downloads**, model `bge-m3:latest` (1.2GB, 8K context, 567M params, XLM-
   RoBERTa architecture). The "shallow catalog" concern was unfounded.
2. **The API shape does NOT affect the schema (OQ-1).** OQ-1 is satisfied by
   the model + dimension lock (`bge-m3`, 1024, dense-only) — NOT by the runtime.
   All four candidate runtimes return `float[1024]` dense vectors. The runtime
   choice lives behind the `@iip/llm-router` interface (SC-5), so swapping it
   is a config change, not a schema migration.

Ollama is already required for Qwen3-14B (ADR-005). Serving bge-m3 from the same
runtime adds **zero containers** to the v1 stack.

## Decision

1. **Serve `bge-m3` via Ollama in v1.** The Ollama runtime (already deployed
   for `qwen3:14b`) also serves `bge-m3:latest`. One runtime, two models, one
   container.
2. **`infra/runner/ollama-pull.sh` (STR-11) pulls BOTH models** and verifies
   digests at first boot:
   - `qwen3:14b` — extraction / bulk reasoning (ADR-005)
   - `bge-m3:latest` — embeddings (this ADR)
   Model IDs are config (`packages/config/src/models.ts`), not code.
3. **`@iip/llm-router` exposes `embed(input: string[], model: 'bge-m3'): Promise<number[][]>`**
   implemented against Ollama's `POST /api/embed` endpoint
   (`{model, input}` → `{embeddings: number[][]}`). Dense-only; Ollama does not
   expose bge-m3's sparse/ColBERT outputs — and IIP does not want them (OQ-1
   locks dense-only into `vector(1024)`).
4. **TEI (HuggingFace Text Embeddings Inference) is the documented F3+
   upgrade path.** TEI supports bge-m3 (XLM-RoBERTa family), ships dynamic
   token-based batching, Flash Attention, Metal (Mac) + CUDA backends, OTel
   tracing, and Prometheus metrics out of the box. If embedding throughput or
   batching becomes a bottleneck at F3+ scale, swap the `@iip/llm-router`
   `embed()` implementation to TEI's OpenAI-compatible `/v1/embeddings` endpoint
   and add a `tei` container — **no schema change, no re-embed** (AC-4
   decouples citations from embeddings; D4 shadow re-index handles the
   migration mechanically).
5. **OQ-1 is satisfied by the model+dim lock, not the runtime.** `vector(1024)`
   in pgvector HNSW is the schema contract. `bge-m3` + 1024 + dense-only is
   locked before HNSW build; the runtime serving the model is an operational
   detail behind the SC-5 interface.

## Alternatives

1. **TEI from day one.**
   - Rejected for v1. TEI is the better production runtime, but adds a
     container + operational surface to a v1 that already runs ~14 containers
     on one workstation (VAL-5 tension (1)). Ollama is already there. TEI's
     batching/throughput advantages don't pay off at v1's ingest volume
     (1000s of documents/day, not real-time). TEI is the right call at F3+ —
     this ADR names it explicitly so the upgrade is planned, not rediscovered.
2. **vLLM.**
   - Rejected as the embedding runtime. vLLM is a generative-LLM server;
     embedding support exists but is not its primary use case. vLLM only earns
     its complexity if IIP also adopts it for **XGrammar-constrained decoding**
     (sprint-change-proposal T5). If that happens, vLLM could serve bge-m3 as a
     side benefit — but that's a future coupled decision, not a v1 embedding
     choice. Defer.
3. **`sentence-transformers` Python sidecar (FastAPI wrapper).**
   - Rejected. Highest ops overhead (Python process, hand-rolled batching, no
     built-in tracing/metrics), and IIP is deliberately TS-first with Python
     confined to `tools/eval` and `tools/chaos` (STR-12). Adding a Python
     service to the serving path violates that boundary for no gain. Last
     resort only.
4. **Cloud embedding API (OpenAI, Cohere, Voyage).**
   - Rejected. Violates local-first posture (NFR-D-1/NFR-D-2) for a workload
     that doesn't need it. Ingestion/embedding stays local (ADR-005).

## Consequences

### Positive
- **Zero added containers in v1** — Ollama serves LLM + embeddings from one
  runtime. Minimizes the workstation footprint (~14 containers is already a
  VAL-5 tension).
- **One pull script, one digest-verification path** (`infra/runner/ollama-
  pull.sh`) for both models. Operational simplicity.
- **Upgrade path is pre-planned and schema-safe.** TEI swap is a
  `@iip/llm-router` implementation change + one container; AC-4/D4 guarantee
  citations survive any re-embed via shadow re-index + diff.
- **OQ-1 clarified:** schema locks on model+dim, not runtime. Removes a
  recurring source of confusion about "schema-affecting" serving choices.

### Negative
- Ollama's `/api/embed` is **not OpenAI-compatible** (different request/response
  shape). The `@iip/llm-router` `embed()` abstraction absorbs this, but a
  future TEI swap requires updating the adapter — not a drop-in.
- Ollama's batching is coarser than TEI's token-based dynamic batching. Fine at
  v1 volume; a real constraint at F3+ scale (trigger for the TEI upgrade).
- Ollama does not expose bge-m3's sparse/ColBERT outputs. IIP wants dense-only
  (OQ-1), so this is a feature, not a gap — but it forecloses a future
  multi-vector retrieval mode without a runtime swap.
- Ollama embeddings performance on Apple Silicon (MLX) vs NVIDIA is host-
  dependent; document expected latency or eval CI times will look broken
  (mirrors the PaddleOCR caveat).

### Neutral
- `@iip/llm-router` gains an `embed()` method distinct from the generative
  `Route<T>` pattern (PC-2.1). Embeddings are not generative; they don't carry
  the `extractor_version` provenance envelope — but the model ID, dimension,
  and runtime ARE recorded on the embedding write row for reproducibility
  (AC-6).
- The TEI upgrade, when it happens, is its own ADR (ADR-020 supersede or
  amendment) with a benchmark evidence array.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | At what ingest volume / p95 embedding latency does the Ollama→TEI swap trigger? | Architect | F3 benchmark; cite a numeric threshold in the TEI upgrade ADR |
| 2 | Should `embed()` live on `@iip/llm-router` or a sibling `@iip/embed-router` (since embeddings aren't generative and don't use `Route<T>`)? | Architect | F4 Drizzle schema milestone (P4–P5 embed/extract) |
| 3 | Does Ollama's bge-m3 output match HF `sentence-transformers` bge-m3 output bit-for-bit (same tokenization, same pooling)? | Architect/QA | Before locking the HNSW index — a cross-check fixture in `tools/eval` guards silent drift |
| 4 | MLX (Mac) vs CUDA (Linux) embedding latency on the actual build host — document expected numbers | Infra | D15 GPU provisioning decision |

### Implementation Notes

- `packages/llm-router/src/embed.ts` implements `embed(input, model)` against
  Ollama `POST /api/embed`. Response shape: `{ embeddings: number[][] }`
  (one vector per input string).
- `packages/config/src/models.ts` pins:
  ```ts
  export const EMBEDDING_MODEL = {
    id: 'bge-m3',
    runtime: 'ollama',
    dim: 1024,
    mode: 'dense',
    ollamaTag: 'bge-m3:latest',
    maxContext: 8192,
  } as const;
  ```
- `infra/runner/ollama-pull.sh` pulls `bge-m3:latest` and `qwen3:14b`,
  verifies digests, fails closed on mismatch (STR-11 pattern).
- `infra/docker-compose.yml` mounts a named volume for the Ollama model store
  so models survive container restarts (architecture.md §Custom Docker Image).
- pgvector column: `embedding vector(1024)` with HNSW index built post-bulk-load
  (D4); `ef_search` pinned and asserted (pgvector 0.7→0.8 changed defaults).
- Embedding write rows record `{model_id, model_version, dim, runtime,
  content_hash}` for AC-6 reproducibility — re-embedding produces a new row,
  not an in-place mutation (AC-4 citation-decoupling).
- The TEI upgrade adapter (future) targets
  `POST /v1/embeddings {model, input}` → `{data: [{embedding: number[]}]}`.
  Adapter selection via `EMBEDDING_MODEL.runtime` config flip.
