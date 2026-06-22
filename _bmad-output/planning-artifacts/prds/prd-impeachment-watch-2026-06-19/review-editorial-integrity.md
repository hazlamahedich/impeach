# Editorial Integrity Review — IIP Internal-First PRD

## Verdict
The PRD has a genuinely strong editorial-integrity architecture — citation-or-silence, the Pre-External Gate, the honest evidence split, and the cyberlibel acknowledgment are better than most products in this space attempt. However, two critical definitional gaps undercut the headline 100% claims: "served assertion" is never operationally defined (so 100% citation coverage is enforceable only at the answer level, not the assertion level), and "independent sources" is undefined (so the fact-vs-claim boundary is gameable via wire-story propagation). Several binding requirements use undefined terms ("corroboration signal"), structurally unfalsifiable metrics (merge-error rate), or eval-fixture-dependent denominators (refutes recall) that make the stated thresholds softer than they appear. The resolutions from the prior editorial-integrity review (D-014/D-015/D-017) hold up well and are not re-raised.

## Findings

### critical — "Served assertion" boundary is undefined — 100% citation coverage is answer-level, not assertion-level (§6.1 EI-1, §9.1 NFR-EI-1, §10 SM-1)

**Gap.** EI-1 states "any factual assertion returned to a user must carry at least one document-backed citation, or it is not returned." NFR-EI-1 and SM-1 set citation coverage at 100%. NFR-EI-7 says the fact/claim boundary is "applied to 100% of served assertions (hard gate before serving, not sampling)." But the PRD never defines what counts as a "served assertion." An LLM-generated answer is multi-clause prose: *"The Vice President faces allegations of corruption dating to her time as Davao City mayor, as reported by GMA News, with the House committee citing fund discrepancies in its third hearing."* Which clauses are "served assertions" requiring citations — all of them? Only the factual claims? The framing/connective tissue ("as reported by," "dating to")? If the LLM generates synthesizing or transitional language that carries information without a discrete citation, that is an uncited assertion leaking through the 100% gate. The enforcement mechanism (citation-or-silence at the answer level, substring validation on quotes) operates per-answer and per-quote, not per-assertion. The 100% is only as real as the boundary is precise, and the boundary is not precise.

**Why it matters.** This is the product's headline integrity claim — the differentiator ("an allegation stated as fact is a P0 defect"). If "served assertion" is fuzzy, the 100% is aspirational, not mechanically enforced, and uncited assertions can leak through framing prose in LLM-generated answers. In a defamation-grade context, an uncited synthesizing clause about a named public figure is the exact failure mode the product exists to prevent.

**Fix.** Define "served assertion" operationally in §6.1 or the glossary: every declarative clause making a factual or attributed claim must carry ≥1 citation linking to a source passage; connective/framing prose that carries no new factual content is permitted but scoped and must not itself assert; the LLM serving prompt and the serving-layer gate must enforce per-clause citation (not per-answer); the CI gate should test for uncited declarative clauses in generated answers, not just uncited answers. Specify whether the gate is a prompt instruction (soft) or a post-generation parser that checks every claim-bearing clause for an attached citation (hard). If the latter doesn't exist yet, the 100% claim should be downgraded to a target with a defined enforcement mechanism.

---

### critical — "Independent sources" is undefined — wire-story propagation makes the ≥2-source fact threshold gameable (§6.1 EI-2)

**Gap.** EI-2's boundary rule: an assertion is a **fact** only when established by a tier-1 primary/official source, **or by ≥2 independent sources**. "Independent" is not defined anywhere in the PRD, glossary, or addendum. In Philippine media, wire stories (Reuters, AP, PNA) propagate across multiple outlets — GMA, ABS-CBN, and Philstar may all carry the same Reuters wire report verbatim or near-verbatim. Without a provenance-de-duplication rule, two outlets carrying the same wire story count as "≥2 independent sources," and an allegation that is single-origin (one wire report) gets elevated to **established fact**. This is defamation-grade: a wire-sourced allegation about a named public figure, republished by multiple outlets, tagged as fact because the threshold counts outlets, not origins.

