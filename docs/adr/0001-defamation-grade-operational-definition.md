---
id: ADR-001
title: Operational Definition of "Defamation-Grade" for IIP
status: Accepted
date: 2026-06-23
supersedes: null
superseded_by: null
deciders: [Mary (analyst), Winston (architect), John (PM), Murat (test architect), user]
related: [EI-1, EI-2, EI-3, EI-4, EI-5, EI-6, EI-7, EI-8, NFR-L-1, NFR-L-2, NFR-L-3, NFR-A-1, NFR-A-2, AC-2, SEC-5, SEC-6, FR-5.5, ADR-002, ADR-007, ADR-008, ADR-010, ADR-021, ADR-022]
evidence:
  - _bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/prd.md (EI-1 through EI-8, NFR-L-1 through NFR-L-5)
  - _bmad-output/planning-artifacts/architecture.md (AC-2, SEC-5, SEC-6, FR-5.5 gate)
  - _bmad-output/planning-artifacts/foundation-action-plan-2026-06-23.md (P0 trigger)
  - _bmad-output/planning-artifacts/research/domain-philippine-impeachment-knowledge-representation-standards-research-2026-06-19.md
---

# ADR-001: Operational Definition of "Defamation-Grade" for IIP

## Context

The IIP platform's central quality claim is "defamation-grade" — a system
whose outputs are safe to publish in a jurisdiction where cyberlibel under
the Cybercrime Prevention Act of 2012 (RA 10175) carries criminal penalties
for republication of defamatory material. Every architectural decision in
the platform references this grade. Yet through Story 1.3 of the
foundation, the term had **no operational definition**: no measurable
thresholds, no chain-of-custody contract, no sign-off authority, no testable
criteria.

A Party Mode adversarial review (6-agent panel, 2026-06-23) identified this
as the single highest-blast-radius gap in the program: every downstream
decision inherits an undefined standard. This ADR closes that gap.

## Decision

"Defamation-grade" for IIP means the platform satisfies **all** of the
following operational properties. Each property maps to specific binding
amendments and is testable.

### 1. Citation-Or-Silence (EI-1, AC-2, SEC-5)

Every factual assertion served to any audience — internal or external —
either:

- **Carries ≥1 valid citation** resolving to a stored raw snapshot +
  character span (EI-4, NFR-A-1), OR
- **Is suppressed** (fail-closed — no answer is served).

There is no uncited-answer path. The render gate fires on **every** render,
internal or external. Default action on missing/invalid citation support is
**WITHHOLD**, not "best effort."

**Threshold:** 100% citation coverage on served factual assertions (NFR-EI-1).
**Measurement:** Contract test (PC-9 property test — every emitted span has
non-null `citation.source_id`).
**Failure mode:** Uncited assertion served = P0 incident; allegation-as-fact
served = hard CI gate failure (NFR-EI-2).

### 2. Source Provenance Chain (EI-4, NFR-A-1, FR-1.4, FR-1.5)

Every served fact traces backward through an unbroken chain:

```
Served assertion
  → CitationTuple (source_doc_id, span_start, span_end, content_hash)
    → Immutable raw snapshot (MinIO, object-locked, SHA-256 verified)
      → Original fetched document (provenance-recorded at ingestion)
```

**Chain-of-custody requirements:**
- Raw snapshots are **immutable** (object locking: GOVERNANCE mode minimum)
- Every snapshot has SHA-256 or CID for tamper detection
- Content hash on citation tuple survives re-embedding (AC-4 decoupling)
- Character span pinpoints the exact passage in the source document

**Threshold:** 100% of served assertions resolve to stored raw snapshot +
span (NFR-EI-4, NFR-A-1).
**Measurement:** Audit test — given any served assertion, programmatically
retrieve the raw snapshot + span and confirm substring containment.

### 3. Fact vs Claim Distinction (EI-2, EI-3, EI-7)

Every served assertion is tagged as either:

- **Fact** (established, corroborated, sourced to a primary record), or
- **Attributed claim** (someone said this — source verb preserved verbatim)

The distinction is **mechanically enforced** at the render layer
(`packages/render`), not at editorial discretion. Source verbs ("ALLEGED",
"TESTIFIED", "VOTED", "DENIED", "CLAIMED") are preserved verbatim from the
source — never paraphrased, never softened, never strengthened.

**Threshold:** 100% fact/claim tag coverage on served assertions (NFR-EI-7);
0 allegation-as-fact incidents (NFR-EI-2, P0 on any occurrence).
**Measurement:** Render gate asserts tag exists before serving; sampled audit
for tag correctness (NFR-EI-7a).

### 4. Hash-Chained Editorial Log (AC-11, SEC-6)

Every action that creates, modifies, or surfaces content is recorded in an
append-only editorial log with:

- **SHA-256 hash chain** (each entry includes hash of previous entry)
- **Ed25519 signature** by the acting principal's key
- **Monotonic sequence number** (BIGINT, per-partition) as ordering key
- **No update/delete API** exposed (`EditorialLog.append()` only)

**Purpose:** The log is the **personal-criminal-exposure defense**. If the
platform serves defamatory content, the log proves who approved it, when,
and against what evidence. Without it, "the system did it" is not a defense
under PH cyberlibel.

**Threshold:** 100% of editorial actions logged; hash chain unbroken.
**Measurement:** Hash-chain integrity test on every append; periodic root
hash externally witnessed (SEC-6).

### 5. Trust-Tier Visibility (EI-8, SEC-3)

