---
id: ADR-008
title: NLI Entailment Gate in the Citation Engine
status: Accepted
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), Amelia (developer), Murat (test architect), user]
related: [AC-2, SC-2, SEC-5, NFR-O-2, RK-2a, ADR-001, ADR-010]
evidence:
  - _bmad-output/planning-artifacts/architecture.md (AC-2: substring prefilter backed by NLI entailment gate; §citation engine)
  - _bmad-output/planning-artifacts/research/technical-citation-eval-graph-viz-2026-06-19.md
  - _bmad-output/planning-artifacts/research/technical-orchestration-kg-construction-retrieval-2026-06-19.md
---

# ADR-008: NLI Entailment Gate in the Citation Engine

## Context

AC-2 requires that the render gate fail-closed when citation support is below
threshold. The mechanical chain is: a generated claim must be backed by a
citation whose source span actually **entails** the claim — not merely a
substring match. A substring prefilter is fast but insufficient: a span can
contain the claim's words while contradicting it ("the senator did **not**
vote against the bill"). To close the gap, the citation engine (SC-2,
`packages/citation`) needs a semantic verification step between substring
prefilter and the render gate.

The decision is *where* entailment lives and *what model* runs it, given that
it fires on every served render (VAL-9 gate-invocation-per-served-response)
and must not violate the p95 ≤10s latency gate (NFR-O-2) or the local-first
posture (NFR-D-1).

## Decision

1. **Add an NLI (Natural Language Inference) entailment gate inside
   `packages/citation`.** The render gate (`packages/render/gate.ts`,
   AC-2/SC-3) calls `verifyCitation(renderInput)`, which runs:
   - (a) a **substring prefilter** (fast fail on spans that don't contain the
     claim tokens), then
   - (b) an **NLI entailment check** (claim vs span → `{entails, score}`) for
     spans that pass the prefilter.
   A claim lacking an entailment-passing citation causes `verifyCitation` to
   throw `RenderViolation` and the render is withheld (P0 fail-closed).
2. **The NLI model is a local cross-encoder** served via the same local
   runtime as extraction (ADR-005), behind the `@iip/llm-router` interface
   (SC-5). The entailment threshold is a config knob stamped into
   `extractor_version` (PC-2.6) so threshold-at-time-T is provable (AC-6).
3. **NLI scores are reproducible artifacts.** For a fixed claim+passage under a
   pinned model + frozen index, the NLI score is reproducible (AC-6 scoped
   reproducibility); generated prose across model versions is explicitly NOT
   in the reproducibility scope.
4. **Continuous gating (SEC-5):** the gate fires on every render; sampled live
   NLI is a runtime invariant monitored by the observability plane (ADR-012).

## Alternatives

1. **Substring match only (no NLI).**
   - Rejected. Substring passes negated/contradicted spans (the "did not" case)
     and near-neighbor spans. For a defamation-grade system, a contradiction
     served as a citation is a worse failure than a missing citation. NLI is
     the minimal semantic floor.
2. **LLM-as-judge entailment (generative) on every render.**
   - Rejected as the default gate. A generative judge on every render blows
     the p95 ≤10s budget and re-introduces hallucination at the verification
     layer. A dedicated local cross-encoder is faster, deterministic under a
     pinned version, and smaller-surface than a generative model.
3. **NLI inside `packages/rag` (generation layer).**
   - Rejected. SC-2/SC-3 keep citation verification structurally separate from
     generation so the gate is unreachable from generation code. Putting NLI in
     `rag` would let generation bypass its own verifier (the exact anti-pattern
     AC-2 forbids).
4. **Defer NLI to post-PD-3.**
   - Rejected. Silent citation-drop / contradiction-under-load IS the
     defamation event (SC-6). Deferring the semantic gate leaves the render
     gate relying on substring alone through the chaos suite.

## Consequences

- `packages/citation` gains an entailment API; `packages/render` imports ONLY
  `verifyCitation` from `@iip/citation` (STR-4 boundary intact — render never
  imports `rag`).
- The NLI model + threshold are version-stamped; Stryker 100% on
  `packages/render/gate.ts` and ≥90% on `packages/citation/verify.ts` (PC-9).
- The gate fires on every render (VAL-9); an OpenTelemetry span on `gate()`
  asserts `gate_span_count == served_response_count` under BullMQ backpressure.
- Latency budget: NLI runs after the substring prefilter prunes the candidate
  set, so the cross-encoder evaluates few spans per render.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Which local cross-encoder best balances entailment accuracy vs p95 latency on the build host? | Architect/QA | F4/F5 retrieval milestone benchmark |
| 2 | What entailment threshold clears the defamation bar without over-withholding (precision/recall tradeoff)? | Analyst/Architect | Pre-PD-3 gate (G2) |
| 3 | Should NLI scores be persisted per (claim, span) for audit, or recomputed on each render? | Architect | AC-11 audit-log volume review |
