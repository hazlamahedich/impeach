# Validation Report — IIP Internal-First PRD

- **PRD:** `_bmad-output/planning-artifacts/prds/prd-impeachment-watch-2026-06-19/prd.md`
- **Rubric:** `.claude/skills/bmad-prd/assets/prd-validation-checklist.md`
- **Run at:** 2026-06-21
- **Grade:** Fair

## Overall verdict

The PRD is structurally strong — all seven rubric dimensions land at *strong* or *adequate*, with no *thin* or *broken* dimensions. The thesis (citation-or-silence) is genuinely load-bearing, the Finalize cycle (D-014…D-028) resolved the hard governance/legal/omission problems, and the document is decision-ready and downstream-usable. The risk is not structural; it is definitional. Two binding requirements use terms that are never operationally defined — "served assertion" (EI-1) and "independent sources" (EI-2) — which makes the headline 100% citation-coverage and fact-vs-claim claims enforcement-soft rather than mechanically enforced. The adversarial and editorial-integrity reviewers independently surfaced the same pattern: the integrity invariants are strong on *coverage* (everything has a tag, a citation, a substring check) and weak on *correctness* (is the tag right? is the citation the right one? is the gate manned?). Additionally, the Pre-External Presentation Gate — the load-bearing governance control for external presentation — is mandatory in form but has no assigned counsel (OQ-4), making it a phantom gate today. None of this is fatal; all of it is fixable without restructuring the PRD. But the PRD currently presents these as resolved when they are open.

## Dimension verdicts

- Decision-readiness — strong
- Substance over theater — strong
- Strategic coherence — strong
- Done-ness clarity — adequate
- Scope honesty — adequate
- Downstream usability — strong
- Shape fit — strong

## Findings by severity

### Critical (6)

**Editorial Integrity** — "Served assertion" boundary undefined (§6.1 EI-1)
EI-1's 100% citation coverage is enforceable at the answer level, not the assertion level. An LLM-generated answer's framing/connective prose can carry uncited declarative clauses about named public figures — the exact defamation-grade leak the product exists to prevent. "Served assertion" is never operationally defined.
Fix: Define "served assertion" as every declarative clause making a factual/attributed claim; enforce per-clause citation via a post-generation parser, not just per-answer; add a CI test for uncited declarative clauses.

**Editorial Integrity** — "Independent sources" undefined (§6.1 EI-2)
The fact-vs-claim boundary rule (fact = tier-1 OR ≥2 independent sources) never defines "independent." Philippine wire-syndicated stories (Reuters → GMA/ABS-CBN/Philstar) are the most common propagation pattern. Without a de-duplication rule, a single-origin wire allegation republished by multiple outlets gets tagged as established fact.
Fix: Define independence operationally (distinct original reporting, not republishing the same wire/agency feed); track upstream feed provenance per source; de-duplicate by origin, not outlet count. Add an eval case: wire-sourced allegation carried by ≥2 tier-2 outlets → tagged attributed claim, not fact.

**Adversarial** — Refutes-edge recall is circular/self-graded (§9.1 NFR-EI-5, SM-4b)
The ≥70% recall floor is measured on an eval fixture whose denominator ("claims where refuting evidence exists") is authored by the team. A self-authored ground truth cannot detect evidence the team didn't think to look for. The metric measures "did we find what we already knew was there."
Fix: The refutes-edge eval fixture must be authored or double-annotated by someone independent who reads the source corpus to determine ground truth — not the extractor's builder.

**Adversarial** — Allegation-as-fact gate measures coverage, not correctness (§9.1 NFR-EI-7, SM-2, SM-7)
NFR-EI-7's hard gate ensures every served assertion *has a* fact/claim tag, not that the tag is *correct*. The P0 "allegation-as-fact = 0" is measured on curated eval/demo sets, not on live non-curated queries. The defamation risk lives in tag-correctness, not tag-coverage. The PRD conflates the two.
Fix: Separate tag-coverage (100%, mechanical) from tag-correctness (sampled audit on non-curated live queries, with a floor and owner). Stop presenting the coverage gate as if it guarantees correctness.

