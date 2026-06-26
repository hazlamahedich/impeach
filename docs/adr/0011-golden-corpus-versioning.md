---
id: ADR-011
title: Golden Corpus Versioning — Content-Addressed In-Repo Store
status: Accepted
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), Murat (test architect), John (PM), user]
related: [AC-1, AC-6, SC-7, NFR-A-2, ADR-014]
evidence:
  - _bmad-output/planning-artifacts/architecture.md (AC-1 eval harness owns versioned golden corpus in-repo; SC-7 gate artifact store content-addressed; AC-6 reproducibility)
  - _bmad-output/planning-artifacts/epics.md (AC-F1-04: packages/eval/corpus/golden/v0/)
---

# ADR-011: Golden Corpus Versioning — Content-Addressed In-Repo Store

## Context

AC-1 makes the evaluation harness the 8th architectural plane, and it owns a
**versioned golden corpus** in-repo. The corpus is the ground truth against
which every integrity gate is measured (citation coverage, fact/claim tagging,
NLI entailment, refutes-recall). AC-6 scopes reproducibility to "corpus
snapshot + frozen index + fixed `ef_search` + NLI scores" — so the corpus must
be **addressable by content hash**, not by a mutable branch tip. SC-7's gate
artifact store (`eval/gates/<corpus-hash>/`) already keys decisions to a
SHA-256 of the frozen corpus; the corpus storage must agree.

The question is how the golden corpus is stored and versioned: git-LFS vs a
content-addressed store with an explicit manifest.

## Decision

**A content-addressed golden-corpus store with a versioned manifest, kept
in-repo under `packages/eval/corpus/golden/<version>/`.**

1. Each corpus version has a `manifest.json` enumerating items (each a zod
   `GoldenItem`) with per-item SHA-256. The manifest itself is hashed; the
   manifest hash IS the corpus version identity consumed by SC-7
   (`eval/gates/<corpus-hash>/`).
2. **Items are stored directly in git** (not git-LFS). The v1 corpus is small
   (seed N≥1 items, scaling to hundreds, not GB-scale); git-LFS's external
   object store reintroduces a hosting dependency (NFR-D-1) and a
   pointer-file indirection that defeats content-addressing-by-hash grep.
3. **Immutability is enforced** (AC-1 / SC-8): a versioned corpus directory is
   append-only; changing an item creates a new version directory + new manifest
   hash, never an in-place mutation. The lifecycle owner (`packages/lifecycle`
   / SC-8) enforces this bound.
4. Corpus versions are first-class inputs to eval (ADR-014): the polyglot eval
   invocation receives the corpus hash, so TS and Python sides agree on ground
   truth and a result is always traceable to a frozen corpus.

## Alternatives

1. **git-LFS.**
   - Rejected. Introduces an external LFS object-store hosting dependency
     (violates local-first NFR-D-1 for the v1 small-corpus case), and the
     pointer-file scheme hides the actual content from hash-based addressing
     and grep. git-LFS is the right tool at GB-scale; the golden corpus is not
     that scale in v1.
2. **External content-addressed store (MinIO bucket for the golden corpus).**
   - Rejected for v1. Splits the corpus out of the repo, breaking AC-6
     "reproducible = corpus snapshot checked into the version that produced the
     result." The golden corpus must travel with the commit that produced the
     eval result. MinIO is for immutable raw snapshots of fetched sources, not
     the curated eval ground truth.
3. **Single mutable `golden/` directory, no versioning.**
   - Rejected. AC-6 + SC-7 require corpus-hash-addressed results; a mutable
     directory makes "the corpus that produced this gate decision" ambiguous.

## Consequences

- `packages/eval/corpus/golden/v0/` (+ future `v1/`, …) is the in-repo golden
  corpus; `manifest.json` per version carries the content hash that keys SC-7
  gate artifacts.
- AC-1 immutability + AC-11 append-only-log bounds are enforced by the
  lifecycle owner (SC-8); a PR that mutates a versioned item fails CI.
- Eval results (ADR-014) reference the corpus hash, making a gate decision
  reproducible-as-of-the-corpus-that-produced-it (AC-6).

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | At what corpus size does in-repo storage hurt git performance enough to revisit git-LFS or a CAS? | Architect | When golden corpus exceeds ~10k items / repo bloat |
| 2 | Should inter-rater agreement judgments (krippendorff α) be versioned alongside the corpus in the manifest? | Analyst/QA | SC-1 eval wiring (Epic 4) |
| 3 | Is the manifest hash the sole gate key, or do frozen-index + ef_search also enter the SC-7 address? | Architect | Pre-PD-3 gate (G1/G2) |
