# PRD Quality Review — IIP Internal-First PRD

## Overall verdict
The PRD holds up as a decision-ready, strategically coherent document with a genuinely load-bearing thesis — citation-or-silence is the product, and every feature section ties back to it. The Finalize cycle (D-014…D-028) resolved the hard problems: governance vs. external presentation, cyberlibel republication liability, and misleading-by-omission. What's at risk is downstream story creation: several FRs carry soft done-ness edges (senator dashboard boundary, intent detection, retraction flag behavior) that will force clarification loops during implementation, and the DPA compliance-review trigger is blurred across the "internal period" / "launch" boundary that the PRD itself straddles.

## Decision-readiness — strong

Decisions are stated as decisions, not buried as considerations. Trade-offs name what was given up: conservative merge accepts "a duplicate node is a cosmetic defect; an incorrect merge corrupts every downstream answer" (§6.1 EI-5); local-first is "a binding v1 constraint, not a preference" (§9.7 NFR-D-1); governance is "engineering-enforced day-to-day + a mandatory Pre-External Presentation Gate" rather than either pole alone (§6.2, D-014). Open Questions carry owners and triggers — OQ-1 is a `[PRE-BUILD GATE]` with owner: tech lead and trigger: "before building the vector index" (§13.1); OQ-4 is a `[PRE-EXTERNAL ASSIGNMENT]` whose gate is mandatory even while the assignment is open (§13.1). These are not rhetorical questions with answers hidden in the next sentence.

The §13.3 "Resolved during Finalize" block is honest about what was decided and why (OQ-3 → D-015; governance → D-014; senator phasing → D-016). A reader pushing back on "why is there no human editorial owner full-time?" finds the answer acknowledged: "not a full-time role for all of v1… the accountable human at the gate before exposure" (§6.2).

The one tension that reads as smoothed: the Philippine Data Privacy Act posture (NFR-L-2) says "a formal compliance review is an open item before any launch beyond the internal period," but v1 explicitly includes external presentation (SM-8, §11). The boundary between "internal period" and "launch" is never defined, and a reader could reasonably conclude the DPA review lands *after* the Pre-External Gate — which would be too late for a tool surfacing named-public-figure material to external journalists. This is a real decision that has been made to look like a non-blocker.

### Findings
- **medium** DPA review trigger blurriness (§9.4 NFR-L-2) — "formal compliance review is an open item before any launch beyond the internal period" sits uneasily with SM-8's external presentation occurring *during* v1. The trigger ("before any launch beyond the internal period") is undefined when v1 itself straddles internal operation and external presentation. *Fix:* State explicitly whether the DPA compliance review is part of the Pre-External Gate (FR-5.5) or a separate gate, and name its trigger condition (e.g., "before the first external presentation, alongside the cyberlibel review").
- **low** OQ-5 (retention policy) classified non-blocking but ties to NFR-L-4 ("right-to-be-forgotten boundary") — a defamation-adjacent concern for a tool retaining raw snapshots of retracted material. *Fix:* Note that OQ-5 must be resolved before the Pre-External Gate if retained snapshots contain retracted/superseded defamatory material; cross-reference OQ-10.

## Substance over theater — strong

The differentiator is not theater — "citation-or-silence" appears as EI-1, FR-3.1, NFR-EI-1, SM-1, CM-1, RK-1, RK-2, and DR-2. It drives feature priority (integrity core in v1; narrative/contradiction deferred to §5.2), NFR thresholds (100% citation coverage, 0 allegation-as-fact), and demo design (DR-2 adversarial script). The single non-negotiable — "an allegation stated as a fact is a P0 defect, equal in severity to a crash" (§2) — is concrete and load-bearing, not a vision-statement flourish.

NFRs carry product-specific thresholds, not boilerplate: p95 < 10s (NFR-P-1), ≥500 documents / ≥3 tier-1 / ≥3 tier-2 (SM-6), refutes-edge recall ≥70% (NFR-EI-5), groundedness ≥0.95 with hard/soft CI gates (NFR-O-2). The vision ("Political Intelligence Operating System… most comprehensive, explainable, and evidence-backed… in the Philippines," §2) is category-specific enough that it could not swap into an unrelated PRD without change.

Personas are deliberately moved to addendum §Personas and used inline in UJs (§7), which is the right call — they're not furniture occupying PRD real estate. The one soft persona is P-5 Engaged Citizen (§4.2, addendum P-5): acknowledged as secondary, "lower tolerance for nuance, but the integrity bar does not drop," yet it drives no decision in the PRD. It reads as completeness rather than load-bearing.

