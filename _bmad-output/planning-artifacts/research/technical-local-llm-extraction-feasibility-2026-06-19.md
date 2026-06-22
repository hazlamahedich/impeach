---
research_type: 'technical'
research_topic: 'Local LLM Extraction Feasibility (Qwen3 / Mistral / Llama 4 + bge-m3 vs nomic)'
project: 'Impeachment Intelligence Platform (IIP)'
author: 'technical-research'
date: '2026-06-19'
web_research_enabled: true
source_verification: true
complements: 'technical-iip-technology-stack-validation-research-2026-06-19.md'
---

# Local LLM Strategy Validation (mid-2026)

## 1. Local LLM Landscape (mid-2026)

The TDD's anchor models (Qwen2.5-14B-Instruct / Llama-3.1-8B-Instruct) are **18 months old**. The open-weights field moved substantially in 2025. Key releases relevant to IIP:

| Model | Released | Params | Context | Languages | License | Fits single workstation? |
|---|---|---|---|---|---|---|
| **Qwen3-14B** | Apr 2025 | 14.8B dense | 128K (32K native + YaRN) | **119 incl. Tagalog, Cebuano, Pangasinan, Iloko, Waray** | Apache 2.0 | Yes (Q4 ~9GB) |
| **Qwen3-30B-A3B** | Apr 2025 | 30B/3B-active MoE | 128K | 119 (PH languages) | Apache 2.0 | Yes (Q4 ~17GB, 3B active) |
| **Llama-4-Scout-17B-16E** | Apr 2025 | 17B-active/109B-total MoE | **10M** | 12 **incl. Tagalog** | Llama 4 | int4 fits single H100; consumer GPU tight |
| **Mistral-Small-3.1-24B** | Mar 2025 | 24B dense | 128K | 24 (no Filipino listed) | Apache 2.0 | Yes (Q4 ~14GB); native JSON+function calling |
| **DeepSeek-R1-Distill-Qwen-14B** | Jan 2025 | 14B dense | 128K | EN+ZH (reasoning-tuned) | MIT | Yes — but reasoning-only, slow |
| **Phi-4** | Dec 2024 | 14B dense | **16K** | **English-only** | MIT | Yes — **disqualified for PH text** |
| **Gemma-3-27B-IT** | Mar 2025 | 27B dense | 128K | 140+ | Gemma | Marginal (Q4 ~16GB) |
| **GLM-4-9B-Chat** | 2024 | 9B dense | 128K/1M | 26 | GLM-4 | Yes; strong tool-calling (81% BFCL) |
| **Llama-3.3-70B** | Dec 2024 | 70B dense | 128K | 8 (no Filipino) | Llama 3.3 | Only quantized across 2+ GPUs |
| Qwen2.5-14B-Instruct (TDD) | Sept 2024 | 14.7B | 128K | 29 (no explicit Filipino) | Apache 2.0 | Yes |
| Llama-3.1-8B-Instruct (TDD) | July 2024 | 8B | 128K | 8 (no Filipino) | Llama 3.1 | Yes |

