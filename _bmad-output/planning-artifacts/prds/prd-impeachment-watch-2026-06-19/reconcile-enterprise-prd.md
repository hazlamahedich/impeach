# Reconciliation Review — Enterprise PRD → Internal-First PRD

**Source (north star):** `Enterprise_PRD_Impeachment_Intelligence_Platform.md`
**Targets:** `prd.md` + `addendum.md` (internal-first scope)
**Reviewer lens:** product-intent, positioning, tone, qualitative ideas silently dropped or weakened.

---

## Verdict

The target carries the **evidence-discipline identity stronger than the source** (citation-or-silence, substring gate, conservative merge are sharper and more concrete), but it **flattens the platform's ambition and geographic positioning**: the "Political Intelligence Operating System" north star, the "most comprehensive … in the Philippines" framing, the named PH data sources, and the user-facing query-accuracy metric all silently disappear. Four medium/high gaps are worth closing before this PRD is presented or built against.

---

## Gaps

### GAP-1 — "Political Intelligence Operating System" long-term vision: dropped
**What was dropped.** The source's final section names the long-term evolution explicitly: *"Evolve into a Political Intelligence Operating System capable of ingesting any major Philippine political controversy, investigation, legislative inquiry, or corruption case and automatically generating a searchable, explainable intelligence graph."* The target never uses this phrase, nor restates the multi-controversy/multi-case platform ambition. §2 Executive Summary describes a single-case knowledge graph; §3 Opportunity says "Consolidate the corpus into a single graph" — singular, mechanism-level, not platform-level. The closest the target comes is §5.3 ("architecture supports multi-case"), which is technical, not visionary.

**Why it matters.** This is the product's north-star identity and the thing that separates it from "an impeachment tracker." An internal-first PRD that exists *to be presented to future users/funders/partners* must show where v1 is a *proof of the pattern*, not the whole product. Without the OS framing, the pitch reads as a one-off tool, which (a) under-sells the platform thesis to the journalist/researcher/funder audience SM-8 targets, and (b) gives no rationale for why the architecture is over-built for a single case (deterministic projection, trust tiers, extractor versioning). The deferred Phase 2/3 features (narrative explorer, media comparison, contradiction engine, influence analytics) are exactly the components of that operating system; deferring them without naming the whole erases the connective tissue.

**Severity: HIGH.**

**Suggested fix.** Add a short "North star (where this is going)" subsection in §2 or §3 — one paragraph — that: (a) names "Political Intelligence Operating System for Philippine political controversies" as the long-term product, (b) states v1 is the single-case proof of the pattern on the Sara Duterte impeachment, (c) lists the deferred Phase 2/3 capabilities as the *components* of that OS, not as unrelated cuts. Keep it vision, not scope.

---

### GAP-2 — Named Philippine data sources not acknowledged
**What was dropped.** Source §Data Sources names specific government bodies (House of Representatives, Senate of the Philippines, Supreme Court, Official Gazette) and media outlets (Reuters, GMA News, ABS-CBN News, Rappler, Philstar, PNA). The target speaks only in generic source *types*: FR-1.1 ("government, court, media, press release, transcript"); the addendum §Demo targets table says "across gov/court/media/transcript/press sources." No named source appears anywhere in the PRD or addendum.

