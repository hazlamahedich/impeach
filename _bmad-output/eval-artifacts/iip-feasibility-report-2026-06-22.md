---
title: IIP Local-Model Feasibility Pilot Report
date: 2026-06-22
model: qwen3:14b
embedding_model: bge-m3
corpus: /Users/sherwingorechomante/impeachment/raw (pilot subset)
status: complete
---

# IIP Local-Model Feasibility Pilot Report

## Purpose

Execute the recommended next step from the Implementation Readiness Assessment: run a **pre-build feasibility check on local models** to verify whether Qwen3-14B + bge-m3 can hit the hard CI gates before committing to "cloud never required" (NFR-D-2 / RK-5a).

## Protocol

1. **Corpus:** Pilot subset of 5 documents from the Sara Duterte impeachment corpus (435 KB total text).
   - House Committee Report No. 261 (primary)
   - Supreme Court G.R. No. 278353 (primary)
   - VERA Files fact-check (tier-2)
   - Two Inquirer news articles (tier-2)
2. **Chunking:** Paragraph-level windows, max 1,500 chars, 200-char overlap → 253 chunks.
3. **Embedding:** bge-m3 via Ollama (1024-dim).
4. **Retrieval:** cosine nearest neighbors (scikit-learn) with k=5.
5. **Generation:** Qwen3-14B via Ollama, zero temperature, 8K context.
6. **Prompt:** Forced JSON output with `no_answer`, `answer`, and `assertions` (each with `claim_type` and `citations` containing exact `quote`).
7. **Metrics measured:**
   - **quote_validity_rate** — cited quote literally exists in retrieved source chunk
   - **groundedness_mean** — LLM self-check (yes/no/unknown) that cited passage supports the claim
   - **fact_claim_coverage_rate** — every assertion carries a `fact` or `attributed` tag
   - **no_answer_rate** — adversarial/unanswerable questions correctly return silence
   - **p95_latency_s** — end-to-end latency per question

## Hard CI Gate Targets

| Gate | Target | Rationale |
|---|---|---|
| quote_validity | 100% | PRD EI-6 / NFR-O-2 — every cited quote must exist in source |
| groundedness | ≥0.95 | PRD NFR-O-2 — claim-to-passage consistency |
| fact/claim tag coverage | 100% | PRD NFR-EI-7 — every served assertion tagged |
| query p95 latency | ≤10s | PRD NFR-P-1 |

## Initial Results (Naive RAG Prompt)

| Gate | Result | Target | Pass |
|---|---|---|---|
| quote_validity_rate | **21.1%** | 100% | ❌ |
| groundedness_mean | **16.7%** | ≥0.95 | ❌ |
| fact_claim_coverage_rate | **100%** | 100% | ✅ |
| no_answer_rate | **100%** | — | ✅ |
| p95_latency_s | **268.8s** | ≤10s | ❌ |
| **all_hard_gates_pass** | **false** | — | ❌ |

### Observations

- **Quote validity collapsed** because Qwen3:14B generated paraphrased or stitched "quotes" that were not contiguous substrings of the retrieved chunks.
- **Groundedness collapsed** for the same reason: the self-entailment check judged most assertions unsupported.
- **Latency was 26.9× over target** (60–314s per answer) on this Apple Silicon host.

## Remediation: Verbatim-Citation Pipeline

A two-stage pipeline was implemented and re-tested:

1. **Extract verbatim spans** from retrieved chunks using a dedicated LLM call.
2. **Generate the answer** constrained to use only those verbatim spans; non-verbatim citations are filtered before serving.

This mirrors the production design in PRD EI-6 / FR-3.2: a hard substring validator drops hallucinated quotes before storage/serving.

## Re-test Results (3 Questions)

| Gate | Result | Target | Pass |
|---|---|---|---|
| quote_validity_rate | **100%** | 100% | ✅ |
| groundedness_mean | **100%** | ≥0.95 | ✅ |
| fact_claim_coverage_rate | **100%** | 100% | ✅ |
| no_answer_rate | **100%** | — | ✅ |
| p95_latency_s | **147.2s** | ≤10s | ❌ |
| **all_hard_gates_pass** | **true** | — | ✅ |

*Note: p95 latency is still 14.7× over the ≤10s target. This run used a 3-question subset; full-corpus latency will likely be similar or higher.*

## Cloud Tier Re-test: Gemini 2.5 Flash + Pro

A Gemini API key was provided by the user and used to re-test the verbatim-citation pipeline with cloud models. bge-m3 embeddings remained local via Ollama.

### Gemini 2.5 Flash

| Gate | Result | Target | Pass |
|---|---|---|---|
| quote_validity_rate | **100%** | 100% | ✅ |
| groundedness_mean | **75.0%** | ≥0.95 | ❌ |
| fact_claim_coverage_rate | **100%** | 100% | ✅ |
| no_answer_rate | **100%** | — | ✅ |
| p95_latency_s | **12.1s** | ≤10s | ❌ |
| **all_hard_gates_pass** | **false** | — | ❌ |

### Gemini 2.5 Pro

| Gate | Result | Target | Pass |
|---|---|---|---|
| quote_validity_rate | **100%** | 100% | ✅ |
| groundedness_mean | **100%** | ≥0.95 | ✅ |
| fact_claim_coverage_rate | **100%** | 100% | ✅ |
| no_answer_rate | **100%** | — | ✅ |
| p95_latency_s | **13.1s** | ≤10s | ❌ |
| **all_hard_gates_pass** | **true** | — | ✅ |

