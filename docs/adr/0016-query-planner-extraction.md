---
id: ADR-016
title: Query Planner Extraction — In rag for v1, Plan-to-Extract Later
status: Proposed
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), Amelia (developer), user]
related: [PC-2, FR-5.1, STR-6, ADR-017]
evidence:
  - evidence pending F18/F19
---

# ADR-016: Query Planner Extraction — In rag for v1, Plan-to-Extract Later

> **Status: Proposed.** Records the v1 home of the Query Planner and the
> trigger to extract it to its own package. `Proposed` pending F18/F19
> multi-step tool-call evidence that confirms when extraction is warranted.

## Context

The Query Planner (TDD §11.1) computes a `FusionPlan { intent, retrieverIds,
strategy, k }` from a query: it picks which retrievers (pgvector ANN, AGE
Cypher, BM25) to fan out to and how to fuse their results (PC-2.2). The
constraint: the Query Planner **never imports retrievers directly** — callers
pass an `intent`, never a weights object, so AC-2 reproducibility does not die
on the first hot-tune (weights are config-keyed by intent, stamped into
`extractor_version`).

STR-6 flags that the Query Planner has no dedicated home in v1. The question
is where it lives now and when it earns its own package (`packages/planner`).

## Decision

*(Proposed — extraction trigger confirmed by F18/F19.)*

1. **v1: the Query Planner lives in `packages/rag`.** It is a module within
   the RAG package, not a separate package. The fusion router + CRAG node +
   planner share a package because v1 retrieval is single-process and tightly
   coupled.
2. **Extraction trigger:** when **multi-step tool-calls** land (the planner
   issues a sequence of retrievals, evaluates, and re-plans), extract the
   planner to `packages/planner`. This ADR records the plan-to-extract so the
   move is a tracked decision, not a silent refactor.
3. **Invariant preserved through any move:** the planner never imports
   retrievers directly; it emits a `FusionPlan` consumed by the fusion router.
   CRAG is the only ranking mutator (by replacement, not in-place reorder);
   HippoRAG is a planner tool (consumes the fused list), not a 4th retriever.

## Alternatives

1. **`packages/planner` from day one.**
   - Rejected for v1. Premature extraction — v1 retrieval is single-step and
     single-process; a separate package adds a build boundary + exports surface
     with no payoff yet. Extract when multi-step planning lands (the trigger).
2. **Planner inside `packages/graph` (graph-aware planning).**
   - Rejected. Conflates the projection (AGE graph) with the planning concern;
     the planner consumes graph *via* the AGE retriever port, not by living in
     the graph package.
3. **No planner (hard-coded fusion).**
   - Rejected. AC-2 reproducibility requires the `FusionPlan` to be
     `intent`-derived and version-stamped; hard-coded weights are not
     reproducible across query types.

## Consequences

*(Proposed — confirmed at extraction.)*

- v1: planner is a `packages/rag` module emitting `FusionPlan`; the fusion
  router consumes it; weights are config-keyed by intent + stamped into
  `extractor_version` (PC-2.6).
- The extraction to `packages/planner` is a tracked future move triggered by
  multi-step tool-calls; this ADR is amended/superseded at that point.
- AC-2 reproducibility: a result is reproducible given the `FusionPlan` +
  frozen index + `ef_search`, NOT the generated prose (AC-6).

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | At what multi-step-planning complexity does extraction to `packages/planner` pay off? | Architect | F18/F19 tool-call evidence |
| 2 | Should `FusionPlan` be a contracts-level zod schema so it crosses the rag→planner boundary cleanly post-extraction? | Architect | Pre-extraction |
| 3 | Is the `intent` taxonomy config-driven, and who owns new intents? | Architect/Analyst | First new query intent |