**Why it matters.** The fact-vs-claim boundary is the P0 enforcement line. If "independent" is undefined, the boundary is trivially gameable by the most common Philippine media propagation pattern (wire → multiple outlets). An allegation-as-fact incident from this path is exactly what EI-2 exists to prevent, and it would be invisible to the substring gate (the quotes are real, just not independent).

**Fix.** Define independence operationally in §6.1 or the glossary: two sources are independent only if they have distinct original reporting (not republishing the same wire/agency feed). The source registry (FR-1.1) should track upstream feed provenance (wire_service, original_publisher) per source. The fact classifier must de-duplicate by original reporting origin, not by outlet count — if 3 outlets all sourced from the same Reuters wire report, that counts as 1 source, not 3. Add an explicit test case to the eval fixture: a wire-sourced allegation carried by ≥2 tier-2 outlets must be tagged as attributed claim (single-origin), not fact.

---

### high — Substring validation catches fabricated quotes, not fabricated or mischaracterized claims (§6.1 EI-6, §8 FR-3.2)

**Gap.** The anti-hallucination gate (EI-6, FR-3.2) mechanically substring-validates every cited quote against its source chunk at extraction and serving. This catches fabricated quotes. It does **not** catch: (a) a real quote mischaracterized by the surrounding LLM-generated claim (quoting a denial verbatim but framing it as an admission); (b) a fabricated paraphrased claim with no verbatim quote to validate (the LLM generates a claim, attaches a citation to a real source passage, but the source passage doesn't actually support the claim — the quote check passes because no quote is checked, only citations with quotes); (c) misattribution (a real quote attributed to the wrong speaker/entity). The PRD acknowledges EI-3's scope limits (verb preservation at the per-assertion level, not higher-order editorial acts — RK-12) but does not explicitly name the gap between "quote is real" and "claim is accurate." The substring gate is a quote-integrity gate, not a claim-accuracy gate.

**Why it matters.** A hallucination about a named public figure is defamation-grade, and the PRD names this as the differentiator. But the anti-hallucination backstop only covers one failure mode (fabricated quotes). Semantic misrepresentation, unquoted fabrication, and misattribution are uncovered. An LLM that generates a wrong claim with a real citation (the citation resolves, the claim doesn't match it) passes the gate.

**Fix.** Acknowledge in §6.1 that substring validation is a quote-integrity gate, not a claim-accuracy gate — name the uncovered modes (mischaracterization, unquoted fabrication, misattribution). Add a misattribution check: the quoted speaker must match the entity the claim is attributed to. Require that non-quoted claims (paraphrased assertions) also carry provenance to a source passage, not just quoted claims — and add a claim-to-passage consistency check to the eval harness (does the cited passage actually support the claim?). Consider a groundedness eval that tests claim-passage support, not just quote presence (the NFR-O-2 groundedness ≥0.95 may partially cover this — make the relationship explicit).

---

### high — "Corroboration signal" is undefined in a binding requirement (§6.1 EI-8, §8 FR-5.6, §9.1 NFR-EI-8)

**Gap.** EI-8: "a lone tier-3 (aggregator) allegation about a named person may not be served as if evidentially equivalent to a tier-1 fact; the trust tier is visible on the citation and a lone low-tier defamatory allegation requires a corroboration signal or is served with an explicit single-source/low-tier marker." "Corroboration signal" is not defined. What counts? A second tier-3 source? A tier-2 source mentioning the same allegation? A tier-1 source referencing the subject matter? Does the corroboration need to agree with the allegation, or merely reference the same subject? Without a definition, the floor is unenforceable — the operator decides ad hoc what "corroboration" means, and the binding requirement (NFR-EI-8) cannot be tested.

**Why it matters.** This is the citation-quality floor for named persons — the exact control that prevents a lone defamatory allegation from being served as if established. If "corroboration" is undefined, the floor is a guideline, not a gate.

**Fix.** Define corroboration signal operationally: e.g., ≥1 additional independent source (per the independence definition in the critical finding above) at tier-2 or above that references the same allegation or its subject matter; specify whether corroboration must affirm the allegation (agree) or merely reference it (mention); add a test case to the eval fixture — a lone tier-3 defamatory allegation with no corroboration must be served with the single-source/low-tier marker, never as established.

---

### high — Refutes-edge recall denominator is eval-fixture-dependent and potentially unrepresentative (§9.1 NFR-EI-5, §10 SM-4b)

**Gap.** NFR-EI-5: "extracted refuting/contextualizing evidence is recalled on ≥70% of claims where such evidence exists in the corpus (measured on an eval fixture)." The denominator — "claims where such evidence exists" — is only knowable for the curated eval fixture, not the live corpus. If the fixture is small, biased toward obvious refutations, or doesn't include subtle/indirect refuting evidence (a refutation buried in a different document, in a different source tier, or phrased indirectly), the 70% overstates real-world performance. The PRD marks this `[ASSUMPTION]` and operator-confirmed (D-018), which is honest about the threshold being provisional — but the fixture's representativeness is the hidden risk, and the PRD doesn't specify minimum fixture size, source-type diversity, or adversarial case composition.

**Why it matters.** This is the misleading-by-omission guard (EI-7, D-015). If the recall is overstated because the fixture is easy, the platform silently omits refuting evidence in real queries — the exact failure D-015 was created to prevent. A 70% on an easy fixture is worse than honest silence.

**Fix.** Specify minimum fixture requirements alongside the threshold: ≥N claims with human-annotated refuting evidence, across ≥M source types and tiers, including adversarial cases where refuting evidence is subtle, indirect, cross-tier, or in a different document than the claim. Report fixture composition (size, source diversity, difficulty distribution) alongside the metric so a reviewer can judge whether 70% is meaningful. Add a stretch target (e.g., ≥80% on the adversarial subset) to prevent the fixture from drifting toward easy cases.

---

### medium — Merge-error rate is structurally unfalsifiable as stated (§9.1 NFR-EI-3, §10 SM-3)

**Gap.** NFR-EI-3: "Merge-error rate (incorrect entity merges): target ≈0, prioritized over duplicate rate." The merge policy is conservative by definition (EI-5: "when uncertain whether two entities are the same real-world entity, do not merge"). Conservative merging produces few merge errors by construction — you don't make the merges you're unsure about, so you don't make the wrong ones. The ≈0 target is nearly tautological. The metric is only meaningful for detected errors (a user or operator discovers a wrong merge downstream), but you can't measure the false merges you avoided because you don't have ground truth. The real risk — the one the tradeoff creates — is the duplicate rate: over-conservative merging fragments the knowledge graph, and duplicates can cause their own integrity issues (the same entity appears as two, relationship counts are split, a claim attributed to one node isn't connected to the other). SM-3 says duplicate rate is "accepted as the tradeoff" but doesn't bound it.

**Why it matters.** An unbounded duplicate rate means the graph can fragment silently — the platform becomes less useful and potentially misleading (a user sees one node's relationships and misses the duplicate's). The "≈0 merge errors" metric sounds reassuring but doesn't measure what matters.

**Fix.** Reframe: measure merge-error rate as detected-incorrect-merges per N merge decisions on a held-out entity-resolution eval set with ground truth (not tautological — you need a labeled set). Bound the duplicate rate (e.g., duplicate rate < X% on the eval set) rather than accepting it unboundedly. Report both merge precision (of decisions to merge, how many were correct) and merge recall (of true duplicates, how many were caught) — the conservative bias trades recall for precision, and both should be visible.

---

### medium — Retraction hook provides partial protection; interim behavior for retracted sources is underspecified (§8 FR-5.7, §9.4 NFR-L-5, OQ-10)

**Gap.** FR-5.7 records supersession and flags affected answers; the built-in response is "a served assertion whose only source has been retracted is not served as established." This is meaningful partial protection — the assertion is downgraded from "fact" to not-established. But the PRD doesn't specify what happens next: is the retracted source's assertion still served as an attributed claim? Is a retracted source still citable at all? Under Philippine cyberlibel (Disini, NFR-L-3), republication of a defamatory allegation — even with a retraction marker — can still carry liability. A retracted allegation still surfaced (even downgraded, even marked) may be a republication. The full takedown/retention workflow is TBD (OQ-10, to be defined by legal review) — that's appropriately deferred, but the interim default behavior is underspecified.

**Why it matters.** A retraction is the highest-risk scenario for a defamation-grade tool: the source itself has disowned the claim, and the platform's continued surfacing of it (even with a marker) is a knowing republication. The hook detects the problem; the response should be conservative by default.

**Fix.** Specify the interim default behavior until the legal-review-defined workflow is in place: a retracted source's assertions should be suppressed from serving (not merely downgraded), or served only with an explicit retraction marker and not citable as active evidence; the conservative default is suppression, not downgrade. Note that the full workflow (retention period, takedown notification, user-facing retraction display) is defined by legal review (OQ-10) but the interim default should err toward not surfacing retracted defamatory content.

---

### medium — "Where feasible" weakens external independence for the adversarial set and spot-checks (§10 SM-4a, SM-7, §12 RK-14)

**Gap.** SM-7 says the adversarial demo set is "authored/reviewed at least in part external to the build team." NFR-O-2 says "the adversarial demo question set includes items authored/reviewed external to the build team where feasible." RK-14's mitigation says "external-authored portion of adversarial set." For a defamation-grade product, "where feasible" / "at least in part" are soft qualifiers. If external authorship is infeasible (no external reviewer secured), the adversarial set is self-authored — the exact self-grading bias RK-14 names. The PRD doesn't define a fallback gate if external review can't be obtained.

**Why it matters.** Self-graded metrics on a defamation-grade tool are the core risk RK-14 identifies. "Where feasible" lets the team proceed without external review if it's inconvenient, not just if it's impossible.

**Fix.** Make external authorship a requirement for the adversarial set (not "where feasible"), with a defined fallback gate: if external authors can't be secured before the first presentation, either delay the presentation until external review is obtained, or scope the presentation to a curated non-defamatory demo subset only. "At least in part" should specify a minimum (e.g., ≥30% of the adversarial set authored externally). The independent spot-check (SM-4a) should name the reviewer category (not just "independent" — independent of what? The build team? The product? The model?).

---

### low — Filipino-language gate is structurally sound but model-quality risk is understated; no fallback defined (§13.2 OQ-9)

**Gap.** OQ-9 gates `fil` coverage behind an eval fixture that must pass the same integrity gates — this is the right structure (D-028). But the PRD doesn't acknowledge the model-quality risk explicitly: local models (Qwen2.5-14B-Instruct, Llama-3.1-8B-Instruct per the addendum) are not Filipino-specialized. Filipino political/legal text uses specialized vocabulary (*kasong libelo*, *pinagbintangan*, *sinumbong*, formal *Filipino* legal register) that general-purpose models may extract poorly. The gate is rigorous in form, but if the fixture is small or tests only straightforward Filipino, it may pass without proving real-world extraction quality. More importantly, the PRD doesn't define a fallback if `fil` fails the gate: is the product English-only? For a Philippine political corpus where Senate transcripts and key local outlets are in Filipino, English-only is a material coverage gap, not a footnote.

**Why it matters.** If `fil` extraction quality is poor, the platform either (a) silently under-extracts Filipino sources (missing claims/evidence — a coverage gap that undermines the corpus's usefulness), or (b) extracts with high error rate (integrity violations). The gate prevents (b) but not (a) — and (a) is an integrity issue too (misleading-by-omission at the corpus level).

**Fix.** Acknowledge the model-quality risk explicitly in OQ-9 (local models are not Filipino-specialized; quality on political/legal Filipino is genuinely uncertain). Define a fallback: if `fil` fails the gate, the product is English-only with a stated coverage gap — Filipino sources are ingested and searchable but not extracted for claims/relationships until a Filipino-capable model is available; the coverage gap is disclosed in the demo (DR-4 honest framing), not hidden. Note that English-only on a Philippine political corpus is a material limitation, and consider whether a Filipino-capable model (or a cloud tier for `fil`-only extraction) should be a v1.x priority.

---

## What's strong

- **Citation-or-silence as an architectural invariant (EI-1), not a policy.** "There is no uncited-answer code path" is a real commitment — it's enforced by the absence of a code path, not by a prompt instruction. This is the right enforcement model and is genuinely stronger than most products achieve.

- **The Pre-External Presentation Gate (D-014, FR-5.5, §6.2) is a well-structured governance control.** It cleanly separates engineering-enforced integrity (day-to-day) from human sign-off at the exposure boundary, with named roles (editorial owner + legal review) and a recorded gate. The recognition that "showing the product to an external audience is itself a soft launch of a defamation-grade tool" is the right risk calibration.

- **The honest evidence split (EI-7, D-015, FR-3.4) with an explicit one-sided empty-state is a sophisticated anti-omission design.** Most products silently show an empty refutes tab. This product explicitly renders "Only supporting evidence detected in v1; refuting evidence was not surfaced" — closing the misleading-by-omission failure with a UI invariant, not just a disclaimer. This is better than the prior review's resolution required.

- **The cyberlibel/republication acknowledgment (NFR-L-3, D-017) is legally literate.** Recognizing that citation alone is not a complete defense under *Disini v. Secretary of Justice* (RA 10175 §4(c)(4)) — that surfacing a defamatory allegation, even verbatim and cited, can carry republication liability — is a level of legal awareness that most products in this space lack. Making the legal review a hard gate (not an open question) is the right posture.

- **The over-silence counter-metric (NFR-EI-6, CM-1) shows awareness of a subtle integrity trap.** A 100% citation rate is trivially achievable by refusing to answer everything. The PRD explicitly names over-silence as a failure mode and sets a recall/answer-rate floor — "I don't know must be correct, not convenient." This is the right counter-metric design.

- **"Allegation-as-fact = P0 defect, equal in severity to a crash" (§2, §6.1 EI-2) elevates severity appropriately.** This framing makes integrity violations engineering-priority peers of crashes, not soft quality issues.

- **CI gates with non-relaxable hard gates (NFR-O-2) use the right language.** "Weakening a hard gate to pass a build is rejected; disabling the substring check to raise recall is forbidden" — this prevents the most common integrity erosion pattern (relaxing gates to ship). The distinction between hard gates (non-relaxable) and soft gates (tracked/trended) is well-calibrated.

- **Fact/claim boundary applied to 100% of served assertions as a hard gate, not sampling (NFR-EI-7).** The PRD explicitly distinguishes sampling (which covers extraction quality) from the hard gate (which covers the served boundary). This is the right enforcement model — the boundary is gated, not audited.

- **The prior editorial-integrity review's criticals (D-014/D-015/D-017) were resolved with substance, not hand-waving.** The governance-vs-presentation tension, the libel hand-waving, and the misleading-by-omission gap all received architecturally meaningful resolutions (a mandatory gate with named roles, a hard legal gate, and an active-extraction + honest-split design). These are not re-raised — the resolutions hold up.

---

## Severity counts

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 3 |
| Medium | 3 |
| Low | 1 |
| **Total** | **9** |