# Adversarial Review — IIP Internal-First PRD

**Reviewer:** cynical/general · **Date:** 2026-06-21 · **Target:** `prd.md` (+ `addendum.md`, `.decision-log.md`)

**Scope note:** Issues already resolved in D-001…D-028 are not re-raised unless the resolution itself is weak. This review focuses on what the PRD still smooths over, claims is handled but isn't, or leaves quietly soft. Findings are adversarial by design; some overlap is intentional where a weakness has more than one face.

---

## C1 — Refutes-edge recall is a circular, self-graded metric

**Location:** §9.1 NFR-EI-5; §10.1 SM-4b; FR-2.2; D-018

**Note:** NFR-EI-5 sets a "≥70% recall floor" for refuting/contextualizing evidence, "measured on an eval fixture." But the denominator — "claims where such evidence exists in the corpus" — is itself determined by the fixture author. If the team builds the fixture, the team decides which claims *have* refuting evidence, which means the team is grading its own extractor against its own answer key. The PRD presents this as the guard against misleading-by-omission (the failure D-015 closed), but a self-authored ground truth cannot detect evidence the team didn't think to look for. D-024 names "self-graded quality" as a risk and adds rotating reviewers + external-authored adversarial questions — but those address *answer* and *allegation-as-fact*, not the refutes-edge denominator. There is no independent annotation of *what refuting evidence exists in the corpus*. The metric is rigorous in form and hollow in substance.

**Fix:** The refutes-edge eval fixture must be authored (or at minimum double-annotated) by someone who is not the extractor's builder and who independently reads the source corpus to determine ground truth — otherwise the floor measures "did we find what we already knew was there," not "did we find what we missed."

---

## C2 — "Allegation-as-fact = 0" is measured on a curated set, not on the live system

**Location:** §6.1 EI-2; §9.1 NFR-EI-2; §10.1 SM-2; SM-7

**Note:** The PRD's flagship invariant — "an allegation stated as a fact is a P0 defect, equal in severity to a crash" —is measured as "0 incidents in eval/demo" (SM-2) and "100% on the curated adversarial set" (SM-7). Both are measured against sets the team curates. A question the team didn't think to ask, on a claim the extractor mis-tagged, will never appear in the eval. The P0 severity is only meaningful if the tag is applied correctly, and EI-2's boundary rule (fact = tier-1 source OR ≥2 independent sources) is enforced by extraction, not by a mechanical gate. NFR-EI-7 says the fact/claim boundary is a "hard gate before serving, not sampling" — but the gate ensures *every assertion has a tag*, not that *the tag is correct*. Coverage ≠ correctness. The PRD conflates the two, and the defamation-grade severity is attached to the weaker of the two properties.

**Fix:** Separate two metrics: (a) tag-coverage = 100% (mechanical, enforceable) and (b) tag-correctness on served assertions = target with a sampled audit on *non-curated* live queries, not just the adversarial demo set. A P0 that only fires on questions you already know the answer to is not a P0.

---

## C3 — The fact/claim tag's correctness depends on extraction; the gate only checks coverage

**Location:** §9.1 NFR-EI-7; FR-2.5; EI-2

**Note:** NFR-EI-7 is listed as a hard CI gate ("fact/claim boundary on served assertions 100%"). But the gate can only verify that *a* tag exists, not that *the right* tag exists. The right tag depends on the extractor correctly classifying (i) the source's trust tier, (ii) whether ≥2 sources are "independent," and (iii) whether the assertion is established vs. alleged. Each of those is a non-trivial NLP/research judgment. The PRD presents EI-2's boundary rule as if it were a deterministic function, when it is a classifier output gated by a presence check. The hard gate is a coverage gate wearing a correctness label. This is the single most dangerous conflation in the document, because the defamation risk lives in tag-correctness, not tag-coverage.

**Fix:** Rename NFR-EI-7 to "fact/claim tag coverage 100%" (what it actually enforces). Add a separate, sampled correctness metric with a floor and an owner, audited on non-curated queries. Stop presenting the coverage gate as if it guarantees correctness.

---

## C4 — Legal counsel for the Pre-External Gate is mandatory but unassigned; the gate is currently a phantom