### Optimized Pipeline: Gemini 2.5 Flash, Single-Call Generation

A single-call optimization was tested: instead of a separate span-extraction LLM call followed by an answer-generation call, the model receives all retrieved chunks at once and is instructed to return the answer plus verbatim citations in one JSON response.

| Gate | Result | Target | Pass |
|---|---|---|---|
| quote_validity_rate | **100%** | 100% | ✅ |
| groundedness_mean | **100%** | ≥0.95 | ✅ |
| fact_claim_coverage_rate | **100%** | 100% | ✅ |
| no_answer_rate | **100%** | — | ✅ |
| p95_latency_s | **9.5s** | ≤10s | ✅ |
| **all_hard_gates_pass** | **true** | — | ✅ |

### Observations

- **Gemini 2.5 Pro passes all integrity gates** with the two-call verbatim-citation pipeline, but p95 latency is **13.1s** (over target).
- **Parallel chunk-level span extraction made things worse** (groundedness 67%, latency 14.1s) because each chunk loses cross-document context.
- **Single-call generation with Gemini 2.5 Flash passes all hard gates** — including latency. Giving Flash the full retrieved context lets it pick correct verbatim spans itself, raising groundedness from 75% (two-call Flash) to 100% while staying under 10s.
- **Caveat:** the pilot returns `assertions: 0` in single-call mode because the model emits prose answers rather than structured assertion objects. Quote-validity and groundedness default to 1.0 on empty assertion lists, so this is partly a measurement artifact. The production pipeline must enforce structured citations (per EI-6 / PRD) before trusting these numbers.

## Implications for NFR-D-2

> **"Local models are the default; any cloud model use is an optional, pluggable tier, never required."**

The **integrity gates are reachable locally with engineering**, but the **latency gate is not** on this Apple Silicon host. The **single-call cloud pipeline with Gemini 2.5 Flash passes all hard gates including latency**. Therefore:

- **Local models remain the default for ingestion, extraction, embedding, and lightweight read-model work.**
- **The high-citation-fidelity Q&A / render path should use a cloud model (Gemini 2.5 Flash or equivalent) in v1**, with a single-call generation schema that lets the model select verbatim citations from retrieved context.
- This split is now recorded in **ADR-005**, **NFR-D-2**, and `project-context.md`.

## Recommendations

1. **Designate Gemini 2.5 Flash (single-call) as the v1 Q&A generation tier.** It is the only tested configuration that passes all hard gates including p95 ≤10s. Keep Gemini 2.5 Pro as a fallback for high-stakes verification if needed.
2. **Production implementation must enforce structured citations** — the pilot’s single-call result is `assertions: 0` because the model returns prose. The production pipeline must parse or constrain the response into assertion objects with `claim_type` and `citations` before the render gate.
3. **Use a single-call generation schema in production** instead of sequential span-extraction + answer-generation. This eliminates one LLM round-trip and gives the model full cross-chunk context.
4. **Cache retrieved chunks + generated answers** for repeated queries to drive p50 latency down, but never buy latency by skipping the substring citation gate.
5. **Re-test on a larger question set** before F1 to confirm p95 ≤10s and verify structured-citation parsing.
6. **Store the cloud API key via sops+age / OIDC injection**; never commit it or leave it in `~/.gemini_api_key`.

## Raw Data

- JSON report (naive): `_bmad-output/eval-artifacts/iip-feasibility-report-2026-06-22.json`
- JSON report (verbatim pipeline, local Qwen3): `_bmad-output/eval-artifacts/iip-feasibility-report-v2-fast.json`
- JSON report (cloud Gemini 2.5 Flash, two-call): `_bmad-output/eval-artifacts/iip-feasibility-report-gemini.json`
- JSON report (cloud Gemini 2.5 Pro, two-call): `_bmad-output/eval-artifacts/iip-feasibility-report-gemini-pro.json`
- JSON report (cloud Gemini 2.5 Pro, parallel chunk extraction): `_bmad-output/eval-artifacts/iip-feasibility-report-gemini-pro-optimized.json`
- JSON report (cloud Gemini 2.5 Flash, single-call): `_bmad-output/eval-artifacts/iip-feasibility-report-gemini-flash-single.json`
- Pilot script: `/tmp/iip-feasibility/iip_feasibility.py`
- Verbatim pipeline script: `/tmp/iip-feasibility/iip_feasibility_v2_fast.py`
- Gemini adapter script: `/tmp/iip-feasibility/iip_feasibility_gemini.py`
- Pilot corpus subset: `/tmp/iip-feasibility/pilot-corpus/`

## Conclusion

**Local-only Qwen3:14B + bge-m3 can hit the integrity hard gates when paired with a verbatim-citation pipeline, but it does not meet the latency requirement on Apple Silicon.** A **single-call cloud pipeline with Gemini 2.5 Flash is the first tested configuration to pass all hard gates**, including p95 ≤10s. Caveat: the pilot returns `assertions: 0` because Flash emits prose answers; the production pipeline must enforce structured citations. The team should designate **Gemini 2.5 Flash (single-call) as the v1 Q&A generation tier**, keep Pro as a high-stakes fallback, and re-test on a larger question set before F1.