**Adversarial** — Mandatory legal gate is a phantom (§13.1 OQ-4, FR-5.5, NFR-L-3, D-014)
The Pre-External Presentation Gate is "mandatory" but the specific counsel is an "open assignment." A mandatory gate with no assigned reviewer cannot fire. Today, the gate is an intention, not a control. The decision-log framing ("gate mandatory, assignment open") hides that the v1 thesis's load-bearing risk is unowned.
Fix: Make retained cyberlibel counsel a pre-build gate (the gate's existence shapes what gets surfaced), or name a fallback (defer presentation until counsel is retained). Treat "assignment open" as a P0 scheduling risk.

**Adversarial** — Fact/claim tag correctness depends on extraction; the gate only checks coverage (§9.1 NFR-EI-7, FR-2.5, EI-2)
The fact/claim boundary rule is presented as deterministic but is a classifier output gated by a presence check. Correct classification depends on the extractor correctly judging source trust tier, source independence, and established-vs-alleged — each a non-trivial NLP judgment. The hard gate verifies a tag exists, not that it's right. This is the single most dangerous conflation in the document.
Fix: Rename NFR-EI-7 to "fact/claim tag coverage 100%." Add a separate, sampled correctness metric with a floor and owner, audited on non-curated queries.

### High (8)

**Editorial Integrity** — Substring gate covers quotes, not claims (§6.1 EI-6, FR-3.2)
Substring validation catches fabricated quotes. It does not catch: mischaracterization (real quote, wrong framing), unquoted fabrication (paraphrased claim with a real citation that doesn't support it), or misattribution (real quote, wrong speaker). The gate is a quote-integrity check, not a claim-accuracy check.
Fix: Acknowledge EI-6's scope; name uncovered modes; add a misattribution check and a claim-to-passage consistency check to the eval harness.

**Editorial Integrity** — "Corroboration signal" undefined in binding requirement (§6.1 EI-8, FR-5.6, NFR-EI-8)
EI-8 requires a "corroboration signal" for lone low-tier allegations about named persons. "Corroboration signal" is never defined. The citation-quality floor is a guideline, not a gate.
Fix: Define corroboration operationally (≥1 additional independent source at tier-2+ referencing the same allegation); add an eval case for a lone tier-3 defamatory allegation with no corroboration.

**Editorial Integrity** — Refutes-recall denominator is eval-fixture-dependent (§9.1 NFR-EI-5, SM-4b)
The 70% floor is only as meaningful as the fixture is representative. No minimum fixture size, source-type diversity, or adversarial-case composition is specified. A small/easy fixture overstates real-world performance.
Fix: Specify minimum fixture requirements (≥N claims, ≥M source types, adversarial subset); report fixture composition alongside the metric; add a stretch target on the adversarial subset.

**Adversarial** — "≥2 independent sources" is undefined and is a hard research problem (§6.1 EI-2)
(Overlaps with editorial-integrity critical — same gap, adversarial lens.) Independence determination requires source-derivation analysis the extractor is not specified to perform. In Philippine media, tier-2 is frequently downstream of tier-1 records or wire copy.
Fix: Define "independent" operationally; require the extractor to record the independence basis, not just a count; default to "attributed" when independence can't be established.

**Adversarial** — No rule for tier-1-vs-tier-1 source conflict (§6.1 EI-2, §6.3)
Impeachment material routinely contains tier-1-vs-tier-1 conflict (House vs Senate framing). Under the current rule, each side independently satisfies "fact = tier-1," so two contradictory facts can both be served as established.
Fix: Add an explicit rule: when ≥2 tier-1 sources conflict on the same assertion, neither is served as "fact" — both are attributed claims with the conflict visible.

**Adversarial** — Local-model quality thresholds asserted without evidence (§9.7 NFR-D-1/D-2, §9.8 NFR-O-2, addendum §Tech decisions)
Hard gates (groundedness ≥0.95) and accuracy targets (>85%, >90%) are set, but no evidence shows Qwen2.5-14B or Llama-3.1-8B can hit them on Philippine political/legal English. If only the cloud tier clears the hard gate, "cloud never required" (NFR-D-2) is fiction. The tension is not named as a risk.
Fix: Run a pre-build feasibility check on a pilot corpus slice; if local models can't hit the gates, either lower the gates or acknowledge the cloud tier is required for some tasks.

**Adversarial** — DPA compliance review deferred but external presentation authorized (§9.4 NFR-L-2, FR-5.5)
NFR-L-2 defers the DPA review to "before any launch beyond the internal period," but FR-5.5 authorizes external presentation to journalists within v1. The boundary between "internal period" and "launch" is undefined; the DPA review may land after the Pre-External Gate — too late for a tool surfacing named-public-figure material to external parties.
Fix: Fold a DPA posture review into the Pre-External Gate, or explicitly classify external presentation as "internal" for DPA purposes and say why.

**Rubric** — Senator dashboard boundary undefined (FR-4.2)
"Early/lightweight" is not bounded. D-016 resolved that an early view exists but not which fields (statements? votes? participation? personal timeline?) are v1 vs Phase 2. Story creation will stall on day one.
Fix: List the specific v1 read-model fields in FR-4.2, or cross-reference the TDD's senator read-model spec by section.

### Medium (14)

**Rubric** — DPA review trigger blurriness (§9.4 NFR-L-2) — "before any launch beyond the internal period" is undefined when v1 straddles internal operation and external presentation. *Fix:* State whether DPA review is part of the Pre-External Gate or a separate gate with a named trigger.

**Rubric** — Intent detection done-ness undefined (FR-3.3) — 5 intent types named, no accuracy threshold, no coverage requirement, no fallback. *Fix:* State done-ness: all 5 detectable on eval fixture with ≥X% accuracy; unrecognized intent falls back to factual lookup with a logged signal.

**Rubric** — Graph rendering "performant" unbounded (FR-3.5) — NFR-P-3 gives hop/count caps but no render-latency bound. *Fix:* Add a render bound (e.g., first paint < 2s for ≤N nodes).

**Rubric** — Retraction flag behavior undefined (FR-5.7) — "flags affected served answers" — UI badge, operator alert, serving suppression, or all three? *Fix:* Specify the flag's user-visible rendering and operator notification path.

**Rubric** — No `[NOTE FOR PM]` callouts at deferred-decision tensions (throughout) — DPA trigger and retention/takedown defamation adjacency deserve louder flags than §13.2's quiet listing. *Fix:* Add `[NOTE FOR PM]` at NFR-L-2 and OQ-5/OQ-10.

**Adversarial** — SM-8's "presentation landed" signal rigged toward easy disjunct (§10.3 SM-8) — "concrete follow-up request" from one audience member is a low bar OR'd with the harder ≥50% spot-verification. *Fix:* Make conjunctive for first presentation, or name the easy disjunct as a minimum-viable-interest signal.

**Adversarial** — "Independent reviewers" independence is aspirational, not structural (§9.8 NFR-O-2, SM-7, D-024) — "where feasible" and "at least in part" are hedges; nothing structurally prevents reviewers from being adjacent to the build team. *Fix:* Define "independent"; make at least one reviewer structurally external; drop "where feasible."

**Adversarial** — Retraction hook is a stub presented as a v1 feature (FR-5.7, NFR-L-5, DR-6, OQ-10) — The platform flags, but what it does with a flagged answer is undefined. The legal review that defines behavior hasn't been commissioned. *Fix:* Define v1 retraction behavior fully before demoing it, or remove DR-6.

**Adversarial** — Determinism gate tests reproducibility, not correctness (§9.8 NFR-O-2, FR-2.4) — Projection-determinism verifies same inputs → same graph, not that the graph is correct. Reproducibly incorrect passes the gate. *Fix:* Label as rebuildability/reproducibility gate; pair with a correctness metric on the graph.

**Adversarial** — Corpus targets are "indicative" with no floor (§10.3 SM-6) — No floor below which the demo is cancelled; "operator confirms actuals" means the targets are vibes with numbers. *Fix:* Set a hard floor distinct from the indicative target.

**Adversarial** — Filipino coverage defaulting to English-only is a credibility risk (addendum §Demo targets, OQ-9) — English-only silence looks like integrity but is a coverage gap to the target audience. *Fix:* Name the risk in RK; state in DR-4 that v1 is English-only and Filipino is deferred.

**Adversarial** — SM-4a "answer accuracy >90%" has no methodology (§10.1 SM-4a) — Sample size, sampling frame, correctness rubric, and reviewer independence unspecified. N=5 spot-checks is an anecdote. *Fix:* Specify sample size, frame, rubric, and reviewer independence.

**Editorial Integrity** — Merge-error rate structurally unfalsifiable (§9.1 NFR-EI-3, SM-3) — Conservative merging produces few merge errors by construction; ≈0 is nearly tautological. Duplicate rate is unbounded. *Fix:* Measure merge precision/recall on a held-out labeled set; bound the duplicate rate.

**Editorial Integrity** — Retraction interim behavior underspecified (FR-5.7, NFR-L-5, OQ-10) — A retracted source's assertions may still be served as attributed claims; under cyberlibel, continued surfacing may be republication. *Fix:* Default to suppression of retracted defamatory content until the legal-review-defined workflow is in place.

### Low (9)

**Rubric** — OQ-5 retention classified non-blocking despite defamation adjacency (§13.2) — Retention of retracted raw snapshots is legal-existential. *Fix:* Note both OQ-5 and OQ-10 as blocking for the Pre-External Gate.

**Rubric** — P-5 Engaged Citizen persona is light furniture (§4.2, addendum P-5) — Drives no FR, NFR, SM, or UJ. *Fix:* Drop from v1 scope or name one decision it drives.

**Rubric** — SM-4 / SM-4a thresholds inherited unearned (§10.1) — ">85%" and ">90%" are "per north-star PRD" with no v1 eval methodology. *Fix:* Reference the v1 eval fixture methodology or mark as inherited targets to validate before gating.

**Rubric** — UJ coverage gap for P-3/P-4 (§7) — Only 2 UJs; UX downstream for researcher and legal/civil-society has no journey. *Fix:* Add a lightweight UJ for P-3/P-4, or note UX should derive them.

**Rubric** — "Graceful degradation" unbounded (NFR-R-1) — Behavior for a single-node read-only API is unspecified. *Fix:* State the behavior: query path live; ingestion pauses and resumes; operator notified.

**Adversarial** — Single-workstation demo has no degraded/offline fallback (NFR-D-1, DR-1…DR-6) — If Ollama hangs or OOMs on stage, the pitch collapses. *Fix:* Add a cached/pre-rendered fallback; name "demo dies live" as a risk.

**Adversarial** — Model/version drift not named as a determinism risk (NFR-A-2) — A model weight update breaks reproducibility even with the same `extractor_version` string. *Fix:* Name model-weight pinning as part of the determinism guarantee.

**Editorial Integrity** — Filipino-language model-quality risk understated (OQ-9) — Local models are not Filipino-specialized; political/legal Filipino is specialized register. Gate is rigorous in form but may pass without proving real-world quality. *Fix:* Acknowledge model-quality risk; define fallback (English-only with stated coverage gap disclosed in demo).

**Editorial Integrity** — "Where feasible" weakens external independence (SM-4a, SM-7, RK-14) — Soft qualifiers let the team proceed without external review if inconvenient. *Fix:* Make external authorship a requirement with a defined fallback gate; specify minimum external portion (e.g., ≥30%).

## Mechanical notes

- **Assumptions Index roundtrip:** Clean for the PRD body (8 inline `[ASSUMPTION]` tags indexed in §13.5). One gap: addendum §Demo targets carries inline `[ASSUMPTION]` tags (addendum lines 79, 92) not indexed in §13.5 — boundary ambiguous since SM-6 cross-references into addendum.
- **ID continuity:** No gaps or duplicates. OQ-3's absence is explained (§13.3: resolved → D-015). All FR, NFR, SM, RK, OQ IDs present and cross-referenced correctly.
- **Glossary drift:** Cosmetic only. "Fact vs. attributed claim" (§6.1 EI-2) vs. "Attributed claim vs. fact" (§14 Glossary) — ordering differs, meaning identical. "Deterministic graph projection" aligns after D-020 correction.
- **UJ protagonist naming:** §7.1 names by role (Intake Operator) — acceptable for internal-tool operator UJ. §7.2 names "Maya Reyes" by person with inline context. Both carry context inline; no floating UJs.
- **Required sections present:** All expected sections present for an internal-first, chain-top PRD at these stakes. No missing required section.

## Reviewer files

- `review-rubric.md` — quality rubric (7 dimensions): 0 critical, 1 high, 4 medium, 6 low
- `review-adversarial-general.md` — cynical review: 4 critical, 5 high, 7 medium, 2 low
- `review-editorial-integrity.md` — editorial/defamation review: 2 critical, 3 high, 3 medium, 1 low