Every citation displays its **trust tier** to the user:

| Tier | Source Type | Examples |
|------|------------|----------|
| **1 (Primary)** | Government, court, official record | Senate roll-call, SC fallo, COMELEC resolution |
| **2 (Secondary)** | Reputable media, press release | Major news outlet, official statement |
| **3 (Aggregator)** | News aggregator, social media | Blog, news roundup, unverified |

**Lone tier-3 allegation about a named person** is **never served as
established** — it requires corroboration signal (EI-8). This is the
citation-quality floor.

**Threshold:** 100% of citations display trust tier; 0 lone tier-3
allegations served without corroboration marker (NFR-EI-8).
**Measurement:** Render gate asserts trust-tier presence; CI gate on
corroboration signal for tier-3-about-named-person.

### 6. Honest Non-Claims (EI-1, FR-5.3, FR-5.4)

The platform must not imply consistency, verification, or truth where it
has not established it. Specifically:

- **"No sourced answer found"** — explicit empty state when retrieval yields
  nothing. Never a fabricated or hedged guess.
- **No predictions** — "IIP does not make predictions" is a verbatim response
  pattern for predictive questions.
- **No "verified/confirmed/true"** — these words are banned from served
  output. Attributed claims use the source's exact verb.
- **Distinct outcomes** — "acquitted," "resigned," "voided by SC" are separate
  outcomes, never conflated.

**Threshold:** 0 instances of implied verification where none exists
(NFR-EI-2); 100% no-evidence states render the explicit empty state
(FR-5.3).
**Measurement:** Red-team eval suite (SEC-8) with libel-injection and
republication-framing attack vectors.

### 7. Pre-External Presentation Gate (FR-5.5, NFR-L-3)

**No content** may be shown to any audience outside the build team until:

1. **Corpus freeze** — demo corpus is content-hashed and frozen
2. **Adversarial pass** — red-team eval suite passes on frozen corpus
3. **Hard CI gates** — all defamation-grade gates green
4. **Recall split** — answer-rate vs citation-coverage split documented
5. **Independent spot-verification** — ≥30% externally authored adversarial set
6. **Editorial sign-off** — named human editorial owner approves
7. **Legal clearance** — cyberlibel/republication-aware legal review clears
8. **Honest-framing slide** — audience briefed on what the platform can/cannot do

**All eight sub-gates are machine-checkable where possible; human gates are
recorded in the editorial log.**

**Threshold:** G1–G8 all pass; gate is recorded (not informal).
**Measurement:** Gate artifact store (`eval/gates/<corpus-hash>/`) with
`decision.json` per gate run.

### 8. Reproducibility (NFR-A-2)

Re-extraction and graph rebuild are **deterministic and versioned**. Model
weights are pinned; extractor version (model + prompt + schema version) is
stamped on every extraction row. Dropping the graph and replaying relational
tables reproduces an isomorphic graph.

**Threshold:** Projection-determinism exact match on replay (NFR-O-2 hard
gate).
**Measurement:** Determinism hard gate in CI.

## Consequences

### What This Definition Enables

- **P1 of the action plan** can now write the citation invariant as a testable
  contract — the thresholds above ARE the test assertions.
- **The invariant ledger** (P4) can seed T1 invariants directly from this ADR.
- **Story acceptance criteria** can trace to specific grade properties by ID.
- **Legal review** has a concrete artifact to evaluate, not vibes.

### What This Definition Prohibits

- Serving any assertion without a citation (even internally)
- Paraphrasing source verbs
- Serving lone tier-3 allegations about named persons without corroboration
- Using "verified/confirmed/true" in served output
- Presenting content externally without the full G1–G8 gate
- Deleting or updating editorial log entries

### Related Decisions

- **ADR-002:** AGE version pin — graph layer must support the provenance
  chain (deterministic projection, NFR-A-2)
- **ADR-005:** LLM model tier — cloud model for Q&A/render path must meet
  the p95 ≤10s latency gate without sacrificing citation fidelity
- **ADR-007:** Render gate as live call site — the mechanical
  enforcement point for properties 1–6
- **ADR-008:** NLI entailment gate — semantic verification layer for
  citation-or-silence

## Open questions

- **Numeric defamation threshold (AR-26):** Exact max acceptable
  hallucination rate per language per citation class. Deferred to a
  superseding ADR but the floor is 0 allegation-as-fact (NFR-EI-2).
- **Retention/takedown (NFR-L-4):** How long are raw snapshots retained?
  Affects right-to-be-forgotten boundary. Deferred to legal review (G7).
- **Hash-chain concurrency (AR-27):** Multi-writer serialization model
  (single-writer consumer-group vs CRDT merge). Deferred to Epic 2.

## Alternatives

1. **Leave "defamation-grade" undefined, enforce case-by-case.** Rejected —
   the whole point of the platform is mechanical enforcement. An undefined
   standard cannot be mechanically enforced.

2. **Adopt an external standard (e.g., journalism ethics codes).** Partially
   adopted — the trust-tier system and fact/claim distinction draw from
   journalism best practices. But no existing standard covers the specific
   combination of KG provenance, hash-chained audit, and PH cyberlibel
   exposure. This definition is purpose-built.

3. **Defer to legal counsel to define.** Rejected as sole source — legal
   counsel defines the *liability* boundary (G7); engineering defines the
   *enforcement* mechanism. This ADR is the enforcement definition; G7 is
   the liability clearance.