**Why it matters.** Three reasons. (1) **Geographic specificity / credibility.** For a product whose stated presentation audience is *Philippine* journalists and researchers (P-2, P-3), naming the canonical outlets (GMA, ABS-CBN, Rappler, Philstar) and official bodies (House, Senate, SC, Official Gazette) signals the team knows the actual media and institutional landscape. A PRD with only generic types could be about any country; that undercuts the "in the Philippines" positioning. (2) **Lawful-access feasibility.** Several of these outlets (ABS-CBN post-franchise, Rappler's legal status) have real ToS/scraping constraints; naming them early makes the lawful-access gate (FR-1.2) concrete rather than abstract. (3) **Demo readiness.** DR-1 demands a "demonstrably useful corpus" but the demo targets are all `_TBD_`; naming anticipated seed sources turns a placeholder into a plan.

**Severity: MED.**

**Suggested fix.** Add a §Seed sources subsection (under §5 Scope, or expand addendum §Demo targets) listing anticipated seed sources by name — government (House, Senate, Supreme Court, Official Gazette), media (Reuters, GMA, ABS-CBN, Rappler, Philstar, PNA), other (hearing transcripts, press releases, public statements) — with an explicit note that final inclusion is gated by the lawful-access review (FR-1.2/NFR-L-1) and trust-tier assignment. Mark as anticipated, not committed.

---

### GAP-3 — "Most comprehensive … in the Philippines" positioning language lost
**What was dropped.** Source vision: *"the most comprehensive, explainable, and evidence-backed political intelligence platform in the Philippines."* Target §2 keeps "explainable, evidence-backed knowledge graph" but drops both **"most comprehensive"** and **"in the Philippines."** The competitive superlative and the geographic anchor are both gone. §3 Opportunity restates the differentiator ("explainability and evidence discipline") but without the market-positioning frame.

**Why it matters.** "In the Philippines" is the market/competitive anchor — it tells the reader this is a PH-specific product competing with whatever PH political-tracking exists (which is little, and that's the point). Dropping it makes the PRD feel placeless. "Most comprehensive" is the competitive claim; the target is correctly cautious about over-claiming (DR-4 honest framing), but an *aspirational* positioning statement is different from a *feature claim*, and the source uses it as vision, not as a v1 promise. The target's risk-aversion on oversell (good) appears to have over-corrected into removing the positioning entirely.

**Severity: MED.**

**Suggested fix.** Restore "in the Philippines" to §2 Executive Summary or §3 Opportunity (it's a fact about the product's market, not a v1 capability claim). For "most comprehensive," either (a) keep it as explicit *aspiration* with a v1 caveat ("v1 proves the integrity core on one case; the long-term ambition is the most comprehensive PH political intelligence platform"), or (b) soften to "the most *evidence-disciplined*" if "comprehensive" feels unsupportable pre-scale. Don't drop the geographic anchor either way.

---

### GAP-4 — Query-accuracy metric dropped (source: >90%)
**What was dropped.** Source §Success Metrics: *"Query accuracy > 90%"* as one of four headline metrics. Target §10.1 has: citation coverage 100% (SM-1), allegation-as-fact 0 (SM-2), merge-error ≈0 (SM-3), extraction accuracy >85% (SM-4). **Query accuracy is absent.** The nearest target metric, CM-1 (answer-rate floor), is about *recall* (don't over-silence), not about whether the answers given are *correct*.

**Why it matters.** Citation coverage ≠ answer correctness. A platform can hit 100% citation coverage and still serve a *wrong but cited* answer (e.g., cites the right document but misreads it, or the retrieval surfaces a supporting source when the user asked about a refutation). For a demo to skeptical journalists/lawyers (SM-7, SM-8), "is the answer right?" is the first question after "is it cited?" — and it's the most user-facing quality signal. Its absence leaves a gap between the integrity metrics (which are about *process invariants*) and actual answer quality (which is about *outcome*). Extraction accuracy >85% (SM-4) measures the *input* pipeline, not the *output* answer. This belongs even in an internal-first PRD because the internal-first build's whole point (per §3.3) is to *prove a property on real data* — and correctness on real questions is part of that property.

**Severity: MED.**

**Suggested fix.** Add an SM for **answer faithfulness/correctness on a curated eval set** (distinct from CM-1 recall and SM-4 extraction accuracy). Target can be initially TBD or ~90% (matching source), with a note that the eval set is the same curated answerable/adversarial set used for SM-7. This closes the loop: citation coverage (process) + answer correctness (outcome) together define "didn't invent or inflate."

---

### GAP-5 — "Source validation" function partially subsumed (Fact Checker agent)
**What was dropped.** Source lists **"Agent 5: Fact Checker — Source Validation, Contradiction Detection"** as a core agent. The target explicitly defers the *contradiction detection* half (good, conscious — §5.2, OQ-3). But the *source validation* half (actively verifying the reliability/authenticity/trust tier of a source, not just assigning one) is only partially covered: FR-1.1 assigns trust tiers, FR-1.2 checks lawful access, NFR-L-1 checks public/lawful — but there is no named capability for *validating that a source is what it claims to be* (e.g., distinguishing an official Senate transcript from a press release *about* a Senate hearing, or detecting a mislabeled/mirrored source).

**Why it matters.** For a product whose entire value is "every assertion traces to a verbatim source," *source misattribution* is a quiet integrity failure: a claim sourced to "the Senate" that actually came from a blog paraphrase. Trust tiers are *assigned*, not *validated*. At v1 scale with a small team this may be operationally covered by the Intake Operator (P-1), but it's not named as a requirement, so it won't be built or tested.

**Severity: LOW.**

**Suggested fix.** Either (a) add a sub-bullet under FR-1.1 or FR-1.7 requiring the operator to confirm `source_type` and `trust_tier` against the actual source (not just the registered one), with a spot-check in the operator triage surface; or (b) explicitly note in §13 that source-authenticity validation is operator-manual for v1 and a candidate automation for a later phase. Don't leave it implicit.

---

### GAP-6 — Relationship-type coverage thinned in target (schema-level)
**What was dropped.** Source §Relationship Types enumerates 11 types: FILED, VOTED_FOR, VOTED_AGAINST, SUPPORTED, OPPOSED, TESTIFIED_IN, PARTICIPATED_IN, REFERENCED, RESULTED_IN, SUPPORTED_BY, REFUTED_BY. Target references relationships only by example (FR-2.2 mentions supports/refutes/contextualizes for evidence; addendum demo-targets table lists "FILED, VOTED_*, SUPPORTED, OPPOSED, TESTIFIED_IN, etc."). Several (PARTICIPATED_IN, REFERENCED, RESULTED_IN) are not named anywhere.

**Why it matters.** Low. Relationship types are schema detail that belongs in the TDD, and the target correctly defers schema to the TDD. The *capability* (typed relationships with temporal validity) is captured in FR-2.2 and the data-model summary. The only risk is that thin examples in the PRD cause the schema to be under-built, but that's a TDD concern.

**Severity: LOW.**

**Suggested fix.** None at PRD level. Confirm the TDD carries the full relationship-type enum from the source; optionally add a one-line note in addendum §Data model that the full set is sourced from the Enterprise PRD / TDD.

---

## Intentionally deferred — no action (confirmed conscious cuts are fine)

These source capabilities are absent from v1 but the target **explicitly defers them with rationale** in §5.2 and/or addendum §Deferred scope. No action needed; listed here to confirm the review checked them:

- **Narrative explorer / story generation** (Phase 2) — deferred, citation-bound-generation risk noted. ✓
- **Media framing comparison view** (Phase 2) — deferred, depends on stable multi-outlet corpus. ✓ *(Residual concern: named-outlet gap, see GAP-2, is compounded since media comparison is where outlets matter most.)*
- **Contradiction detection engine + severity scoring** (Phase 3) — deferred; v1 models support/refute split without labeling contradictions (OQ-3). ✓
- **AI debate simulator / AI witnesses / adversarial reasoning** (Phase 3) — deferred, generation-heavy, far from integrity core. ✓
- **Influence analytics — PageRank / betweenness / centrality** (Phase 3) — deferred, analytical value-add. ✓
- **Real-time / sub-minute streaming ingestion + breaking-news alerts** (Phase 4+) — deferred; v1 is scheduled/batch. ✓
- **Multi-tenant SaaS (billing, orgs, quotas, RBAC, SSO)** — deferred; v1 internally operated. ✓
- **Predictive features (vote/sentiment forecasting)** — excluded; product is evidentiary not predictive. ✓
- **Multi-case (second seed case)** — deferred; v1 single-case, architecture supports multi-case. ✓ *(Connective vision covered by GAP-1.)*
- **Human editorial owner with sign-off authority** — deferred as explicit launch gate (RK-8, OQ-6), not skipped. ✓

---

## Notes on things the target does *better* than the source (not gaps, for balance)

- **Editorial integrity invariants** (EI-1…EI-6, §6) are far more concrete and enforceable than the source's bare "evidence-backed" claim. Strengthening, not weakening.
- **Personas** (P-1…P-5) are explicit and prioritized; the source has no persona section. The "senators are subjects, not users" reframe (§4.2) is sharper than the source's "Senator Dashboard" user feature.
- **Counter-metrics** (CM-1 over-silence, CM-2 latency-via-integrity-bypass) are a discipline the source lacks.
- **Demo/presentation readiness as a first-class requirement** (§11, DR-1…DR-4) is absent from the source and essential for an internal-first build whose purpose is to be presented.
- **Lawful-access gate, conservative merge, substring validation, deterministic projection** are all operationalized in the target where the source only names the capability.

The target is a *stronger engineering/integrity document* than the source. The gaps above are about *vision, positioning, and market identity* — the things an internal-first PRD still owes its future-self when it goes external.
