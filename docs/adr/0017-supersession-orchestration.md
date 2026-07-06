---
id: ADR-017
title: Supersession Orchestration — Mark, Don't Delete
status: Proposed
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), Mary (analyst), user]
related: [AC-11, SEC-6, FR-5.7, SC-8, ADR-010, ADR-016, ADR-025, ADR-027]
evidence:
  - evidence pending F18/F19
---

# ADR-017: Supersession Orchestration — Mark, Don't Delete

> **Status: Proposed.** Records the supersession model (retraction/correction
> propagation). `Proposed` pending F18/F19 evidence from the editorial-governance
> epic confirming the mark/tombstone/cache-invalidation contract.

## Context

FR-5.7 + AC-11 require retraction/correction **supersession**: when a source
is retracted or a claim corrected, the platform must propagate that through
the graph, the citations, and the cache — without destroying the historical
record. A defamation-grade system cannot silently delete a claim it previously
served cited; every render that cited the superseded node must remain
**reproducible-as-was** (the citation pointed at a real span that existed at
serve time) AND flagged-going-forward (a retraction is now surfaced).

STR-6(b) places the supersession orchestrator at
`packages/editorial/src/supersession.ts`, coordinating db + graph + citation.
The open question is the exact mark/tombstone/cache-invalidation contract.

## Decision

*(Proposed — confirmed by F18/F19.)*

1. **A superseded node is never deleted, only marked.** AGE rebuilds per
   affected partition (PC-2.5: drop + rebuild, not incremental upsert) with
   the supersession flag as a property; the canonical relational row carries a
   `superseded_by` reference (mirrors ADR frontmatter discipline).
2. **Citations retain the historical reference + a supersession flag.** A
   citation that pointed at a now-superseded span still resolves to the
   immutable raw snapshot (the span existed at serve time — provenance is
   intact); the render surfaces a retraction/correction marker rather than
   silently dropping or silently serving the stale claim. This preserves
   AC-4 citation-decoupling across edits.
3. **Cache invalidation is event-driven:** an AC-11 editorial-log
   `supersession` event busts the affected Redis cache keys (D3) so a stale
   superseded claim is not served from cache after a correction.
4. The lifecycle owner (`packages/lifecycle` / SC-8) owns tombstone semantics
   + retention bounds; the editorial orchestrator owns the supersession
   transaction (mark + graph rebuild trigger + cache bust + audit entry in one
   `withTx`).

## Alternatives

1. **Delete the superseded node + cascade.**
   - Rejected. Destroys the historical record: a previously-served citation
     would point at a deleted span, breaking reproducibility-as-was and the
     legal defense (the team served a real citation that no longer exists).
     Mark-don't-delete is the defamation-grade invariant.
2. **In-place mutation of the corrected claim (overwrite).**
   - Rejected. Same reproducibility loss; also breaks AC-11 append-only-log
     semantics (an overwrite is an undocumented edit). Corrections are new
     rows/versions; the old is marked superseded.
3. **Defer supersession to post-v1.**
   - Rejected for the model. Retraction handling is legally load-bearing
     (NFR-L-1…5, *Disini* republication risk); the mark-don't-delete contract
     must be in the schema from the start even if the UX surface matures later.

## Consequences

*(Proposed — confirmed at implementation.)*

- Superseded nodes are marked, not deleted; AGE partition rebuilds carry the
  flag; citations resolve historically + flag forward (ADR-010 citation tuples
  survive because the raw snapshot is immutable).
- The editorial log records every supersession event (AC-11); cache bust is
  event-driven (D3).
- Every render that cited a superseded node is reproducible-as-was AND flagged.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Does the supersession flag travel as a citation property, a render-time join, or both? | Architect | Story 8-3 (retraction/correction) |
| 2 | What is the retention bound on tombstoned nodes vs the immutable raw snapshot (right-to-be-forgotten tension, NFR-L-4)? | Legal/Architect | Pre-PD-3 gate (G7) |
| 3 | Is the AGE partition-rebuild on supersession bounded enough to not starve the query path (STR-2)? | Architect | Story 8-3 perf test |
