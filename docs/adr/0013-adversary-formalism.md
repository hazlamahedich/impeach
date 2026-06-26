---
id: ADR-013
title: Adversary Formalism — Threat Model & Attack Taxonomies
status: Proposed
date: 2026-06-26
supersedes: null
superseded_by: null
deciders: [Winston (architect), Murat (test architect), Mary (analyst), user]
related: [AC-10, SEC-8, SC-4, SEC-2, SEC-5, ADR-004, ADR-018]
evidence:
  - evidence pending F18/F19
---

# ADR-013: Adversary Formalism — Threat Model & Attack Taxonomies

> **Status: Proposed.** This ADR records the chosen threat-modeling formalism
> for `packages/adversary` (SC-4). It is `Proposed` pending the F18/F19
> red-team + mutation-suite evidence (SEC-8) that will populate the `evidence`
> array and confirm the taxonomy covers the defamation-specific attack vectors.
> Per the adr-lint rule, `Proposed` ADRs may carry an "evidence pending" marker.

## Context

AC-10 defines the adversary concretely: a Philippine senator with
coordinated-inauthentic-behavior networks + rent-a-botnet budget = organized
with state-aligned optionality. SC-4 adds a `packages/adversary` package that
owns the threat model + attack taxonomies + invariant definitions, consumed by
both `eval` (red-team generation) and `observability` (runtime invariants). The
risk the package prevents: the threat model drifting between the two readers
(eval sees one adversary, observability monitors for another).

The open question is which **formalism** the package encodes: STRIDE, MITRE
ATLAS (AI/ML adversary matrix), attacker trees, or a defamation-specific
hybrid. SEC-8's red-team suite (libel-injection, slow-poisoning,
republication-framing, adversarial-query, source-attribution, tamper) is the
concrete attack surface the formalism must cover.

## Decision

*(Proposed — to be confirmed by F18/F19 evidence.)*

1. **Adopt a hybrid: STRIDE for the system/infrastructure surface + a
   defamation-specific attacker tree for the content/provenance surface.**
   STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of
   service, Elevation of privilege) maps cleanly to SEC-1/SEC-2/SEC-4/SEC-6
   (spoofing = forged principal; tampering = citation-swap; repudiation =
   unsigned editorial action; etc.).
2. **MITRE ATLAS informs the ML-specific tactics** (prompt injection, model
   evasion, training-data poisoning → the slow-poisoning eval), but ATLAS is
   advisory cross-reference, not the primary taxonomy — it does not cover the
   defamation/republication risk that is IIP's defining threat.
3. The defamation attacker tree roots at "serve a defamatory, uncited, or
   misattributed assertion" and branches by the SEC-8 vectors; each branch maps
   to an invariant in `docs/invariant-ledger.yaml` (T1 severity) and a red-team
   generator in `tools/eval`.
4. `packages/adversary` is the SINGLE source both eval and observability read
   (SC-4) — preventing the two-reader drift.

## Alternatives

1. **STRIDE only.**
   - Insufficient alone. STRIDE models the system surface well but has no native
     concept of defamation/republication liability or the RAG failure modes
     (context conflation, source mixing). Needs the defamation attacker tree.
2. **MITRE ATLAS only.**
   - Insufficient alone. ATLAS covers ML/LLM attacks but omits the
     provenance/hash-chain/editorial-log threats (SEC-6) that are IIP's
     load-bearing wall.
3. **Attacker trees only.**
   - Loses the STRIDE coverage check (a STRIDE pass is a completeness heuristic
     for "did we forget a threat class"). Hybrid keeps the heuristic.
4. **OCTAVE / PASTA (risk-centric frameworks).**
   - Overweight for v1 (organization/process-heavy). Revisit if a formal risk
     assessment is required for the PD-3 legal gate (G7).

## Consequences

*(Proposed — confirmed when evidence lands.)*

- `packages/adversary` encodes the hybrid taxonomy; eval + observability import
  it (SC-4), so red-team generators and runtime-invariant monitors reference
  the same attacker tree.
- Each SEC-8 red-team vector maps to an attacker-tree branch + a T1 invariant;
  the invariant ledger is the executable spec (PC-9).
- This ADR moves to `Accepted` when the F18/F19 evidence confirms the taxonomy
  covers all SEC-8 vectors without gaps.

## Open questions

| # | Question | Owner | Trigger |
|---|----------|-------|---------|
| 1 | Does the hybrid taxonomy cover all six SEC-8 vectors with no orphan threats? | Test Architect/Analyst | F18/F19 red-team evidence |
| 2 | Should the defamation attacker tree be machine-readable (JSON) so eval can walk it? | Architect | SC-4 package implementation |
| 3 | Is insider/coercion (the P0 tabletop) in-scope for the formal taxonomy or handled separately? | Security/Analyst | Pre-PD-3 tabletop |