**Location:** §13.1 OQ-4; §6.2; FR-5.5; NFR-L-3; D-014

**Note:** D-014 resolved that the Pre-External Gate is "mandatory" and resolved the governance-vs-presentation tension. But OQ-4 admits the specific counsel is an "open assignment." A mandatory gate with no assigned reviewer is not a gate — it is an intention. The PRD treats "the gate is mandatory; the assignment is open" as resolved, but the operational reality is that no one has been retained to perform the cyberlibel-aware review that the entire external-presentation thesis depends on. If counsel is not retained in time, the gate either blocks the pitch indefinitely (delaying funding/partnership) or absorbs pressure to accept a weaker review. The decision-log framing — "gate mandatory, assignment open" — hides the fact that, today, the gate cannot fire. This is not a loose end; it is the load-bearing risk for the v1 thesis, and it is unowned.

**Fix:** Either (a) make retained cyberlibel counsel a **pre-build** gate (not "pre-external assignment"), because the gate's existence shapes extract/surface design (what gets surfaced is what counsel must review), or (b) name a fallback (defer presentation until counsel is retained) explicitly so the schedule doesn't quietly erode the gate. Treat "assignment open" as a P0 scheduling risk, not a non-blocker.

---

## H1 — "≥2 independent sources" is undefined and is itself a hard research problem

**Location:** §6.1 EI-2 (boundary rule)

**Note:** EI-2 defines a "fact" as established by a tier-1 source OR by ≥2 independent sources. "Independent" is not defined. Two outlets both citing the same Senate press release are not independent. Two outlets reporting from the same hearing record are not independent of each other (the record is the source). Wire-syndicated stories (Reuters → PNA republish) are the same source twice. Determining independence requires source-derivation analysis the extractor is not specified to perform, and the PRD gives no rule. In Philippine impeachment material specifically, much of tier-2 media is downstream of tier-1 records or wire copy — so "≥2 sources" will frequently count the same underlying source twice unless independence is defined. The boundary rule looks clean and is not.

**Fix:** Define "independent" operationally (e.g., "not syndicated, not both citing a common tier-1 release, not owned by the same parent group for this claim") and require the extractor to record the independence basis, not just a count. If independence can't be established mechanically, the claim defaults to "attributed," not "fact."

---

## H2 — No rule for tier-1-vs-tier-1 source conflict

**Location:** §6.1 EI-2; §6.3

**Note:** EI-2 says fact = tier-1 source OR ≥2 independent sources. But impeachment material routinely contains tier-1-vs-tier-1 conflict: a House record and a Senate record frame the same event differently; an official transcript and an official gazette entry disagree on a vote or a statement's presence. The contradiction engine is deferred (correctly), but the fact-tagging rule has no branch for "two tier-1 sources disagree about the same assertion." Under the current rule, each side independently satisfies "fact = tier-1," so two contradictory facts can both be served as established. The PRD's §6.3 says the platform "does not default to consistent or true," but that's about the *absence* of contradiction detection, not about *serving conflicting facts as both established*. This is a real, imminent edge case in the seed case (House vs Senate framing of the Duterte impeachment is the core contested material), and the rule doesn't cover it.

**Fix:** Add an explicit rule: when ≥2 tier-1 sources conflict on the same assertion, neither is served as "fact" — both are served as attributed claims with the conflict visible. Or: a single tier-1 source establishes "fact" *only absent a conflicting tier-1 source*. Name the edge case; don't let the extractor silently pick one.

---

## H3 — Local-model quality thresholds are asserted without evidence; NFR-D-2 may be fiction

**Location:** §9.7 NFR-D-1/D-2; §10.1 SM-4/SM-4a; §9.8 NFR-O-2 (groundedness ≥0.95, recall ≥0.75); addendum §Tech decisions (Qwen2.5-14B / Llama-3.1-8B)

