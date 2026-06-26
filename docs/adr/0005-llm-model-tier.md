---
id: ADR-005
title: LLM Model Tier Selection and Q&A Cloud-Model Requirement
status: Accepted
date: 2026-06-22
supersedes: null
superseded_by: null
deciders: [Winston (architect), John (PM), user]
related: [NFR-D-2, NFR-O-2, RK-5a, PC-2.1, SC-9, EI-6, AC-2, ADR-006, ADR-019, ADR-020]
evidence:
  - _bmad-output/eval-artifacts/iip-feasibility-report-2026-06-22.md
  - _bmad-output/eval-artifacts/iip-feasibility-report-v2-fast.json
  - _bmad-output/eval-artifacts/iip-feasibility-report-gemini.json
  - _bmad-output/eval-artifacts/iip-feasibility-report-gemini-pro.json
  - _bmad-output/eval-artifacts/iip-feasibility-report-gemini-pro-optimized.json
  - _bmad-output/eval-artifacts/iip-feasibility-report-gemini-flash-single.json
  - _bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/.decision-log.md (D-038)
---

# ADR-005: LLM Model Tier Selection and Q&A Cloud-Model Requirement

## Context

IIP is a defamation-grade research platform. The PRD and architecture demand a local-first deployment posture (NFR-D-1/NFR-D-2) with cloud models as an optional, pluggable, recorded tier. The high-citation-fidelity Q&A / render path must satisfy hard CI gates: quote-validity 100%, groundedness ≥0.95, fact/claim tag coverage 100%, and query p95 latency ≤10s.

Pre-build feasibility checks (2026-06-22) tested Qwen3-14B + bge-m3 on the Sara Duterte impeachment pilot corpus (5 documents, 302 chunks) against those gates.

## Decision

- **Ingestion, extraction, embedding, and lightweight read-model work use local models by default.**
  - Embedding model: **bge-m3** (1024-dim dense only) served locally via Ollama or the chosen embedding runtime.
  - Extraction / bulk reasoning: **Qwen3-14B** (Ollama tag `qwen3:14b`) as the primary local model.
- **Q&A answer generation / render-path reasoning is required to use a cloud/stronger model in v1.**
  - Primary: **Gemini 2.5 Flash** using a **single-call generation schema**. The model receives all retrieved chunks at once and is instructed to return the answer plus exact, contiguous verbatim citations in one JSON response. This passed all hard gates: quote-validity 100%, groundedness 100%, fact/claim coverage 100%, p95 latency **9.5s**.
  - Fallback / high-stakes verification: **Gemini 2.5 Pro** (or equivalent frontier model).
  - Cloud model use is recorded per response for provenance (modelId, promptVersion, schemaVersion, latencyMs, confidence).
- **A verbatim-citation pipeline is mandatory for all answer generation.**
  - Single-call mode: the model selects verbatim citations directly from the provided retrieved chunks.
  - Two-call fallback mode (Pro only if needed): Stage 1 extracts verbatim spans, Stage 2 generates answers constrained to those spans; a hard substring filter drops non-verbatim citations before serving.
  - This is the production implementation of EI-6 / RK-2a anti-hallucination controls.

## Alternatives

1. **Local-only Qwen3-14B for Q&A.**
   - Rejected. With the verbatim-citation pipeline Qwen3-14B passed integrity gates (quote-validity 100%, groundedness 100%, fact/claim coverage 100%) but p95 latency was ~147s on the test host (Apple Silicon), far above the ≤10s target. A faster local GPU setup may be re-evaluated in v1.x, but is not a blocker for v1.
2. **Gemini 2.5 Flash for Q&A (two-call).**
   - Rejected as the default v1 path. With a two-call pipeline (separate span extraction + answer generation), Flash reached 100% quote-validity and fact/claim coverage, but groundedness was 75% (below ≥0.95) and p95 latency was 12.1s.
2a. **Gemini 2.5 Flash for Q&A (single-call).**
   - **Accepted.** A single-call schema that provides all retrieved chunks and asks the model to return verbatim citations in one response passed all hard gates: quote-validity 100%, groundedness 100%, fact/claim coverage 100%, p95 latency **9.5s**. Caveat: the pilot returned prose answers (`assertions: 0`), so production must enforce structured citations before the render gate.
3. **Cloud default for all workloads.**
   - Rejected. This would violate the local-first cost/sovereignty posture for bulk ingestion/extraction and is unnecessary for those stages.
4. **Drop the hard groundedness / latency gates.**
   - Rejected. Hard gates are non-relaxable per NFR-O-2 and RK-5a; weakening them would re-introduce the defamation-risk tension that adversarial review H3 flagged.

## Consequences

### Positive
- Integrity gates become reachable in v1 without lowering standards.
- Ingestion/extraction/embedding remain local, preserving NFR-D-1 deployment flexibility and cost control.
- The model-tier split is explicit, lint-enforceable, and recorded per response (PC-2.1 `Route<T>` envelope).

### Negative
- Q&A path now has a hard dependency on a cloud API key and network path; offline operation cannot serve new Q&A queries (read-model/cache hits may still work).
- Cloud model latency and sovereignty concerns increase for the Q&A path; counsel review may need to consider cloud-provider terms.
- The single-call Flash result returned prose answers (`assertions: 0`) in the pilot. Production must enforce structured citations, or the integrity metrics are not meaningful.

### Neutral
- The `llm-router` must model the split as explicit `Route<T>` entries with no implicit fallback; a Route with no fallback hard-fails when preferred is unavailable.
- Reproducibility requires pinning `modelId`, prompt version, and schema version in `extractor_version` for every cloud-generated answer.

### Implementation Notes

- `packages/llm/src/routes.config.ts` must define separate `Route<T>` entries for:
  - `extract:preferred` → Qwen3-14B local
  - `extract:verify` → cloud model (optional, for high-stakes extraction)
  - `query:answer` → Gemini 2.5 Flash (single-call, primary for v1)
  - `query:answer:verify` → Gemini 2.5 Pro (optional high-stakes fallback)
- The single-call Q&A pipeline belongs in `packages/rag`/`packages/citation`; the prompt must instruct the model to return `assertions` with `claim_type` and `citations` where each `quote` is a verbatim substring of the retrieved chunks.
- `packages/render` must verify every served assertion has a valid citation and a fact/claim tag before returning a `QueryAnswer`.
- The Q&A path must record `modelId: gemini-2.5-flash`, prompt version, schema version, latency, and confidence in the `extractor_version` envelope.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Does structured-citation enforcement on single-call Flash output preserve p95 ≤10s and the hard gates on a larger question set? | Architect/Developer | Re-run feasibility pilot after production structured-citation parser is implemented |
| 2 | What is the exact equivalent model if Gemini 2.5 Flash becomes unavailable? (Gemini 2.5 Pro, Claude Sonnet 4, GPT-4.1/o3-mini-high) | Architect | Before F1 scaffold if primary key is unavailable |
| 3 | Should v1.x re-test a faster local GPU setup (e.g., Qwen3-14B on RTX 4090/6000 Ada, Q4_K_M) once hardware is available? | Architect/Product | Post-v1 latency/cost review |
| 4 | How is the cloud API key rotated and stored? (sops+age at rest, OIDC injection, never in env.example). | Security/Infra | Before F1 scaffold |

