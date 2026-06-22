---
title: "Impeachment Intelligence Platform (IIP) — Internal-First Product Requirements Document"
product: Impeachment Intelligence Platform (IIP)
project: impeachment-watch
scope: internal-first (pre-launch)
status: final
created: 2026-06-19
updated: 2026-06-21
seed_case: Sara Duterte impeachment (Philippines)
north_star_prd: Enterprise_PRD_Impeachment_Intelligence_Platform.md
technical_design: IIP_Technical_Design_Document.docx (Draft v1.0, 2026-06-16)
language: English
---

# Impeachment Intelligence Platform (IIP) — Internal-First PRD

## 1. Document purpose & relationship to other docs

This is a **tactical, internal-first PRD**. It does not replace the *Enterprise PRD* (`Enterprise_PRD_Impeachment_Intelligence_Platform.md`), which remains the product's long-form north star. It scopes that vision down to the version a small team builds and operates first, and that gets **presented to future users** to earn partners, funding, or a pilot.

Relationship of the three documents:

| Document | Role | Authority |
|---|---|---|
| Enterprise PRD (north star) | Full vision, 3-phase roadmap | **Product intent** wins |
| Technical Design Document v1.0 | Build plan: architecture, data model, APIs, phased backlog | **Technical decisions** win |
| **This PRD (internal-first)** | Scope, users, requirements, editorial guardrails, demo readiness, success criteria for the v1 build | Defines *what v1 must be* to be worth presenting |

Where this PRD and the Enterprise PRD disagree on **product intent**, the Enterprise PRD wins. Where they disagree on **technical implementation**, the TDD wins. This document governs **scope, requirements quality, and readiness bar** for the internal-first build.

Technology choices (concrete stack) live in `addendum.md` and the TDD, **not in this body**. The PRD states *capabilities and constraints*; the addendum states *which tools satisfy them*.

---

## 2. Executive summary

The **Impeachment Intelligence Platform (IIP)** turns scattered Philippine impeachment material — hearing transcripts, court records, official filings, press releases, and media coverage — into one **explainable, evidence-backed knowledge graph** queryable in natural language, where every factual assertion carries a citation or is not returned at all.

The **internal-first build** delivers the platform's integrity core: continuous ingestion of public sources, entity/relationship/claim extraction with conservative merging, a deterministic rebuildable knowledge graph, natural-language Q&A with a citation-or-silence invariant, and timeline/evidence/entity views. It runs **entirely on a single workstation using local models and fully open-source software — no proprietary cloud dependency required**.

The seed case is the **Sara Duterte impeachment**. The build's success is measured not by adoption at scale but by **proving the citation-or-silence invariant holds on real Philippine data** and by being **credible enough to present to journalists, researchers, and legal/civil-society analysts** as a trustworthy investigative tool.

**North-star vision (from the Enterprise PRD).** IIP is the foundation of a **Political Intelligence Operating System** — intended to become *the most comprehensive, explainable, and evidence-backed political intelligence platform in the Philippines*, eventually ingesting any major Philippine political controversy into a searchable, explainable intelligence graph. The internal-first build is the first credible step toward that vision, not the whole of it.

**Why this matters (the differentiator).** The wedge is *not* "another political tracker." General-purpose chatbots hallucinate — and in this domain, a hallucination about a named public figure is a defamation. IIP's enforced honesty (citation-or-silence, conservative merge, provenance on everything) is the product. That is why the integrity core comes first and the flashier capabilities (narrative generation, contradiction engine) are deliberately deferred until that core is proven.

The single non-negotiable: **an allegation stated as a fact is a P0 defect, equal in severity to a crash.**

---

## 3. Problem & opportunity

### 3.1 Problem
Philippine political intelligence around an impeachment is fragmented across PDFs, transcripts, press releases, and dozens of outlets. Tracing *who alleged what, what evidence supports or refutes it, how outlets frame it differently, and how it evolves over time* is manual, slow, and error-prone. The harder failure mode is silent: a reader (or a tool) **mistakes an unproven allegation for an established fact**, and that error propagates.

### 3.2 Opportunity
Consolidate the corpus into a single graph where **every claim is traceable to a verbatim source**, entities and relationships are navigable, and questions are answered *with citations or with honest silence*. The differentiator is not "another political tracker" — it is **explainability and evidence discipline** applied to contested, real-world allegations about named public figures.

### 3.3 Why internal-first
Before earning external users, the platform must prove a property that is easy to claim and hard to deliver: **it never confidently invents or inflates.** The internal-first build exists to demonstrate that property on a real, high-stakes case under the team's direct operation — and to produce something demoable that earns the next phase.

---

## 4. Target users

There are two layers, because v1 is *operated internally* and *presented externally*.

### 4.1 v1 operator (who runs it now)
- **Intake Operator (build team).** Registers and monitors sources, triages extraction quality, watches ingestion health, and is the first line of defense on editorial integrity during the internal period. This is the *primary* v1 user; the product is built to be operable by a small team.

### 4.2 Future users (who the presentation targets) — the design-to audience
`[ASSUMPTION]` Primary presentation audience, in priority order:

1. **Investigative journalists / reporters** — need fast, sourced answers and evidence trails they can verify and cite in their own work. Trust the *provenance* more than the *opinion*.
2. **Researchers & academics (political science, law, public administration)** — need navigable structure, timelines, and entity relationships for analysis and publication.
3. **Legal & civil-society analysts** — need claim-vs-evidence mapping and framing comparison to support advocacy, litigation support, or public-interest work.
4. **Engaged citizens** (secondary) — need plain-language, cited answers; lower fidelity tolerance for nuance, but the integrity bar does not drop for them.

**Senators and their staff are *subjects* of the intelligence, not the primary user base** for v1. Senator dashboards exist to *navigate* them as entities, not to serve them as a customer segment yet.

> Detailed persona notes (motivations, failure modes, success signals) are captured in `addendum.md §Personas` rather than a standalone persona section, because persona context is most useful inline at the moments it matters (see User Journeys).

---

## 5. Scope: what "internal-first" means

### 5.1 In scope (v1 = Phase 0 + Phase 1 core)
- **Intelligence ingestion & provenance:** source registry, discover/fetch/dedupe, immutable raw snapshots, per-artifact provenance (source doc + character span).
- **Extraction & knowledge graph:** schema-validated extraction of entities, relationships, claims, evidence; conservative entity resolution; deterministic, rebuildable graph projection.
- **Investigative query:** natural-language Q&A with citation-or-silence; anti-hallucination substring gate; evidence explorer.
- **Interactive graph explorer:** expand/filter neighbors with capped rendering.
- **Temporal & entity views:** timeline explorer (day/week/month/year); an **early/lightweight senator/entity view** (statements, votes, participation, personal timeline). *Note: the TDD phases the full senator dashboard to Phase 2; v1 ships an early read-model and explicitly carries this discrepancy (see `.decision-log.md` D-016).*
- **Editorial integrity core:** citation-or-silence system-wide; fact-vs-claim tagging; source-verb preservation; provenance everywhere; active extraction of supporting/**refuting**/contextualizing evidence with honest split surfacing (decision D-015).
- **Operator tooling:** ingestion monitoring, failure/dead-letter triage, extraction-quality spot-check tooling.
- **Seed case:** the Sara Duterte impeachment, as the single corpus v1 is built and demoed against.