**Note:** The PRD sets hard and soft gates (groundedness ≥0.95 hard; recall ≥0.75 soft; extraction >85%; answer accuracy >90%) and binds the stack to local models by default (NFR-D-2), with cloud "optional, pluggable, never required." But there is no cited evidence that Qwen2.5-14B-Instruct or Llama-3.1-8B can hit groundedness ≥0.95 or answer accuracy >90% on Philippine political/legal English (let alone Filipino). RK-5 names "local model quality ceiling" as a risk and offers "pluggable cloud tier per task" as the mitigation — but if the only way to clear the hard groundedness gate is the cloud tier, then "cloud never required" is a polite fiction and NFR-D-2 is a constraint that quietly bends. The PRD sets the thresholds first and defers the question of whether the chosen models can meet them. The hard gate and the local-default constraint are in tension, and the PRD does not name the tension as a risk.

**Fix:** Add an explicit pre-build feasibility check: run the chosen local models on a pilot slice of the corpus and report whether the hard gates are reachable. If they are not, either lower the gates (and say so) or acknowledge that the cloud tier is *required for some tasks* — which changes NFR-D-2 from "constraint" to "aspiration." Don't leave the tension silent.

---

## H4 — The substring gate is over-presented as the "anti-hallucination backstop"

**Location:** §6.1 EI-6; FR-3.2; NFR-O-2 (quote-validity 100% hard gate)

**Note:** EI-6 is called the "Anti-hallucination backstop" and the quote-validity 100% gate is a hard CI gate. But substring validation catches exactly one class of hallucination: a quote that does not literally appear in its source chunk. It does *not* catch: (a) a real quote attributed to the wrong speaker; (b) a real quote lifted from the wrong document; (c) a real quote stripped of qualifying context ("alleged X" → "X"); (d) a real quote from a source that is itself defamatory and now surfaced as if established. The PRD presents EI-6 as a backstop; in fact it is a narrow integrity check. Misattribution and context-stripping are defamation-grade failure modes that the substring gate is structurally blind to, and the PRD does not name them. A reader would reasonably conclude that "100% quote-validity" means "no hallucinated content reaches the user," which is false.

**Fix:** Rename or scope EI-6 to "quote-existence validation" and name explicitly what it does *not* catch (misattribution, wrong-document lift, context-stripping). Add the uncaught failure modes to the risk table (RK) with whatever mitigation v1 actually has — or admit there is none.

---

## H5 — DPA compliance review is deferred but external presentation is authorized

**Location:** §9.4 NFR-L-2 [ASSUMPTION]; §6.2; FR-5.5; §13.2 OQ-5

**Note:** NFR-L-2 says a formal Data Privacy Act compliance review is "an open item before any launch beyond the internal period." But FR-5.5 authorizes external presentation to journalists/researchers/lawyers *within* v1, gated only by editorial + cyberlibel review (D-014). The PRD does not classify a closed-door presentation to external journalists as "launch" or "internal." This is a gray zone, and the PRD walks into it: the DPA review is deferred to "beyond the internal period," but the external presentation *is* beyond the internal period in any meaningful sense (the audience is no longer the build team). The cyberlibel review (NFR-L-3) covers defamation; it does not cover data-privacy posture for *presenting* aggregated personal data to third parties. The PRD has a compliance gap dressed as a sequencing choice.

**Fix:** Either (a) fold a DPA posture review into the Pre-External Gate (alongside cyberlibel), or (b) explicitly classify the external presentation as "internal" for DPA purposes and say why that classification holds. Don't leave the gap implicit.

---

## M1 — SM-8's "presentation landed" signal is rigged toward the easy disjunct

**Location:** §10.3 SM-8; D-027

**Note:** SM-8 says success = ≥1 external audience segment feedback AND (≥50% spot-verification OR a concrete follow-up request). D-027 framed this as a falsifiable signal. It is falsifiable in principle, but the disjunction is lopsided: "a concrete follow-up request" (pilot access, partnership conversation, funding next-step) from a single audience member is a very low bar — a journalist saying "send me more info" counts. The harder bar (≥50% spot-verification) is OR'd with the easy one, so SM-8 will pass on the easy path almost regardless of how the demo actually lands. A cynic would say the easy disjunct exists to ensure the metric passes. The thresholds are also marked `[ASSUMPTION]` "refine after first presentation," which means the first presentation is graded against placeholder thresholds — i.e., the bar is set after the jump.

**Fix:** Drop the easy disjunct, or make it conjunctive with the harder one for the first presentation (you want both interest *and* verification). If the easy disjunct stays, name what it is: a minimum-viable-interest signal, not a "landed" signal.

