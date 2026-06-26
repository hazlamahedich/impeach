---
id: ADR-012
title: LLM Observability — Pure OpenTelemetry, Langfuse Rejected
status: Accepted
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), Murat (test architect), user]
related: [NFR-O-1, NFR-O-2, PC-2.1, SC-5, SEC-4, ADR-014]
evidence:
  - _bmad-output/planning-artifacts/architecture.md (§observability: OTel + pino + Prometheus + runtime invariant monitoring; ADR-012 OTel-vs-Langfuse)
  - _bmad-output/planning-artifacts/research/technical-local-llm-extraction-feasibility-2026-06-19.md
---

# ADR-012: LLM Observability — Pure OpenTelemetry, Langfuse Rejected

## Context

NFR-O-1/NFR-O-2 require structured logs, metrics, and traces plus **runtime
invariant monitoring** (sampled live NLI, citation-drop SLOs, refutes-recall
on shadow traffic). The LLM calls (extraction, embedding, Q&A generation, NLI
gate) are the highest-risk surfaces: a hallucinated extraction or a silent
citation-drop is the defamation event. SC-9 mandates that the observability
choice (pure OTel vs an LLM-observability SaaS like Langfuse/Langsmith) be an
ADR so the rejection of the SaaS path survives — otherwise an LLM-observability
vendor eventually ships a tempting "one-line init" that re-introduces an
external dependency and a data-egress path.

## Decision

**Pure OpenTelemetry (OTel) for LLM observability. Langfuse/Langsmith are
rejected.**

1. LLM calls emit OTel spans (`gate()`, `extract()`, `embed()`,
   `query:answer`) with attributes for `modelId`, `promptVersion`,
   `schemaVersion`, `latencyMs`, `confidence`. The collector (Tempo or Jaeger)
   runs in the Testcontainers stack and the local Compose stack.
2. **VAL-9 is enforced via OTel:** a span on `gate()` is asserted against
  `gate_span_count == served_response_count` under BullMQ backpressure —
  proving the gate fires on every served render, not just that the gate is
  internally correct.
3. pino logs (TS) + structlog (Python, pino-compatible field names) feed the
  same pipeline; runtime invariants (citation-drop SLO, no-evidence ratio) are
  Prometheus metrics + alerting rules.
4. The OTel collector is local (NFR-D-1). No LLM-observability SaaS ships
  prompt/response content off the workstation.

## Alternatives

1. **Langfuse (self-hosted or cloud).**
   - Rejected. Langfuse is the strongest LLM-specific observability product,
     but (a) the cloud tier ships prompt/response content to a third party — a
     republication/retention risk under PH cyberlibel for defamation-grade
     prompts; (b) the self-hosted tier adds a Postgres + web container to an
     already ~14-container workstation (VAL-5 tension); (c) it creates a
     second tracing vocabulary alongside OTel. The OTel semantic conventions
     for GenAI (`gen_ai.*`) cover the LLM-specific attributes IIP needs.
2. **Langsmith (LangChain).**
   - Rejected. Cloud-only, LangChain-coupled, same data-egress + dependency
     concerns as Langfuse cloud.
3. **OTel + Langfuse hybrid.**
   - Rejected. Two tracing systems drift; the "rejection must survive an ADR"
     (SC-9) is precisely to prevent this hybrid creeping in later.

## Consequences

- One tracing pipeline (OTel) for LLM + non-LLM spans; one log pipeline (pino
  / structlog); one metrics pipeline (Prometheus). No vendor lock-in.
- LLM-specific attributes use OTel GenAI semantic conventions; the rejection
  of Langfuse is recorded here so a future "just add Langfuse" PR cites this
  ADR.
- The collector + Tempo/Jaeger run locally; the VAL-9 span assertion is a CI
  gate, not an aspiration.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Do OTel GenAI semantic conventions cover the `extractor_version` envelope fields, or do we need custom span attributes? | Architect | F4 extraction milestone |
| 2 | Is Tempo or Jaeger the better local collector for the trace-volume at F3+ scale? | DevOps | F3+ observability review |
| 3 | Should sampled-live-NLI be a span attribute or a dedicated Prometheus gauge? | Architect/QA | Runtime-invariant wiring (Epic 2) |
