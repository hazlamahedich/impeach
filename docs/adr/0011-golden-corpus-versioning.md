---
id: ADR-011
title: Golden Corpus Versioning — Content-Addressed In-Repo Store
status: Accepted
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), Murat (test architect), John (PM), user]
related: [AC-1, AC-6, SC-7, NFR-A-2, ADR-014, ADR-025]
evidence:
  - _bmad-output/planning-artifacts/architecture.md (AC-1 eval harness owns versioned golden corpus in-repo; SC-7 gate artifact store content-addressed; AC-6 reproducibility)
  - _bmad-output/planning-artifacts/epics.md (AC-F1-04 — historical path reference `packages/eval/corpus/golden/v0/` corrected to active `eval/corpus/golden/v0/` form in Amendment 1, 2026-07-03)
  - eval/corpus/golden/v0/manifest.json (active root-anchored golden corpus store — path corrected 2026-07-03, see Amendment 1)
  - eval/corpus/golden/filipino/v0/manifest.json (per-language parallel chain — target-state, see Amendment 2; ADR-0025 §2)
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
in-repo under `eval/corpus/golden/<version>/` (root-anchored — see Amendment 1
for the path correction from the original `packages/eval/...` form; see
Amendment 2 for the 2-D `language × version` extension).**

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

- `eval/corpus/golden/v0/` (+ future `v1/`, …) is the in-repo golden corpus;
  `manifest.json` per version carries the content hash that keys SC-7 gate
  artifacts. *(Path corrected 2026-07-03 — see "Amendment 1" below; the
  original `packages/eval/corpus/golden/` form was a spec/text variance from
  the root-anchored active convention.)*
- AC-1 immutability + AC-11 append-only-log bounds are enforced by the
  lifecycle owner (SC-8); a PR that mutates a versioned item fails CI.
- Eval results (ADR-014) reference the corpus hash, making a gate decision
  reproducible-as-of-the-corpus-that-produced-it (AC-6).
- **Per-language parallel manifest chains (Amendment 2, 2026-07-03):** the
  version model is 2-D (language × version), not 1-D. See "Amendment 2" below.

### Amendment 1 (2026-07-03) — Path correction: `eval/corpus/golden/` is the active root

The original Decision (§3.1) and Consequences named the store as
`packages/eval/corpus/golden/<version>/`. **That path was a spec/text
variance from the active convention**, which is root-anchored
`eval/corpus/golden/<version>/`:

- `packages/eval/src/freeze.ts` `DEFAULT_CORPUS_DIR = 'eval/corpus/golden'`
  (root-anchored, not package-relative).
- The `iip-eval freeze` CLI resolves `--corpus-dir` relative to the repo root.
- The actual on-disk store is `eval/corpus/golden/v0/`, `eval/corpus/golden/v1/`
  (root-anchored).

**Correction:** the canonical path is `eval/corpus/golden/<version>/`
(root-anchored). The `packages/eval/corpus/...` form in the original ADR text
and in ADR-0025 §2 is struck; both ADRs now reference the root-anchored
convention. The content-addressing semantics (manifest hash = corpus-version
identity) are unchanged — only the textual path is corrected.

### Amendment 2 (2026-07-03) — Per-language parallel manifest chains (2-D versioning)

**Trigger:** ADR-0025 (Filipino salience eval-set) introduces a *second* golden
corpus tier — Filipino/Taglish — alongside the English tier. The original
1-D version model (`v0 → v1 → v2 → …`, a single linear chain) is ambiguously
specified for a multi-language corpus: does `v1` mean "English v1" or "the
merged English+Filipino v1"? ADR-0025 forbids a blended English+Filipino mean
(a strong English stratum would mask a failing Filipino stratum), so the two
tiers MUST be independent chains.

**Decision: the version model is 2-D — `language × version`.** Each language
tier has its OWN independent manifest chain under
`eval/corpus/golden/<language>/<version>/`:

- `eval/corpus/golden/v0/`, `eval/corpus/golden/v1/` — the **English** (default)
  chain. The `<language>` segment is OMITTED for the default/English tier
  (backwards-compatible with the original 1-D paths; English is the volume
  production path per VAL-10).
- `eval/corpus/golden/filipino/v0/`, `eval/corpus/golden/filipino/v1/` — the
  **Filipino** salience chain (ADR-0025). Created as target-state in Story
  2.6b-code (empty manifest today; the annotation lands in Story 2.6b-measure).
- Future languages (`cebuano/`, `ilocano/`, …) each get their own
  `eval/corpus/golden/<lang>/<version>/` chain.

**Why parallel chains, not one merged chain:**

1. **Independent versioning cadence.** The English corpus (volume production)
   and the Filipino corpus (salience, procurement-gated) version on different
   schedules. A merged `v1` forces them to move in lockstep; parallel chains
   let each tier version independently.
2. **No blended mean (ADR-0025 §4).** A single chain implies a single aggregate
   gate; ADR-0025 forbids this. Each language tier is scored + gated
   separately, so each needs its own content-addressed identity.
3. **Content-addressing is per-chain.** The manifest hash (the corpus-version
   identity consumed by SC-7) is computed over ONE chain's manifest. A merged
   chain's hash would mix languages, defeating the per-language gate.
4. **Reproducibility (AC-6).** An eval result references `(language, version,
   manifest-hash)`; with parallel chains this triple is unambiguous. Under a
   merged chain, "the corpus that produced this gate decision" is ambiguous
   across languages.

**SC-7 gate-key extension:** the gate artifact store address becomes
`eval/gates/<language>/<corpus-hash>/` for non-default languages, and remains
`eval/gates/<corpus-hash>/` for the English default (backwards-compatible).
The `freezeCorpus(corpusDir)` primitive + `--corpus-dir` CLI flag already
parameterize the tier — no `freeze.ts` edit was needed (the directory IS the
tier identity); a caller passes `eval/corpus/golden/filipino/v0` to freeze the
Filipino tier.

**Open Question #2 (κ versioning) — RESOLVED by ADR-0025:** the original OQ #2
asked whether inter-rater agreement (κ) should be versioned alongside the
corpus. **Yes** — ADR-0025 §2 + §3 settle this: the SHA-256 covers the
*provenance manifest* (labels + annotator attestations + `llm-exposed` flags,
which INCLUDES the κ-bearing annotation data), NOT the source text. The κ
measurement is therefore content-addressed with the corpus version that
produced it. OQ #2 is closed.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | At what corpus size does in-repo storage hurt git performance enough to revisit git-LFS or a CAS? | Architect | When golden corpus exceeds ~10k items / repo bloat |
| ~~2~~ | ~~Should inter-rater agreement judgments (krippendorff α) be versioned alongside the corpus in the manifest?~~ **RESOLVED 2026-07-03 (Amendment 2): YES — the SHA-256 covers the provenance manifest (labels + attestations + κ), per ADR-0025 §2/§3.** | ~~Analyst/QA~~ | ~~SC-1 eval wiring (Epic 4)~~ |
| 3 | Is the manifest hash the sole gate key, or do frozen-index + ef_search also enter the SC-7 address? | Architect | Pre-PD-3 gate (G1/G2) |
| 4 | (New, Amendment 2) When a third language tier lands (e.g. Cebuano), does the default-English path convention (`golden/v0/` vs `golden/english/v0/`) scale, or should English gain an explicit `english/` segment at that point? | Architect | First non-Filipino, non-English language tier |