---

## M2 — "Independent reviewers" independence is aspirational, not structural

**Location:** §9.8 NFR-O-2; §10.3 SM-7; D-024

**Note:** D-024/NFR-O-2 say human spot-checks use "rotating independent reviewers" and the adversarial demo set is "authored/reviewed at least in part external to the build team where feasible." "Where feasible" is a hedge; "in part" is a hedge; "rotating" does not mean "external." The independence is aspirational — nothing structurally prevents the reviewers from being adjacent to the build team (same org, same funding, same Slack). The PRD treats this as the counter to self-graded quality (RK-14), but the counter is itself soft. "Rotating" addresses bias drift, not capture.

**Fix:** Define what "independent" means (different reporting line? different org? paid reviewer?) and make at least one reviewer structurally external (contracted, not volunteered). Drop "where feasible" — either independence is required or the metric is self-graded; don't claim both.

---

## M3 — The retraction hook (FR-5.7) is a stub presented as a v1 feature

**Location:** §8 FR-5.7; §9.4 NFR-L-5 [ASSUMPTION]; §11 DR-6; OQ-10

**Note:** FR-5.7 says "when a cited source is corrected or retracted, the platform records the supersession and flags affected served answers; a served assertion whose only source has been retracted is not served as established." DR-6 says the demo shows this live. But NFR-L-5 says "exact retention/takedown workflow is defined by the legal review — open item (OQ-10)." So the platform flags, but what it *does* with a flagged answer is undefined: suppress? mark? still serve with a warning? The "not served as established" clause covers the single-source case, but a multi-source assertion with one retracted source has no defined behavior. FR-5.7 is a hook with no behavior, presented as a feature, demoed as a scenario. The legal review that defines the behavior hasn't been commissioned (OQ-4 unassigned — see C4). The demo will show *something*, but that something is not yet designed.

**Fix:** Define the v1 retraction behavior fully (suppress / mark / downgrade tier / re-evaluate fact-vs-claim) *before* demoing it, or remove DR-6 from v1 demo readiness. Don't demo a stub.

---

## M4 — Determinism gate tests reproducibility, not correctness

**Location:** §9.8 NFR-O-2 (projection-determinism exact); FR-2.4; §14 Glossary

**Note:** The projection-determinism hard gate verifies that drop+replay reproduces an isomorphic graph. This is a reproducibility guarantee: the same inputs → the same graph. It says nothing about whether the graph is *correct*. If entity resolution is deterministic-but-wrong (same wrong merges every time, same missing edges every time), the gate passes and the graph is reproducibly incorrect. The PRD lists this as a hard gate alongside quote-validity and fact/claim coverage, implying it is an integrity guarantee; it is a *rebuildability* guarantee. A reader could conclude "deterministic = trustworthy," which is false.