### Findings
- **low** P-5 Engaged Citizen persona is light furniture (§4.2, addendum §Personas P-5) — acknowledged as secondary but drives no FR, NFR, SM, or UJ. *Fix:* Either drop P-5 from v1 scope (citizens are not the presentation audience per D-004's priority order) or name one decision it drives (e.g., a plain-language answer mode toggle).

## Strategic coherence — strong

The thesis is stated, repeated, and prioritized: "the integrity core comes first and the flashier capabilities (narrative generation, contradiction engine) are deliberately deferred until that core is proven" (§2). Feature scope in §5.1 follows from the thesis — ingestion, extraction, Q&A with citations, graph/timeline/evidence views, editorial invariants — while §5.2 defers narrative, media comparison, contradiction engine, influence analytics, streaming, and SaaS. This is not a backlog with section headings; the prioritization logic is visible.

Success metrics validate the thesis rather than measuring activity: SM-1 (citation 100%), SM-2 (allegation-as-fact 0), SM-3 (merge-error ≈0), SM-4b (refutes recall ≥70%), SM-7 (adversarial demo 100%). Counter-metrics are named where SMs exist — CM-1 against SM-1 ("over-silence is a failure mode, not success"), CM-2 against SM-5 ("latency is never bought by dropping the citation gate"). The MVP scope kind is coherent: problem-solving + experience (prove integrity on real data + be presentable), and the scope logic matches.

The one soft spot: SM-4 ("Extraction accuracy >85%") and SM-4a ("Query answer accuracy >90%") are marked "per north-star PRD" — inherited targets, not earned here. No eval methodology is referenced for v1 beyond NFR-O-2's CI gates, and the thresholds read as round-number inheritance rather than something the v1 eval fixture is designed to measure. This doesn't break coherence (the metrics still serve the thesis), but a downstream engineer won't know what "extraction accuracy" operationally means without chasing the north-star PRD.

### Findings
- **low** SM-4 / SM-4a thresholds inherited unearned (§10.1) — ">85%" and ">90%" are "per north-star PRD" with no v1 eval methodology referenced. *Fix:* Either reference the v1 eval fixture methodology (NFR-O-2) that will measure these, or mark them as inherited targets to be validated against the v1 harness before they gate anything.

## Done-ness clarity — adequate

Many FRs are crisp and testable: "deduplicate by content checksum" (FR-1.3), "substring-validated at extraction time… drops are counted" (FR-2.1, EI-6), "p95 < 10s" (NFR-P-1), "100% of served assertions" (EI-2, NFR-EI-7), "drop + replay reproduces an isomorphic graph" (FR-2.4). An engineer can write a story for these without coming back.

But several FRs have soft edges that will force clarification during story creation — the dimension downstream leans on hardest:

- **FR-4.2** "early/lightweight senator/entity view" is not bounded. D-016 resolved *that* an early view exists but not *what's in it*. "Statements, votes, participation, and a personal timeline" is listed, but which of these are v1 vs. Phase 2? An engineer cannot write a story for "early/lightweight" without a field list.
- **FR-3.3** "Detect question intent (factual lookup, entity listing, evidence-for-claim, timeline, comparison)" names 5 intent types but specifies no accuracy threshold, no coverage requirement across all 5, and no fallback behavior for unrecognized intent.
- **FR-3.5** "capped, performant rendering for large subgraphs" — "performant" is an adjective. NFR-P-3 gives hop/count caps but no render-latency bound.
- **FR-5.7** "flags affected served answers" — flag as a UI badge? An operator alert? Suppress serving? The user-visible behavior is unspecified.
- **NFR-R-1** "graceful degradation if a worker is down" — what does degradation look like for a single-node read-only API?

The editorial-integrity FRs (FG5, EI-1…EI-8) are the exception — they are the most done-ness-clear section in the PRD, with hard gates and 100% / 0% thresholds. The integrity core will source-extract cleanly; the temporal/entity and query-intent FRs will not.

### Findings
- **high** Senator dashboard boundary undefined (FR-4.2) — "early/lightweight" is not bounded; D-016 resolved that an early view exists but did not define which fields (statements? votes? participation? personal timeline?) are in v1 vs. Phase 2. *Fix:* List the specific v1 read-model fields in FR-4.2, or cross-reference the TDD's senator read-model spec by section. Without this, story creation for FR-4.2 will stall on the first day.
- **medium** Intent detection done-ness undefined (FR-3.3) — 5 intent types named, no accuracy threshold, no coverage requirement, no fallback. *Fix:* State the done-ness: e.g., "all 5 intent types detectable on the eval fixture with ≥X% accuracy; unrecognized intent falls back to factual lookup with a logged signal."
- **medium** Graph rendering "performant" unbounded (FR-3.5) — NFR-P-3 gives hop/count caps but no render-latency bound. *Fix:* Add a render bound (e.g., "first paint < 2s for ≤N nodes") or cross-reference a UX performance NFR.
- **medium** Retraction flag behavior undefined (FR-5.7) — "flags affected served answers" — UI badge, operator alert, serving suppression, or all three? *Fix:* Specify the flag's user-visible rendering and the operator notification path; cross-reference DR-6's live scenario.
- **low** "Graceful degradation" unbounded (NFR-R-1) — "single-node best-effort with graceful degradation if a worker is down" for a read-only API. *Fix:* State the behavior: e.g., "query path remains live; ingestion pauses and resumes on worker recovery; operator notified via dashboard."

## Scope honesty — adequate

Omissions are explicit where it matters. §5.2 is a detailed Non-Goals list (narrative, media comparison, contradiction engine, AI debate, influence analytics, streaming, SaaS, opinion authoring, prediction). §6.3 "What v1 does *not* claim" is excellent — it names the misleading-by-omission trap, the no-verification-claims boundary, and the absence-of-contradiction limitation. `[ASSUMPTION]` tags are present inline and indexed in §13.5 with a clean roundtrip (see Mechanical notes). `[NON-GOAL for MVP]` callouts are not used as a tag, but §5.2's explicit "Out of scope for v1 (deferred)" with phase annotations serves the same function.

The gap: there are no `[NOTE FOR PM]` callouts anywhere in the PRD body. The rubric names these as signals at "deferred decisions and unresolved tensions." The DPA/retention tension (NFR-L-2, OQ-5, OQ-10) is exactly the kind of defamation-adjacent deferral that benefits from a `[NOTE FOR PM]` flag — not because it's unresolved, but because classifying it as "non-blocking" is a judgment call that a future reader should be able to trace. Open-items density (3 gates + 6 non-blocking OQs + 8 assumptions) is reasonable for a pre-build internal-first PRD and is not a blocker. But two of the non-blocking OQs (OQ-5 retention, OQ-10 takedown workflow) tie to legal/defamation concerns and are gated only implicitly by the Pre-External Gate — their non-blocking status deserves a louder flag than §13.2's quiet listing.

### Findings
- **medium** No `[NOTE FOR PM]` callouts at deferred-decision tensions (throughout) — the DPA trigger ambiguity (NFR-L-2) and the retention/takedown defamation adjacency (OQ-5, OQ-10) are exactly where the rubric expects a `[NOTE FOR PM]`. Their absence makes these deferrals read more routine than they are. *Fix:* Add `[NOTE FOR PM]` at NFR-L-2 (DPA trigger boundary) and at OQ-5/OQ-10 (retention/takedown must resolve before Pre-External Gate if material is defamatory).
- **low** OQ-5 and OQ-10 classified non-blocking (§13.2) despite defamation adjacency — retention of retracted raw snapshots and takedown workflow are legal-existential for a cyberlibel-aware tool. *Fix:* Note explicitly that both are blocking for the Pre-External Gate, even if not blocking for the build.

## Downstream usability — strong

The Glossary (§14) defines every domain noun: citation-or-silence, attributed claim vs. fact, conservative merge, provenance, substring validation, trust tier, deterministic graph projection, refutes-edge recall, citation-quality floor, Pre-External Presentation Gate, cyberlibel/republication. Usage is consistent across FRs, UJs, and SM definitions — "conservative merge" means the same thing in EI-5, FR-2.3, RK-3, and the glossary; "deterministic graph projection" is consistent after the D-020 correction (FR-2.4 now says "canonical relational data," matching the glossary). Drift is cosmetic (see Mechanical notes).

ID continuity is clean: FR-1.1 through FR-5.7 (contiguous), NFR-EI-1…8, NFR-P-1…3, NFR-S-1…5, NFR-L-1…5, NFR-A-1…3, NFR-R-1…3, NFR-D-1…3, NFR-O-1…2, SM-1…8 with SM-4a/4b, RK-1…14, OQ-1/OQ-2/OQ-4…10 (OQ-3 gap explained in §13.3). Cross-references resolve: "see §6.3," "see D-015," "see FR-5.5," "see `reconcile-tdd.md` G1," "see `addendum.md §Personas`" all land. Each section reads sensibly pulled out alone — the glossary and cross-references carry context.

UJs have named protagonists: §7.1's Intake Operator (by role, appropriate for an internal-tool operator) and §7.2's Maya Reyes (by name, with a concrete scenario). Both are load-bearing — the operator journey covers ingestion integrity, the Maya journey covers the demo story. For a chain-top PRD feeding UX, the gap is that P-3 (Researcher) and P-4 (Legal/Civil-Society) have no UJ — UX downstream will need to derive journeys from addendum persona notes rather than source-extracting them. Given that these are future-user personas for a v1 that is internally operated, one representative future-user UJ (Maya) is defensible, but UX should be told explicitly that more UJs are its job, not the PRD's.

### Findings
- **low** UJ coverage gap for P-3/P-4 (§7) — only 2 UJs (operator + journalist). UX downstream for researcher and legal/civil-society personas has no journey to source-extract. *Fix:* Add a lightweight UJ for P-3 or P-4 in addendum §Personas, or add a note in §7 that UX should derive additional UJs from persona notes for the presentation-audience segments.

## Shape fit — strong

The PRD matches its shape precisely. Stakes calibration (D-003) = "internal tool, presented to future users," with integrity/defamation at launch-grade rigor and feature scope at MVP discipline. The PRD delivers exactly that: §6 (editorial integrity) is the most rigorous section — 8 binding invariants, a governance gate, a cyberlibel posture, explicit non-claims — while §5 (scope) and §8 (FRs) carry MVP discipline (phase annotations, deferred items in §5.2).

UJ density is appropriate, not overhead. The rubric notes "Internal tool, single-operator role → capability spec shape; UJs may be overhead" — but this PRD straddles internal operation and external presentation, so 2 UJs (one operator, one demo-protagonist) are load-bearing rather than formalized theater. SMs are correctly mixed: operational (SM-1…SM-5) + presentation-readiness (SM-6…SM-8), matching the dual goal. The chain-top shape is honored: technology choices are deferred to addendum + TDD (D-010), the PRD body states capabilities and constraints, and FR/NFR/SM IDs are stable and source-extractable for story creation. Not over-formalized, not under-formalized.

### Findings
*(none — this dimension is clean.)*

## Mechanical notes

- **Assumptions Index roundtrip:** Clean for the PRD body. §13.5 lists 8 inline `[ASSUMPTION]` tags (§4.2, §5.3, §9.4 NFR-L-2, §9.4 NFR-L-5, §9.7 NFR-D-1, §9.1 NFR-EI-5, §10.3 SM-6, §10.3 SM-8) plus the removed §6.2 entry — all verified present inline at the cited locations. One minor gap: addendum §Demo targets carries inline `[ASSUMPTION]` tags (addendum lines 79, 92) that are not indexed in §13.5. If the addendum counts as part of the PRD for indexing purposes, these should be added; if not, the SM-6 cross-reference into addendum makes the boundary ambiguous.
- **ID continuity:** No gaps or duplicates. OQ-3's absence is explained (§13.3: resolved → D-015). FR-5.5/5.6/5.7, NFR-EI-5…8, SM-4a/4b, RK-11…14, OQ-10 all present and cross-referenced correctly.
- **Glossary drift:** Cosmetic only. "Fact vs. attributed claim" (§6.1 EI-2) vs. "Attributed claim vs. fact" (§14 Glossary) — ordering differs, meaning identical. "Citation-or-silence" is hyphenated consistently throughout. "Deterministic graph projection" aligns after D-020 (FR-2.4 and glossary both say "canonical relational data").
- **UJ protagonist naming:** §7.1 names the protagonist by role ("Intake Operator (build team)") rather than by person — acceptable for an internal-tool operator UJ where the role is the persona. §7.2 names "Maya Reyes" by person, with inline context ("investigative reporter at a Philippine broadsheet"). Both carry their context inline; no floating UJs.
- **Required sections present:** For an internal-first, chain-top PRD at these stakes, all expected sections are present (scope, users, integrity, FRs, NFRs, SMs, demo readiness, risks, OQs, glossary, appendancies). No missing required section.