**Seed-case source registry (indicative, not exhaustive).** v1 builds against real Philippine sources across trust tiers:
- **Tier 1 — government/primary:** House of Representatives, Senate of the Philippines, Supreme Court, Official Gazette.
- **Tier 2 — established media:** Reuters, GMA News, ABS-CBN News, Rappler, Philstar, Philippine News Agency (PNA).
- Sources are registered individually with a confirmed trust tier and crawl strategy; the list grows during the internal period.

### 5.2 Out of scope for v1 (deferred)
- Narrative explorer and story generation (Phase 2).
- Media framing comparison view (Phase 2).
- Contradiction detection engine and severity scoring (Phase 3). *Note: v1 **models** contradictions in data and **actively extracts refuting/contextualizing evidence** with honest split surfacing, but does **not** auto-pair claims, score severity, or label anything a "contradiction" — see §6.3 and decision D-015.*
- "AI debate simulator," "AI witnesses," and adversarial-reasoning features (Phase 3).
- Influence analytics (PageRank, betweenness, centrality) (Phase 3).
- Real-time sub-minute streaming ingestion (Phase 4+); v1 is scheduled/batch.
- Multi-tenant SaaS: billing, organizations, quotas, accounts, RBAC, SSO.
- Authoring or publishing political opinion or editorial positions.
- Predictive features (vote forecasting, sentiment prediction).

### 5.3 Multi-case
`[ASSUMPTION]` v1 is **single-case** (Sara Duterte impeachment). The architecture supports multi-case and a later v1.x may add a second case; full multi-case is a post-v1 capability, not a v1 requirement.

---

## 6. Editorial integrity & governance

> This section states binding requirements. It is the most important section in this PRD. The product handles real, named public figures and contested allegations; getting this wrong is reputationally and legally existential.