**Fix:** Keep the determinism gate (it's valuable), but label it as a rebuildability/reproducibility gate, not an integrity gate. Pair it with a correctness metric on the graph (edge precision/recall on a sampled subgraph), or say plainly that determinism does not imply correctness.

---

## M5 — Corpus targets are "indicative" with no floor below which the demo is cancelled

**Location:** §10.3 SM-6; addendum §Demo targets

**Note:** SM-6 sets indicative targets (≥500 docs, ≥1,500 entities, ≥3,000 relationships) all marked `[ASSUMPTION]`, "operator confirms actuals once ingestion is live." There is no floor below which the demo does not proceed. If ingestion yields 480 docs and 1,400 entities, the demo still happens because the targets were "indicative." SM-6's actual success criterion is "a demonstrably useful corpus" — subjective. The numeric targets exist "so demo-ready is falsifiable, not vibes," but with no floor and operator-confirmed actuals, they are vibes with numbers next to them.

**Fix:** Set a hard floor (e.g., "demo does not proceed below N docs / M entities") distinct from the indicative target. If the floor isn't met, the demo is delayed, not re-baselined.

---

## M6 — Filipino coverage defaulting to English-only is a credibility risk with the target audience

**Location:** addendum §Demo targets (Languages); §13.2 OQ-9; D-028

**Note:** D-028 correctly elevated `fil` to a gated coverage claim (an `fil` eval fixture must pass integrity gates before claiming `fil` coverage). But the default is English-only, and the target audience is *Philippine* investigative journalists, researchers, and legal/civil-society analysts — many of whom work in Filipino, and for whom an English-only platform covering a Philippine impeachment will read as partial or outsider-built. The PRD treats `fil` as a nice-to-have gated by an eval fixture, not as a credibility risk for the pitch. A journalist who asks a Filipino-language question and gets "no sourced answer" *because the corpus isn't extracted in Filipino* will not experience that silence as integrity — they will experience it as incompleteness. The citation-or-silence invariant is honest only when the corpus actually covers the language of the question. English-only silence looks like integrity but is a coverage gap.

**Fix:** Name the risk explicitly in RK: en-only coverage may be read as incompleteness, not integrity, by the target audience. Either (a) include a `fil` extraction pass as a v1 stretch goal with the gate, or (b) state plainly in DR-4 (honest framing) that v1 is English-only and Filipino coverage is deferred — so the audience knows the silence is a scope limit, not a knowledge limit.

---

## M7 — SM-4a "answer accuracy >90%" is "independently spot-checked" with no methodology

**Location:** §10.1 SM-4a; §10.3 SM-7

**Note:** SM-4a says "Query answer accuracy >90%, judged independently of citation coverage, independently spot-checked, not self-graded." This is the right instinct, but the methodology is entirely unspecified: how many answers are spot-checked? What is the sampling frame (curated demo set? live queries? random?)? What is the correctness criterion (matches a gold answer? a reviewer's judgment? resolves to source?)? "Independently spot-checked" could mean 5 answers reviewed by a colleague, which gives a confidence interval so wide the >90% claim is meaningless. The metric looks rigorous; the method is vapor.

**Fix:** Specify sample size, sampling frame, correctness rubric, and reviewer independence for SM-4a. A >90% claim with N=5 spot-checks is not a metric; it's an anecdote.

---

## L1 — Single-workstation demo has no degraded/offline fallback

**Location:** §9.7 NFR-D-1; §11 DR-1…DR-6

**Note:** NFR-D-1 binds v1 to a single workstation, no proprietary cloud. Demos (DR-1…DR-6) are live, in front of external audiences. If Ollama hangs, the model OOMs, or the venue's power/network is unreliable, the entire pitch collapses with no fallback (no cached answer set, no degraded read-only mode, no pre-rendered demo reel). The PRD treats demo reliability as a corpus-quality question (DR-1) and a script question (DR-2), not an operational-availability question. A live demo that dies on stage is worse than no demo.

**Fix:** Add a demo-availability requirement: a cached/pre-rendered fallback path (or a degraded mode) so a model-load failure doesn't kill the pitch. Name "demo dies live" as a risk in RK.

---

## L2 — Model/version drift not named as a determinism risk

**Location:** §9.5 NFR-A-2; addendum §Tech decisions (extractor_version)

**Note:** NFR-A-2 says re-extraction and graph rebuild are "deterministic and versioned." The extractor version is stamped into provenance. But if the underlying Ollama model is updated (a new Qwen2.5 point release), prior extractions may not reproduce even with the same `extractor_version` string, because the model weights changed. The PRD claims determinism without naming that the *model* is part of the determinism contract, not just the extractor code. The TDD may handle this, but the PRD asserts the property and doesn't flag the dependency.

**Fix:** Name model-weight pinning as part of the determinism guarantee, or acknowledge that a model update may break reproducibility and require a re-extraction version bump.

---

## Summary

**Counts:** 4 critical · 5 high · 7 medium · 2 low — **18 findings**

The PRD is unusually disciplined for a v1 document, and the decision log shows real triage. But the pattern is clear: the integrity invariants are strong on *coverage* (everything has a tag, everything has a citation, everything has a substring check) and weak on *correctness* (is the tag right? is the citation the right one? is the quote attributed correctly?). The metrics that look hardest (refutes-edge recall, fact/claim 100%, projection-determinism) are either self-graded, circular, or tests of a weaker property than they claim to test. The legal gate is mandatory in form and phantom in practice. And the local-default constraint is in silent tension with the quality thresholds. None of this is fatal; all of it is soft, and the PRD presents it as resolved.