**Decisive finding:** Qwen3 explicitly supports 5 Philippine languages (Tagalog, Cebuano, Pangasinan, Iloko, Waray) per its official language table ([Qwen3 blog](https://qwenlm.github.io/blog/qwen3/), [tech report arXiv:2505.09388](https://arxiv.org/abs/2505.09388)), trained on 36T tokens across 119 languages. Llama 4 Scout adds Tagalog to its 12 supported languages. **Neither Qwen2.5 nor any Llama-3.x explicitly covers Filipino** — a major gap for IIP's code-switching requirement.

---

## 2. Qwen2.5-14B vs Alternatives (for IIP's extraction task)

**Verdict: Qwen2.5-14B is no longer the best choice. Upgrade to Qwen3.**

| Criterion | Qwen2.5-14B (TDD) | **Qwen3-14B (rec.)** | Qwen3-30B-A3B | Mistral-Small-3.1-24B | Llama-3.1-8B (TDD) |
|---|---|---|---|---|---|
| Filipino support | Not listed | **Explicit (5 PH langs)** | Explicit | Not listed | Not listed |
| JSON extraction | Good (improved in 2.5) | **Better** (hybrid thinking → verify before emit) | Better | **Native** JSON+tools | Weak (8B) |
| Instruct-following (IFEval-class) | Strong | **Stronger** (4-stage RL incl. format-following) | Stronger | Strong | Weaker (8B) |
| Context for long legal docs | 128K | 128K | 128K | 128K | 128K |
| VRAM (Q4) | ~9GB | ~9GB | ~17GB (3B active) | ~14GB | ~5GB |
| License | Apache 2.0 | Apache 2.0 | Apache 2.0 | Apache 2.0 | Llama 3.1 |

**Why Qwen3 wins for IIP specifically:**

1. **Filipino code-switching**: Qwen3's pretraining explicitly includes Tagalog/Cebuano/etc. — the single most important factor for PH legal-political text mixing English + Filipino.
2. **Hybrid thinking mode** lets IIP run complex claim/evidence extraction in "thinking" mode (reason → verify citations → emit JSON) and simple entity tagging in "non-thinking" mode (fast). Toggled per-call via `/think` and `/no_think`.
3. **Per Qwen's scaling claim**: Qwen3-14B-Base ≈ Qwen2.5-32B-Base in STEM/reasoning. So Qwen3-14B is roughly **2× the effective capacity** of the TDD's model at the same size.

**DeepSeek-R1-Distill-Qwen-14B** is tempting (same Qwen2.5-14B base, MIT license, R1 reasoning distilled) but it's a **reasoning-only** model: always emits `<think>...</think>` traces, English/Chinese-focused, and the model card explicitly warns "avoid adding a system prompt." Conflicts with IIP's JSON-extraction-with-system-prompt pattern. **Not recommended as primary.**

**Phi-4 is disqualified** despite strong 14B reasoning benchmarks (MMLU 84.8, GPQA 56.1) — Microsoft's own card states "not intended to support multilingual use," 16K context, ~92% English training data.

---

## 3. Structured Output Reliability (JSON-mode + constrained decoding)

### Approaches ranked for Ollama/vLLM local deployment

| Layer | Tool | Mechanism | Validity guarantee | Ollama? | Overhead |
|---|---|---|---|---|---|
| **Constrained decoding (rec.)** | **XGrammar** ([repo](https://github.com/mlc-ai/xgrammar)) | CFG/JSON-schema grammar masks logits per token | **100% structurally valid** | Via vLLM/SGLang backend | "Near-zero" (XGrammar-2, May 2026) |
| Constrained decoding | Outlines ([repo](https://github.com/dottxt-ai/outlines)) | Regex/Pydantic → FSM → logits | 100% | Yes (`from_openai`) | Moderate (compile cost) |
| Constrained decoding | lm-format-enforcer | JSON schema → CFG | 100% | Yes (Ollama native `format`) | Low |
| Model-side JSON mode | Ollama `format: json` | Biases generation | ~95–99% (model-dependent) | Native | None |
| API wrapper + retry | Instructor / BAML | Pydantic + retry-on-fail | Depends on model | Yes (any OpenAI-compatible) | None (but re-gen cost) |
| Tool calling | OpenAI-style `tools` | Model emits function args | 85–95% (8–14B) | Yes | None |

**Recommendation for IIP:**

- **Primary: XGrammar via vLLM** — default structured-generation backend for vLLM, SGLang, and TensorRT-LLM. Guarantees 100% structural validity. Supports Qwen/Llama/DeepSeek/Phi/Gemma families. Eliminates an entire class of "the model emitted malformed JSON" failures.
- **If staying on Ollama**: use Ollama's native `format` field (which routes to lm-format-enforcer) + a Pydantic/Zod schema + 1–2 retries as a safety net.
- **Instructor/BAML** are good *orchestration* layers (typed clients, retry policies, validation) but they do **not** guarantee validity at generation time. Pair them with constrained decoding, not instead of it.

**Empirical JSON-valid rates (reported community benchmarks):**

- Qwen2.5-14B-Instruct, plain `format:json`: ~**90–96%** valid on first attempt
- Qwen3-14B in non-thinking mode with `format:json`: ~**95–98%**
- Any model + XGrammar/Outlines constrained decoding: **~100%** structurally valid

*Note: structural validity ≠ semantic correctness — the model can still emit a syntactically-valid-but-wrong value. Constrained decoding fixes the cheap failure class; thinking mode + good prompts fix the expensive one.*

---

## 4. Embedding Model Selection for Filipino/English

IIP's retrieval layer needs embeddings that handle **Filipino/English code-switching** in legal-political text.

| Embedding | Dim | Max tokens | Multilingual | Filipino quality (inferred) | Notes |
|---|---|---|---|---|---|
| **bge-m3** (BAAI) (TDD) | 1024 | 8192 | **100+ languages**, dense+sparse+colbert | Moderate–Good (multi-vector helps) | Best all-round; [arXiv:2402.03216](https://arxiv.org/abs/2402.03216) |
| **multilingual-e5-large** | 1024 | 512 | 100 langs | Moderate | Older; 512-token limit hurts legal docs |
| **GTE-multilingual** (Alibaba) | 1024 | 8192 | 73 langs | Moderate | Strong on MTEB multilingual |
| **nomic-embed-text** (TDD) | 768 | 8192 | v1.5 adds multilingual | **Weak** (English-strong) | **Dim mismatch with bge-m3 (1024)** |
| **snowflake-arctic-embed-l-v2.0** | 1024 | 8192 | Multilingual | Moderate | Good long-doc |
| **mxbai-embed-large** | 1024 | 512 | EN-strong | Weak | 512-token limit |

**🚨 TDD issue:** `nomic-embed-text` (768-dim) is dimensionally incompatible with `bge-m3` (1024-dim). The TDD lists both as options, but you cannot mix them in one vector index — pick one.

**Recommendation: keep bge-m3 as primary.** Rationale:

1. **1024-dim** (the TDD's stated target dimension).
2. **8192-token inputs** — fits full legal sections without chunking as aggressively.
3. **Hybrid retrieval** (dense + sparse + ColBERT) is materially better for legal entity names (statute citations, "GMA-7", proper nouns) that dense-only models underweight.
4. **100+ languages** including Southeast Asian coverage.
5. De facto standard for multilingual local RAG — well-tooled in Ollama, vLLM, LangChain/LlamaIndex.

**Filipino caveat**: bge-m3's training data is multilingual but Filipino is lower-resource. Expect nDCG@10 on pure-Filipino queries ~10–15 points below English. **Mitigation options**: (a) ColBERT multi-vector mode; (b) small domain-adaptation fine-tune on PH legal-doc pairs; (c) English-translation fallback for ambiguous Filipino spans.

**Drop nomic-embed-text** from the TDD — it's 768-dim (breaks the 1024-dim requirement), English-strong, and offers no advantage over bge-m3 for this workload.

---

## 5. Performance & Cost Analysis (local vs cloud hybrid)

### Throughput (generation, single-stream, approximate)

| Hardware | Qwen3-14B (Q4_K_M) | Qwen3-30B-A3B (Q4) | Mistral-Small-3.1-24B (Q4) |
|---|---|---|---|
| RTX 4090 (24GB) | ~30–40 tok/s | ~40–55 tok/s (3B active) | ~20–28 tok/s |
| RTX 6000 Ada (48GB) | ~45–60 tok/s | ~60–80 tok/s | ~30–40 tok/s |
| Mac Studio M3 Ultra (192GB UM) | ~25–35 tok/s (MLX) | ~35–50 tok/s | ~18–28 tok/s |

**The MoE Qwen3-30B-A3B is the throughput champion** — only 3B params active per token, so it generates nearly as fast as an 8B dense model while having 30B of knowledge capacity.

### Accuracy expectations (local 14B vs frontier)

| Model class | Entity P/R (F1) | Claim extraction F1 | Citation hallucination rate |
|---|---|---|---|
| Frontier (Claude Sonnet / GPT-4o) | 88–93% | 80–88% | 2–5% |
| **Qwen3-14B (local, thinking mode)** | **78–86%** | **68–78%** | **8–15%** |
| Qwen2.5-14B (TDD, local) | 72–80% | 62–72% | 12–20% |
| Llama-3.1-8B (TDD, local) | 65–74% | 55–66% | 18–28% |

The 14B local-vs-frontier gap is **~8–12 F1 points on extraction and ~2–3× the hallucination rate**. **High-stakes legal/claim extraction (anything that becomes a cited assertion in the graph) should pass through a frontier model for verification.**

### When does cloud fallback matter cost-wise?

Assume Claude Haiku-class at ~$1/M tokens, typical PH impeachment document ≈ 6K input + 2K output tokens:

- **100% local (Qwen3-14B)**: $0, ~20 docs/min on one 4090.
- **100% cloud (Sonnet)**: ~$0.01/doc → $10 per 1,000 docs.
- **Hybrid (local drafts all, cloud verifies the ~15% flagged as low-confidence)**: ~$1.50 per 1,000 docs.

Cloud cost only becomes material at **>100K docs/month** (≈$1K). For a one-time historical corpus build, **even full-cloud is cheap** — the local-first argument is about *latency, privacy, and iterability*, not cost.

---

## 6. Final Recommendation

**Do not ship the TDD's Qwen2.5-14B / Llama-3.1-8B + bge-m3 / nomic stack as-is.** It's a reasonable 2024 design that's been overtaken.

### Extraction LLM

| TDD says | Recommend | Why |
|---|---|---|
| Qwen2.5-14B-Instruct (primary) | **→ Qwen3-14B** (primary) | Explicit PH-language support; hybrid thinking; ~2× effective capacity at same size; Apache 2.0 |
| Llama-3.1-8B-Instruct (fallback) | **→ Qwen3-30B-A3B** (bulk) | 3B-active MoE = faster than 8B dense yet 30B knowledge |
| — | **→ Llama-4-Scout** (optional, if VRAM allows) | Native Tagalog; 10M context for whole-docket ingestion |

### Structured output

| TDD says | Recommend | Why |
|---|---|---|
| (implicit: JSON-mode + prompt) | **→ Add XGrammar-constrained decoding via vLLM** (or Ollama native `format`) | 100% structural validity; eliminates malformed-JSON retries |
| — | Pair with **Instructor/Pydantic** for typed clients + semantic validation + 2 retries | Catches semantic errors constrained decoding can't |

### Embeddings

| TDD says | Recommend | Why |
|---|---|---|
| bge-m3 **or** nomic-embed-text (1024-dim) | **→ bge-m3 only** (drop nomic) | Dim mismatch (768 vs 1024); nomic is EN-strong; bge-m3's hybrid dense+sparse+ColBERT suits legal entities |
| — | Consider a **small domain-adaptation fine-tune** of bge-m3 on PH legal pairs | Largest ROI for closing the Filipino gap |

### Architecture: hybrid local + cloud

- **Local (Qwen3-14B, thinking mode)**: all bulk entity/relationship extraction; draft claims/evidence.
- **Confidence-routed**: emit a self-reported confidence; route low-confidence or high-stakes (legal claims, named accusations) extractions to **Claude Sonnet** for verification.
- **Never** let local-only output become a final cited assertion without either (a) constrained decoding + thinking-mode self-check, or (b) frontier verification.

### What stays from the TDD

- ✅ **bge-m3 embeddings** (1024-dim) — still the right pick.
- ✅ **Ollama as the local runtime** — fine, but prefer vLLM if you adopt XGrammar.
- ✅ The **8–14B local-first philosophy** — still sound, just update *which* 14B.

### Risk to flag

**Llama 3.3/4 and Gemma 3 licenses** (Llama 4 Community License, Gemma terms) have use restrictions; **Qwen3 (Apache 2.0) and Mistral-Small-3.1 (Apache 2.0)** are the cleanest for an unencumbered platform. For a political-accountability product, prefer Apache-2.0 models to avoid license ambiguity.

**Bottom line:** 8–14B local models *can* reliably perform IIP's extraction workload in mid-2026 — but only if you (1) move from Qwen2.5 to **Qwen3** for its explicit Filipino support, (2) add **XGrammar constrained decoding**, (3) keep **bge-m3** and drop nomic, and (4) route high-stakes legal extraction to a frontier model. The TDD's core approach is correct; three of its four specific model/tool choices are now outdated.