### 6.1 Binding invariants (non-negotiable for v1)
- **EI-1 Citation-or-silence.** Any **served assertion** — defined as *every declarative clause in a generated answer that makes a factual or attributed claim* — **must** carry at least one document-backed citation, **or it is not returned**. There is no "uncited answer" code path. *"I don't have a sourced answer" is a valid, desirable response.* Connective/framing prose that carries no new factual content is permitted but must not itself assert; the citation-or-silence gate enforces **per-clause** citation, not per-answer. A post-generation parser checks every claim-bearing clause for an attached citation; uncited declarative clauses are stripped before serving (and counted as a metric).
- **EI-2 Fact vs. attributed claim.** Every served assertion is tagged as either an established **fact** or an **attributed claim** (allegation, testimony, denial). Attributed claims are **visually marked** and never presented as established fact. An allegation stated as fact is a **P0 defect, equal in severity to a crash.** *Boundary rule:* an assertion is a **fact** only when established by a tier-1 primary/official source, **or by ≥2 independent sources**; everything else (a single allegation, testimony, denial) is an **attributed claim.** *Independence definition:* two sources are independent only if they have **distinct original reporting** — not republishing the same wire/agency feed, not both citing a common tier-1 release, and not owned by the same parent group for the claim in question. The source registry (FR-1.1) tracks upstream feed provenance (`wire_service`, `original_publisher`) per source; the fact classifier **de-duplicates by original reporting origin, not by outlet count** — if 3 outlets all sourced from the same Reuters wire report, that counts as 1 source, not 3. *Tier-1 conflict rule:* when ≥2 tier-1 sources conflict on the same assertion (e.g., House vs Senate framing of the same event), **neither is served as "fact"** — both are served as attributed claims with the conflict visible. The fact/claim tag is applied to **100% of served assertions** (mechanically enforced + gated before serving), not merely sampled — sampling covers *extraction* quality, the *served* boundary is a hard gate. *Coverage vs. correctness:* the hard gate (NFR-EI-7) ensures a tag exists on 100% of served assertions (coverage); tag **correctness** (is the tag right?) is a separate, sampled metric audited on non-curated live queries (NFR-EI-7a).
- **EI-3 Source-verb preservation.** Verbs carrying legal/epistemic weight ("alleged," "testified," "voted," "denied," "claimed") are preserved **verbatim from the source** and never paraphrased into stronger or weaker wording. *Scope limit (v1):* EI-3 controls preservation at the **per-assertion / per-quote** level. It does **not** fully control higher-order editorial acts — selecting *which* source's verb to surface when sources disagree, aggregation prose, and framing leakage across a multi-source answer. These are acknowledged v1 limitations (see RK-12) and are primary targets for the Phase 2 media-comparison and narrative work.
- **EI-4 Provenance everywhere.** Every entity, relationship, claim, and piece of evidence traces to a stored raw snapshot and a character span. Nothing asserted exists without a source pointer.
- **EI-5 Conservative merge.** When uncertain whether two entities are the same real-world entity, **do not merge**. A duplicate node is a cosmetic defect; an incorrect merge corrupts every downstream answer.
- **EI-6 Anti-hallucination backstop (quote-existence validation).** Every cited quote is mechanically substring-validated against its source chunk — **at extraction time** (hallucinated quotes are dropped before they are ever stored; drops are counted as a metric) **and again at serving time**. A "remembered" fact whose quote cannot be located is discarded. *Scope:* EI-6 is a **quote-integrity gate, not a claim-accuracy gate.** It catches fabricated quotes. It does **not** catch: (a) misattribution (a real quote attributed to the wrong speaker/entity), (b) wrong-document lift (a real quote lifted from the wrong source), (c) context-stripping ("alleged X" → "X"), (d) unquoted fabrication (a paraphrased claim with a real citation that the cited passage doesn't actually support). These uncovered modes are named as risks (RK-2a) and are the primary targets of the claim-to-passage consistency check in the groundedness eval harness (NFR-O-2). The substring gate is a necessary backstop, not a sufficient one.
- **EI-7 Honest evidence split.** For any claim, the platform surfaces supporting **and** actively-extracted refuting/contextualizing evidence together. Where only one side was found, it says so explicitly rather than implying the absence of refutation means consistency (see §6.3).
- **EI-8 Citation-quality floor for named persons.** A single tier-3 (aggregator) allegation about a named person may not be served as if evidentially equivalent to a tier-1 fact; the trust tier is visible on the citation and a lone low-tier defamatory allegation requires a **corroboration signal** or is served with an explicit single-source/low-tier marker. *Corroboration signal definition:* ≥1 additional **independent** source (per EI-2's independence definition) at tier-2 or above that references the same allegation or its subject matter. Corroboration must reference the same allegation, not merely the same subject. A lone tier-3 allegation with no corroboration is always served with the single-source/low-tier marker, never as established.

### 6.2 Governance posture for v1 — gated external presentation
Editorial integrity is **enforced by engineering** (EI-1…EI-8) day-to-day and **operationally supervised by the Intake Operator** during the internal period. **Showing the product to an external audience is itself a soft launch of a defamation-grade tool**, so external exposure is **gated, not skipped**:

- **Pre-External Presentation Gate (mandatory before any audience outside the build team).** A named **human editorial owner** signs off on (a) the demo corpus and (b) a curated set of answer samples, AND a **legal review** (cyberlibel- and republication-aware — see NFR-L-3) clears those same artifacts. No external presentation may proceed until this gate passes (decision D-014).
- The editorial owner is **not a full-time role for all of v1** — they do not sign off every surfaced item day-to-day. They are the accountable human at the gate before exposure, and become the standing owner at the full launch gate.
- This resolves the tension between "engineering-enforced day-to-day" and "presented to external journalists/lawyers": external presentation happens in v1, but only after human editorial + legal sign-off on exactly what will be shown.

### 6.3 What v1 does *not* claim
- Because the contradiction engine is deferred, **v1 must not imply that the absence of a surfaced contradiction means consistency.** Where the platform cannot establish a claim, it says so; it does not default to "consistent" or "true."
- **No misleading-by-omission.** v1 actively extracts refuting/contextualizing evidence (EI-7) and surfaces the honest support/refute split. Where only supporting evidence was found, the evidence explorer states explicitly: *"Only supporting evidence detected in v1; refuting evidence was not surfaced — v1 does not detect contradictions."* The empty refutes tab is never silently empty.
- **No verification claims.** v1 does not label anything "verified," "confirmed," or "true" — there is no verification process in v1, only evidence aggregation with citation.

---

## 7. User journeys

### 7.1 Operator journey — onboarding a new source (v1, internal)
**Protagonist:** the **Intake Operator** (build team). It's Monday; a new batch of Senate hearing transcripts has been published.

1. The operator registers the source in the registry, sets its `source_type` (transcript) and `trust_tier` (1 — primary/official), and configures the crawl strategy.
2. The system confirms the source is **lawfully accessible** (public, no paywall/login/CAPTCHA, robots respected). A source that forbids scraping is **disabled, not bypassed.**
3. Ingestion runs: documents are fetched, cleaned to text, **deduplicated by content checksum**, and **raw snapshots stored immutably** for replay/audit.
4. Extraction runs: entities, relationships, claims, and evidence are produced as **versioned, schema-validated** output; ambiguous entities trigger **conservative-merge** disambiguation (when unsure, two nodes stay separate).
5. The operator watches the ingestion dashboard: successes, failures, dead-letter queue. A failed job is retried with capped backoff; a repeatedly-failing job is surfaced for triage.
6. The operator **spot-checks extraction quality** on a sample — confirming citations resolve to real quotes and that no allegation has been tagged as fact. *This is the integrity checkpoint the operator owns in v1.*
7. On success, the new material is queryable: cited answers, updated graph, extended timeline.

**What must be true for this journey to succeed:** lawful ingestion, deterministic reprocessing, visible failures, and operator-visible integrity checks.

### 7.2 Future-user journey — investigating a claim (the demo story)
**Protagonist:** **Maya Reyes**, investigative reporter at a Philippine broadsheet. She's chasing whether a specific allegation against the VP was made on the record, by whom, and what evidence exists.

1. Maya asks the platform in plain language: *"What allegations have been made about [X], and who made them?"*
2. The platform returns an answer where **every assertion is cited**, each allegation is **visually marked as an attributed claim (not a fact)**, and the verbs are preserved verbatim ("alleged," "testified").
3. She clicks a citation chip → lands on the **evidence explorer**: the claim, the documents that **support/refute/contextualize** it, each linking back to the original source at the exact passage.
4. She opens the **graph explorer** to see who is connected to the claim — entities, relationships (FILED, TESTIFIED_IN, OPPOSED…), expanding neighbors one hop at a time.
5. She checks the **timeline** to see how the claim evolved across dates.
6. She asks an adversarial question the corpus can't support. The platform responds: **"No sourced answer found."** — and Maya's trust goes **up**, not down, because it refused to invent.

**What must be true for this journey to succeed:** citation-or-silence holds under adversarial pressure, claims are visibly distinct from facts, and every step traces to a source.

---

## 8. Features & functional requirements

Requirements are grouped by feature group (FG) with globally numbered, stable IDs. Deferred capabilities (§5.2) are intentionally absent here.

### FG1 — Intelligence ingestion & provenance (operator)
- **FR-1.1 Source registry.** Register and configure sources by type (government, court, media, press release, transcript) and crawl strategy (rss, sitemap, list page, api, manual), with a trust tier (1 primary → 3 aggregator) that is **assigned and confirmed** (source-authenticity validated, not just self-declared) and that feeds evidence reliability and the citation-quality floor (EI-8).
- **FR-1.2 Lawful-access gate.** Confirm a source is public and lawfully accessible before automating it. Sources behind paywalls/logins/CAPTCHAs or whose terms forbid scraping are **disabled**, never bypassed. Robots directives are respected.
- **FR-1.3 Discover, fetch, deduplicate.** Discover URLs per strategy; fetch and clean HTML/PDF to text; **deduplicate by content checksum** so the same document ingested twice is processed once.
- **FR-1.4 Immutable raw snapshots.** Store an immutable raw snapshot of every fetched document for provenance, replay, and audit.
- **FR-1.5 Per-artifact provenance.** Every extracted entity, relationship, claim, and piece of evidence records its source document and character span. Nothing exists without a source pointer.
- **FR-1.6 Idempotent, observable ingestion.** Ingestion jobs are idempotent (re-running is safe), observable (status, throughput), and resilient (per-job retry with capped backoff; dead-letter queue with typed errors for triage).
- **FR-1.7 Operator triage surface.** Operators can view failed/dead-lettered jobs and reprocess after fix; can spot-check extraction output against source text.

### FG2 — Extraction & knowledge graph (operator)
- **FR-2.1 Schema-validated extraction.** Extract entities, relationships, claims, and evidence as **versioned, schema-validated** structured output. A change in extractor version is recorded for provenance. Every extracted quote is **substring-validated at extraction time**; hallucinated quotes are dropped before storage and counted (EI-6).
- **FR-2.2 Claim & evidence modeling.** Capture claim type (allegation, counterclaim, denial, factual assertion), stance (pro/anti/neutral), and verification status. **Actively extract evidence relations — supports, refutes, contextualizes** — for each claim, with a refutes-recall floor (NFR-EI-5). The platform does not passively wait for refutation edges to appear; it prompts for them.
- **FR-2.3 Conservative entity resolution.** Resolve entities via normalized-key exact match, then fuzzy candidate matching, then disambiguation. **When uncertain, do not merge** (EI-5). Duplicates are acceptable; wrong merges are not.
- **FR-2.4 Deterministic graph projection.** Project canonical entities and relationships into a navigable graph. The graph is a **derived projection of the canonical relational data** (not of raw extractions, which pass through staging and resolution first). Dropping the graph and **replaying the relational tables reproduces an isomorphic graph** — the projection is a tested, deterministic function of the relational data. *(Corrects an earlier "replaying extractions" mischaracterization — see `reconcile-tdd.md` G1.)*
- **FR-2.5 Fact-vs-claim tagging & verb preservation.** Tag every assertion as fact or attributed claim per the EI-2 boundary rule (100% of served assertions); preserve source verbs verbatim (EI-3, within its v1 scope limit).

### FG3 — Investigative query & evidence (consumer)
- **FR-3.1 Natural-language Q&A with citation-or-silence.** Accept a natural-language question; return an answer where **every factual assertion carries ≥1 citation, or return "no sourced answer"** (EI-1). There is no uncited-answer path.
- **FR-3.2 Anti-hallucination gate.** Mechanically substring-validate every cited quote against its source chunk **at extraction and again at serving** (EI-6). Quotes that cannot be located are discarded at either stage.
- **FR-3.3 Intent-aware retrieval.** Detect question intent (factual lookup, entity listing, evidence-for-claim, timeline, comparison) and retrieve via a hybrid of graph traversal and semantic similarity. *Done-ness:* all 5 intent types are detectable on the eval fixture with **≥80%** accuracy; unrecognized intent falls back to **factual lookup** with a logged signal (not an error or empty response).
- **FR-3.4 Evidence explorer (honest split).** For any claim, surface supporting, refuting, and contextualizing evidence together, each linking to its source at the exact passage, with each item's trust tier visible. When only one side was found, render the explicit one-sided empty-state (§6.3) — never a silently empty refutes tab.
- **FR-3.5 Interactive graph explorer.** Expand entity neighborhoods one hop at a time, filter by entity/relationship type, with capped, performant rendering for large subgraphs. *Render bound:* first paint **&lt; 2s** for ≤500 nodes; web-worker layout for graphs exceeding 200 nodes.

### FG4 — Temporal & entity views (consumer)
- **FR-4.1 Timeline explorer.** Present dated events at day/week/month/year granularity, with date precision recorded (a "March 2026" event is not shown as "March 1, 2026").
- **FR-4.2 Senator / entity dashboard (early view).** For a person/entity (e.g., a senator), surface **statements, votes, and participation** (all cited) — the v1 read-model fields. *v1 fields:* statements (with source + date), votes (with position + date), participation (hearings attended, roles held). *Deferred to Phase 2:* personal timeline aggregation, influence analysis, cross-entity comparison, sentiment. *v1 ships an early read-model; the full senator dashboard is Phase 2 (TDD, D-016).*

### FG5 — Editorial integrity surface (cross-cutting)
- **FR-5.1 Inline citation rendering.** Every factual assertion in any answer renders an inline, clickable citation linking to source.
- **FR-5.2 Visual claim distinction.** Attributed claims are visually distinct from established facts everywhere they appear.
- **FR-5.3 No-evidence empty state.** When retrieval yields no sourced answer, render an explicit "No sourced answer found" state — never a fabricated or hedged guess.
- **FR-5.4 Honest non-claims.** The platform must not imply consistency, verification, or truth where it has not established it (e.g., it does not label something "verified" absent a verification process; it does not imply "no contradiction found" — the contradiction engine is deferred).
- **FR-5.5 Pre-external editorial & legal gate.** No content may be shown to any audience outside the build team until a named human editorial owner has signed off on the demo corpus + curated answer samples AND a cyberlibel/republication-aware legal review has cleared them (§6.2, D-014). The gate is recorded (what was reviewed, by whom, when).
- **FR-5.6 Citation-quality display.** The trust tier of every citation is visible to the user; low-tier / single-source allegations about named persons carry an explicit marker (EI-8).
- **FR-5.7 Retraction / correction hook.** When a cited source is later corrected or retracted, the platform records the supersession against the stored snapshot and flags affected served answers. *Flag behavior:* the flag renders as (a) a **visible retraction badge** on the affected answer, (b) an **operator alert** in the ingestion dashboard, and (c) **serving suppression** for assertions whose only source has been retracted — they are not served as established (interim default: retracted defamatory content is **suppressed**, not merely downgraded, until the legal-review-defined workflow (OQ-10) is in place; the conservative default errs toward not surfacing retracted defamatory content). A multi-source assertion with one retracted source is re-evaluated: the retracted source is removed and the assertion is re-tagged based on remaining sources. See OQ-10 and DR-6.

---

## 9. Non-functional requirements

### 9.1 Editorial integrity (cross-cutting quality bar)
- **NFR-EI-1** Citation coverage on served factual assertions: **100%**.
- **NFR-EI-2** Allegation-as-fact incidents in served answers: **0** (P0 on any occurrence).
- **NFR-EI-3** Merge-error rate (incorrect entity merges): target **≈0**, prioritized over duplicate rate. *Measurement:* merge precision and recall are measured on a **held-out entity-resolution eval set with ground-truth labels** (not tautological — the conservative bias trades recall for precision, and both are visible). Duplicate rate is **bounded** (e.g., duplicate rate &lt; X% on the eval set), not accepted unboundedly.
- **NFR-EI-4** Every served assertion resolves to a stored raw snapshot + character span: **100%**.
- **NFR-EI-5** Refutes-edge recall floor: extracted refuting/contextualizing evidence is recalled on **≥70%** `[ASSUMPTION]` of claims where such evidence exists in the corpus. *Fixture requirements:* the eval fixture must include **≥N claims** with human-annotated refuting evidence, across **≥M source types and tiers**, including adversarial cases where refuting evidence is subtle, indirect, cross-tier, or in a different document than the claim. Fixture composition (size, source diversity, difficulty distribution) is reported alongside the metric so a reviewer can judge whether 70% is meaningful. A stretch target (≥80%) applies to the adversarial subset. *Independence:* the fixture is authored or double-annotated by someone **independent of the extractor's builder** who reads the source corpus to determine ground truth — otherwise the floor measures "did we find what we already knew was there," not "did we find what we missed."
- **NFR-EI-6 (counter to NFR-EI-1)** Answer rate on legitimate questions must not collapse to hit 100% citation — over-silence is a failure mode. Maintain a recall/answer-rate floor; "I don't know" must be *correct*, not *convenient*.
- **NFR-EI-7** Fact/claim tag **coverage** on served assertions: **100%** (hard gate before serving — ensures a tag exists, not that it is correct).
- **NFR-EI-7a** Fact/claim tag **correctness** on served assertions: sampled audit on **non-curated live queries** (not the adversarial demo set), with a correctness floor and a named owner. The defamation risk lives in tag-correctness, not tag-coverage; this metric is what guards it.
- **NFR-EI-8** Citation-quality floor (EI-8): a lone tier-3 allegation about a named person is never served as established; single-source/low-tier markers present where required; corroboration signal defined per EI-8.

### 9.2 Performance
- **NFR-P-1** Query latency p95 < **10 s** end-to-end; p50 < **3 s** goal.
- **NFR-P-2** Ingestion throughput ≥ **a few hundred documents/hour** on a single node (extraction-bound).
- **NFR-P-3** Graph neighborhood queries return within hop/count caps (e.g., 1-hop capped) to bound traversal cost.

### 9.3 Security & access
- **NFR-S-1** v1 API is **read-only public**; no user write endpoints are exposed. Ingestion is internal-only.
- **NFR-S-2** All inputs validated; all database/graph queries parameterized; entity IDs from user input validated as UUIDs before binding — no string-built queries.
- **NFR-S-3** Per-IP rate limiting on query endpoints (429 with Retry-After); payload-size caps to defend against prompt flooding.
- **NFR-S-4** Secrets via environment only, never committed; process refuses to start on invalid configuration.
- **NFR-S-5** Raw object store is private; only derived public-sourced content is on the serving path.

### 9.4 Legal, ethical & compliance
- **NFR-L-1** Ingest only **public, lawfully accessible** material. Respect robots directives and source terms; disable, never bypass.
- **NFR-L-2** `[ASSUMPTION]` **Philippine Data Privacy Act of 2012 (RA 10173)** posture: v1 ingests only already-public political/government material about public figures in their public capacity; structured logs carry no data beyond what sources already publish publicly. **A DPA posture review is part of the Pre-External Presentation Gate (FR-5.5)** — external presentation to journalists/researchers/lawyers is "beyond the internal period" in any meaningful sense (the audience is no longer the build team), so the DPA review runs **alongside** the cyberlibel review, not after it. `[NOTE FOR PM]` The boundary between "internal period" and "launch" is now explicit: external presentation triggers the DPA review. A formal full compliance review remains an open item before any broader launch.
- **NFR-L-3** **Libel / cyberlibel posture (hard gate, not an open question).** Philippine cyberlibel (RA 10175 §4(c)(4), as read in *Disini v. Secretary of Justice*) covers **republication** — surfacing a defamatory allegation, even verbatim and cited, can carry liability, and selective publication can be argued as malice. The editorial invariants (§6) are the *first* defense, not the *only* one. **Before any external presentation**, a cyberlibel- and republication-aware legal review clears the demo corpus + curated answer samples (this is the legal half of the Pre-External Gate, FR-5.5). The review also defines retraction/correction handling (NFR-L-5). The specific reviewer/counsel is an open assignment (OQ-4); the gate itself is mandatory.
- **NFR-L-4** Retention of raw snapshots and superseded extractor versions: policy TBD (open item) — affects storage sizing and the right-to-be-forgotten boundary.
- **NFR-L-5** `[ASSUMPTION]` **Retraction/correction handling:** when a source is corrected or retracted, the supersession is recorded and affected served answers are flagged (FR-5.7). Exact retention/takedown workflow is defined by the legal review (NFR-L-3) — open item (OQ-10).

### 9.5 Provenance, auditability & reproducibility
- **NFR-A-1** Every served fact traces to a stored raw snapshot + span (auditability).
- **NFR-A-2** Re-extraction and graph rebuild are deterministic and versioned (reproducibility). *Model-weight pinning:* the underlying Ollama model weights are part of the determinism contract — a model update (new point release) may break reproducibility and requires a re-extraction version bump. The `extractor_version` stamp includes model identifier + weight hash, not just extractor code version.
- **NFR-A-3** Writers use idempotent upsert semantics on deduplication anchors — never blind inserts.

### 9.6 Reliability
- **NFR-R-1** v1 is **single-node best-effort** with graceful degradation if a worker is down. *Degradation behavior:* query path remains live (read-only API unaffected); ingestion pauses and resumes on worker recovery; operator notified via dashboard. A hard worker failure surfaces in the dead-letter queue for triage.
- **NFR-R-2** Per-agent queues with independent concurrency; capped exponential backoff; dead-letter queue with typed errors.
- **NFR-R-3** Multi-step agent runs persist state per run for resume-after-crash.

### 9.7 Local-first & deployment posture (a deliberate constraint)
- **NFR-D-1** The full stack runs on **a single workstation** with no proprietary cloud dependency required. `[ASSUMPTION]` This is a binding v1 constraint, not a preference — it governs feasibility, demo setup, and on-prem/hosting options.
- **NFR-D-2** Local models are the **default for ingestion, extraction, embedding, and lightweight read-model work**; any cloud/stronger model use is an **optional, pluggable, recorded tier**. **The high-citation-fidelity Q&A / render path is required to use a cloud/stronger model tier in v1** because the chosen local model (Qwen3-14B per ADR-005) cannot meet the hard CI gates on the target hardware. Pre-build feasibility check results (2026-06-22):
  - Local Qwen3:14B + bge-m3 on Apple Silicon failed the hard gates: quote-validity 21%, groundedness 17%, p95 latency 269s.
  - Local Qwen3:14B + bge-m3 with a **verbatim-citation pipeline** passed integrity gates (quote-validity 100%, groundedness 100%, fact/claim coverage 100%) but p95 latency remained 147s (target ≤10s).
  - Cloud re-test with **Gemini 2.5 Pro + local bge-m3** using the two-call verbatim-citation pipeline passed all integrity gates and p95 latency was **13.1s** (target ≤10s; gap ~3s).
  - Cloud re-test with **Gemini 2.5 Flash + local bge-m3** using the two-call pipeline failed groundedness (75%) and latency (12.1s).
  - Cloud re-test with **Gemini 2.5 Flash + local bge-m3** using a **single-call generation schema** passed all hard gates: quote-validity 100%, groundedness 100%, fact/claim coverage 100%, **p95 latency 9.5s**.
  **Decision:** v1 Q&A answer generation is served by **Gemini 2.5 Flash (single-call)** for the Q&A / render path, with **Gemini 2.5 Pro or equivalent** as an optional fallback for high-stakes verification. Ingestion, extraction, embedding, and lightweight read-model work remain local. The cloud model use is recorded per response for provenance. This split is recorded in ADR-005 and `project-context.md`. ⚠️ **Caveat:** the pilot’s single-call output returned prose answers with `assertions: 0`; the production pipeline must enforce structured citations (`assertions` with `claim_type` and `citations`) before the render gate, or the coverage/groundedness metrics are not meaningful. `[NOTE FOR PM]` Re-test on a larger question set after production structured-citation parsing is implemented to confirm p95 ≤10s holds at scale.
- **NFR-D-3** Fully open-source software stack.

### 9.8 Observability
- **NFR-O-1** Structured logs; metrics; traces across ingestion, extraction, query.
- **NFR-O-2** A groundedness evaluation harness with explicit CI gates. **Hard gates (non-relaxable — weakening a hard gate to pass a build is rejected; disabling the substring check to raise recall is forbidden):** quote-validity **100%** *(quote-existence check — catches fabricated quotes, not misattribution or context-stripping; see EI-6 scope)*, projection-determinism **exact** *(drop+replay → isomorphic graph — a reproducibility guarantee, not a correctness guarantee; does not imply the graph is correct)*, groundedness **≥0.95** *(includes claim-to-passage consistency: does the cited passage actually support the claim, not just contain the quote)*, fact/claim tag **coverage** **100%** *(ensures a tag exists; tag correctness is NFR-EI-7a, sampled separately)*. **Soft gates (tracked, trended, may gate release but not every build):** recall **≥0.75**, entity-resolution **≥0.90**, refutes-edge recall **≥0.70** (NFR-EI-5), tag-correctness **≥0.90** (NFR-EI-7a, sampled on non-curated queries). Human spot-checks are performed by **rotating independent reviewers** — defined: at least one structurally external (contracted, not volunteered; reporting line independent of the build team), never by the same model that generated the answer; the adversarial demo question set includes items authored/reviewed **external to the build team** (minimum **≥30%** externally authored — not "where feasible").

---

## 10. Success metrics & counter-metrics

v1 success is about **proving integrity on real data** and **being presentable**, not adoption scale.

### 10.1 Integrity & quality (the proof)
- **SM-1** Citation coverage on served factual assertions: **100%**.
  - *Counter:* **CM-1** Answer rate on legitimate questions must not collapse to hit 100% — over-silence is a failure mode, not success. Set a recall/answer-rate floor; "I don't know" must be *correct*, not *convenient*.
- **SM-2** Allegation-as-fact incidents in eval/demo: **0**.
- **SM-3** Merge-error rate: **≈0** (measured on held-out labeled set), accepting higher duplicate rate as the tradeoff — **bounded** (duplicate rate &lt; X% on eval set, not unbounded).
- **SM-4** Extraction accuracy on eval fixtures: **>85%** (per north-star PRD).
- **SM-4a** Query answer accuracy: **>90%** (per north-star PRD) — *answer correctness vs. the sources*, judged independently of citation coverage. (Citation coverage measures "is it cited?"; this measures "is the cited answer actually right?") Independently spot-checked, not self-graded. *Methodology:* sample size ≥30 answers per eval cycle, sampled from the **non-curated live query log** (not the adversarial demo set); correctness rubric: "the answer matches what the cited sources actually say, with no misattribution, context-stripping, or unsupported synthesis"; reviewer independence: at least one reviewer structurally external to the build team (per NFR-O-2).
- **SM-4b** Refutes-edge recall (NFR-EI-5): **≥70%** on the eval fixture — the misleading-by-omission guard.

### 10.2 Performance
- **SM-5** Query p95 < **10 s**.
  - *Counter:* **CM-2** Latency is never bought by dropping the citation gate or skipping the substring validation.

### 10.3 Demo / presentation readiness (the pitch proof)
- **SM-6** The Sara Duterte seed case achieves a **demonstrably useful corpus**. Indicative targets `[ASSUMPTION]` (operator confirms at ingestion; full table in `addendum.md §Demo targets`): **≥500 documents** across **≥3 tier-1** and **≥3 tier-2** sources; **≥1,500 entities**; **≥3,000 relationships**; sufficient to answer non-trivial investigative questions with citations. *Hard floor (demo does not proceed below):* **≥300 documents, ≥800 entities, ≥1,500 relationships** — if the floor isn't met, the demo is delayed, not re-baselined.
- **SM-7** **Adversarial demo passes:** a curated set of "unanswerable" questions all correctly return "no sourced answer," and a curated set of answerable questions all return cited, correctly-tagged answers. Target: **100%** on the curated adversarial set. The set is authored/reviewed at least in part external to the build team.
- **SM-8** **Gated external presentation lands.** External presentation occurs **only after** the Pre-External Gate (FR-5.5) passes. Success is not "a presentation happened" — it is a falsifiable signal that the pitch landed: structured feedback from **≥1 external audience segment** (journalists / researchers / legal-civil-society), **AND** **both** of: (a) **≥50%** of a sampled set of demo cited answers independently spot-verified by audience members as resolving correctly, **and** (b) a concrete follow-up request (pilot access, partnership conversation, or funding next-step) from ≥1 audience member. `[ASSUMPTION]` thresholds; refine after first presentation. *Note:* the conjunction (not disjunction) ensures the metric cannot pass on easy interest alone — both verification and follow-up are required.

---

## 11. Demo & presentation readiness

Because the explicit goal of the internal-first build is to **be presented to future users**, demoability is a first-class requirement, not an afterthought.

- **DR-1 Demo corpus.** The Sara Duterte case must be deep enough to support credible, non-trivial demos across all v1 surfaces (chat, graph, timeline, evidence, senator dashboard). `[ASSUMPTION]` target corpus size is defined in `addendum.md §Demo targets`.
- **DR-2 Adversarial demo script.** A rehearsed demo that **deliberately includes questions the platform cannot answer** to showcase citation-or-silence — the feature most likely to earn trust from skeptical journalists and lawyers.
- **DR-3 Provenance-on demand.** Every demo answer can be drilled from assertion → citation → evidence → raw source passage, live, in front of the audience.
- **DR-4 Honest framing.** The presentation must state what v1 **does not do** (no contradiction detection, no opinion, no prediction) as clearly as what it does — overselling integrity features the platform doesn't yet have would destroy the trust the demo is meant to build.
- **DR-5 Pre-External Gate executed.** The demo corpus + curated answer samples have passed editorial sign-off + legal review (FR-5.5) before the audience arrives. The gate record (reviewer, date, scope) is available on request.
- **DR-6 Live retraction scenario.** The demo can show what happens when a source is corrected/retracted (FR-5.7) — proving the platform does not freeze a possibly-defamatory, now-superseded claim.

---

## 12. Risks & mitigations

| # | Risk | Mitigation |
|---|---|---|
| RK-1 | **Allegation-as-fact** reaches a user (defamation-grade) | EI-1/2/6 invariants; substring gate; P0 severity; operator spot-checks; pre-launch legal review (NFR-L-3) |
| RK-2 | **Hallucinated citations** | Substring validation on every quote; citation-or-silence; groundedness eval with rotating human spot-check; model never judges its own output |
| RK-2a | **Substring gate blind spots** — misattribution, wrong-document lift, context-stripping, unquoted fabrication pass the quote-existence check (EI-6 scope) | Acknowledged EI-6 scope limit; claim-to-passage consistency check in groundedness eval (NFR-O-2); misattribution check added to eval harness; named as uncovered modes in EI-6 |
| RK-3 | **Wrong entity merge** corrupts downstream answers | Conservative-merge bias (EI-5); fuzzy threshold + LLM disambiguation; merge-error ≈0 target measured on held-out labeled set |
| RK-4 | **Source bias / framing leakage** presented as neutral fact | Fact-vs-claim tagging; source-verb preservation; (deferred) media comparison view |
| RK-5 | **Local model quality ceiling** caps extraction/answer quality | Pluggable cloud tier per task; answer generation designated to Gemini 2.5 Flash (single-call) for v1 with Pro as high-stakes fallback; ingestion/extraction/embedding remain local; recall trend tracked in CI |
| RK-5a | **Local-model feasibility** — local Qwen3-14B cannot meet hard gates + latency target on target hardware | Decision recorded in ADR-005: local Qwen3-14B for ingestion/extraction/embedding, cloud Gemini 2.5 Flash (single-call) for Q&A answer generation. Production must enforce structured citations; re-test at scale before F1 |
| RK-6 | **Legal/ToS limits** block key sources | Trust tiers; robots respect; disable-not-bypass; source-by-source review |
| RK-7 | **Graph scale** degrades exploration | Hop caps + count LIMITs; vector HNSW; web-worker layout for large graphs |
| RK-8 | **Defamation-grade tool shown externally without human sign-off** | Pre-External Presentation Gate (FR-5.5): named editorial owner + cyberlibel-aware legal review clear demo corpus + answer samples before any external audience (D-014) |
| RK-9 | **Over-silence** (NFR-EI-6) — platform refuses too much to protect citation rate | Recall/answer-rate floor monitored; balance tuned, not maximized one-sidedly |
| RK-10 | **Demo oversell** erodes trust | DR-4 honest framing; adversarial demo; state deferred features plainly |
| RK-11 | **Single-case overfitting** — architecture/corpus/eval tuned only to the Duterte case | Design extraction schemas + eval fixtures to generalize; no case-specific hardcoding; second case planned in v1.x (OQ-7) as a generalization check |
| RK-12 | **Aggregation/framing leakage** — EI-3 controls per-quote verbs but not multi-source aggregation prose or verb-source selection when sources disagree | Acknowledged v1 limitation (EI-3 scope); primary target for Phase 2 media-comparison + narrative work; conservative aggregation defaults; flagged in DR-4 |
| RK-13 | **Retraction/correction** — a served assertion's source is later retracted; stale defamatory claim persists | FR-5.7 supersession hook + DR-6 live scenario; interim default: suppression of retracted defamatory content; full takedown workflow defined by legal review (OQ-10) |
| RK-14 | **Self-graded quality** — own fixtures, own adversarial set, own demo script bias the numbers | Rotating independent human reviewers (≥1 structurally external); ≥30% adversarial set externally authored (not "where feasible"); independent answer-accuracy spot-check (SM-4a, SM-7); refutes-edge fixture independently annotated (NFR-EI-5) |
| RK-15 | **Demo dies live** — Ollama hangs/OOMs on stage; pitch collapses with no fallback | Cached/pre-rendered fallback path for demo; degraded read-only mode; name as operational risk in demo planning |
| RK-16 | **English-only credibility risk** — Filipino-language silence reads as incompleteness, not integrity, to target audience | OQ-9 gated `fil` coverage; DR-4 states v1 is English-only if `fil` fails gate; coverage gap disclosed, not hidden |

---

## 13. Open questions & assumptions

### 13.1 Gates (decide by a stated trigger, not left open)
- **OQ-1** `[PRE-BUILD GATE]` **Embedding model & dimension** must be locked **before building the vector index** (schema-affecting). Owner: tech lead. Candidates/tradeoffs in `addendum.md §Tech decisions`. *Status: a decision, with a named owner and trigger — not a lingering question.*
- **OQ-2** `[PHASE-2 GATE]` **Graph store** — stay on the in-Postgres graph engine, or adopt a standalone graph database if traversal complexity grows. Owner: tech lead. Trigger: before Phase 2 graph features. v1 internal-first proceeds on the in-Postgres engine.
- **OQ-4** `[PRE-BUILD SCHEDULING GATE]` **Legal reviewer/counsel** for the Pre-External Gate (FR-5.5). The gate is **mandatory**; the specific counsel is an open assignment — but because the gate's existence shapes what gets surfaced (what is surfaced is what counsel must review), **retained cyberlibel counsel is a pre-build scheduling gate, not a "pre-external assignment."** If counsel is not retained in time, the presentation is deferred (not weakened). Today this is a P0 scheduling risk, not a non-blocker. Owner: product. Trigger: before the first external presentation; ideally before extraction design is finalized.

### 13.2 Non-blocking (deferred with owner + revisit condition)
- **OQ-5** Retention policy for raw snapshots / superseded extractors (owner: operator; revisit: before scale-out; ties to NFR-L-4/L-5). `[NOTE FOR PM]` **Blocking for the Pre-External Gate** if retained snapshots contain retracted/superseded defamatory material — retention of retracted raw snapshots is legal-existential for a cyberlibel-aware tool.
- **OQ-6** Standing human editorial owner (full role, beyond the Pre-External Gate sign-off) (owner: product; revisit: at the full launch gate).
- **OQ-7** Multi-case sequencing and the second seed case — also the generalization check for RK-11 (owner: product; revisit: after v1 presentation feedback).
- **OQ-8** Monetization / sustainability model (not in scope for v1; owner: product; revisit: post-presentation).
- **OQ-9** Filipino-language (`fil`) extraction quality. *Elevated:* `fil` coverage is load-bearing for a Philippine corpus, not a nice-to-have. Owner: operator. Trigger/gate: an `fil` eval fixture must pass the same integrity gates before any claim of `fil` coverage; do not silently assume local-model quality transfers. *Model-quality risk:* local models (Qwen2.5-14B / Llama-3.1-8B) are not Filipino-specialized; Filipino political/legal text uses specialized register (*kasong libelo*, *pinagbintangan*) that general-purpose models may extract poorly. *Fallback:* if `fil` fails the gate, v1 is English-only with a **stated coverage gap** disclosed in the demo (DR-4 honest framing) — Filipino sources are ingested and searchable but not extracted for claims/relationships until a Filipino-capable model is available. English-only silence on a Philippine corpus is a material limitation, not a footnote.
- **OQ-10** Retraction/correction takedown workflow (FR-5.7, NFR-L-5) — exact retention and takedown steps defined by the legal review (owner: product + counsel; revisit: at Pre-External Gate). `[NOTE FOR PM]` **Blocking for the Pre-External Gate** — the takedown workflow must be defined before surfacing retracted defamatory content to external audiences.

### 13.3 Resolved during Finalize
- **OQ-3** *(resolved → D-015)* v1 **actively extracts** refuting/contextualizing evidence and surfaces the honest split with an explicit one-sided empty-state (EI-7, FR-2.2, FR-3.4, NFR-EI-5). It does not label anything a "contradiction."
- **Editorial governance vs. external presentation** *(resolved → D-014)* engineering-enforced day-to-day + a mandatory **Pre-External Presentation Gate** (human editorial sign-off + cyberlibel-aware legal review) before any external audience (§6.2, FR-5.5, NFR-L-3).
- **Senator dashboard phasing** *(resolved → D-016)* v1 ships an **early/lightweight** senator/entity view; the full dashboard remains Phase 2 per the TDD.

### 13.4 Confirmed assumptions (rolled forward from Discovery)
Inferred during Discovery and **confirmed by the user** (recorded in `.decision-log.md`): product name = IIP; scope = Phase 0 + Phase 1 core; seed case = Sara Duterte impeachment, single-case; future-user priority = journalists → researchers → legal/civil-society → citizens; senators = subjects; presentation purpose = credibility/partnership pitch.

### 13.5 Assumptions index
Every inline `[ASSUMPTION]` in this PRD, for triage:
- §4.2 — future-user audience priority order.
- §5.3 — v1 single-case.
- §9.4 NFR-L-2 — PH DPA posture (public-figure/public-capacity data only); DPA review now part of Pre-External Gate.
- §9.4 NFR-L-5 — retraction handling posture (workflow defined by legal review).
- §9.7 NFR-D-1 — single-workstation / no-proprietary-cloud as a **binding** v1 constraint.
- §9.7 NFR-D-2 — local-model feasibility check (pre-build); "cloud never required" may be aspiration if local models can't hit hard gates.
- §9.1 NFR-EI-5 — refutes-edge recall floor **≥70%** (operator confirms against independently-annotated eval fixture).
- §10.3 SM-6 — indicative corpus targets (operator confirms at ingestion); hard floor defined.
- §10.3 SM-8 — presentation-success thresholds (refine after first presentation).

### 13.6 Notes for PM
- `[NOTE FOR PM]` at NFR-L-2 (§9.4) — DPA review trigger boundary (now folded into Pre-External Gate).
- `[NOTE FOR PM]` at NFR-D-2 (§9.7) — local-model feasibility tension with hard gates.
- `[NOTE FOR PM]` at OQ-5 (§13.2) — retention blocking for Pre-External Gate if defamatory material retained.
- `[NOTE FOR PM]` at OQ-10 (§13.2) — takedown workflow blocking for Pre-External Gate.

---

## 14. Glossary

- **Citation-or-silence** — every **served assertion** (every declarative clause making a factual or attributed claim) carries a source citation, or it is not served; "no sourced answer" is a valid response. Per-clause, not per-answer.
- **Attributed claim vs. fact** — an *attributed claim* is something a source *said* (allegation, testimony, denial); a *fact* is something *established*. They are tagged and visually distinct. *Fact* = tier-1 source OR ≥2 **independent** sources (distinct original reporting, not republishing the same wire/agency feed). *Tier-1 conflict:* when ≥2 tier-1 sources conflict on the same assertion, neither is fact — both are attributed claims with the conflict visible.
- **Conservative merge** — when unsure two entities are the same, keep them separate; prefer duplicates over wrong merges. Measured as merge precision/recall on a held-out labeled set; duplicate rate bounded.
- **Provenance** — the source document + character span backing every extracted artifact; the raw immutable snapshot enabling replay/audit.
- **Substring validation (quote-existence validation)** — mechanical check that a cited quote literally appears in its source chunk; the anti-hallucination backstop. *Scope:* catches fabricated quotes; does not catch misattribution, wrong-document lift, context-stripping, or unquoted fabrication (see RK-2a).
- **Trust tier** — source reliability grade (1 primary/official → 3 aggregator) feeding evidence weighting.
- **Deterministic graph projection** — the navigable graph is a tested, deterministic function of the **canonical relational data** (not of raw extractions); drop + replay reproduces an isomorphic graph. A *reproducibility* guarantee, not a *correctness* guarantee.
- **Refutes-edge recall** — of the claims in the corpus that *have* refuting evidence, the fraction the extractor successfully captured; the guard against misleading-by-omission (NFR-EI-5). Measured on an independently-annotated eval fixture with specified composition.
- **Citation-quality floor** — a lone low-tier/single-source allegation about a named person is not served as established (EI-8); requires a **corroboration signal** (≥1 additional independent source at tier-2+ referencing the same allegation).
- **Tag coverage vs. tag correctness** — *coverage* (NFR-EI-7): 100% of served assertions have a fact/claim tag (hard gate, mechanical); *correctness* (NFR-EI-7a): the tag is right (sampled audit on non-curated live queries). The defamation risk lives in correctness, not coverage.
- **Pre-External Presentation Gate** — mandatory human editorial sign-off + cyberlibel-aware legal review + DPA posture review of the demo corpus + answer samples before any audience outside the build team (FR-5.5).
- **Cyberlibel / republication** — under PH RA 10175 §4(c)(4) (*Disini*), republishing/surfacing a defamatory allegation can itself carry liability; the reason citation alone is not a complete defense.

---

## 15. Appendix pointers

- **Technology decisions, options-considered, API surface, and data-model overview:** `addendum.md` (defers to the TDD as the authoritative technical source).
- **Persona depth:** `addendum.md §Personas`.
- **Deferred (Phase 2/3) feature detail and rationale:** `addendum.md §Deferred scope`.
- **Decisions and overrides:** `.decision-log.md`.
