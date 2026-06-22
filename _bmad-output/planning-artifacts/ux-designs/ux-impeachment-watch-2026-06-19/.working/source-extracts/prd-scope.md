# Source Extract — PRD Scope & Features

> Source: `prds/prd-impeachment-watch-2026-06-19/prd.md` + `addendum.md` + reconciles
> Extracted: 2026-06-19 by subagent

## 1. Product one-liner

The **Impeachment Intelligence Platform (IIP)** turns scattered Philippine impeachment material (transcripts, court records, filings, press releases, media coverage) into a single **explainable, evidence-backed knowledge graph** queryable in natural language, where every factual assertion carries a citation or is not returned at all.

> "The **Impeachment Intelligence Platform (IIP)** turns scattered Philippine impeachment material — hearing transcripts, court records, official filings, press releases, and media coverage — into one **explainable, evidence-backed knowledge graph** queryable in natural language, where every factual assertion carries a citation or is not returned at all." — `prd.md §2`

---

## 2. Target users / personas

Two layers: v1 is operated internally and presented externally.

**v1 operator (who runs it now):**
- **P-1 Intake Operator (build team)** — *v1 primary operator*
  > "Role: the small internal team that runs the platform during the internal-first period. Motivation: keep the corpus fresh, extraction clean, and integrity intact; surface and fix failures fast." — `addendum.md §Personas`

**Future users (presentation targets), in priority order:**

1. **P-2 Investigative Journalist** — *future-user, presentation priority 1*
   > "Role: reporter at a Philippine broadsheet or digital outlet. Motivation: fast, sourced, verifiable answers and evidence trails they can cite in their own work; they will re-check every quote." — `addendum.md §Personas`

2. **P-3 Researcher / Academic** — *future-user, presentation priority 2*
   > "Role: political science, law, or public administration researcher. Motivation: navigable structure, timelines, entity relationships for analysis and publication." — `addendum.md §Personas`

3. **P-4 Legal / Civil-Society Analyst** — *future-user, presentation priority 3*
   > "Role: advocacy, litigation-support, or public-interest analyst. Motivation: claim-vs-evidence mapping; framing differences; defensible sourcing." — `addendum.md §Personas`

4. **P-5 Engaged Citizen** — *future-user, secondary*
   > "Role: informed member of the public. Motivation: plain-language, cited answers. Note: lower tolerance for nuance, but the integrity bar does not drop for this audience." — `addendum.md §Personas`

Notable boundary:
> "Senators and their staff are *subjects* of the intelligence, not the primary user base for v1. Senator dashboards exist to *navigate* them as entities, not to serve them as a customer segment yet." — `prd.md §4.2`

Named persona "Maya Reyes" appears in the demo journey:
> "**Maya Reyes**, investigative reporter at a Philippine broadsheet." — `prd.md §7.2`

---

## 3. Primary jobs-to-be-done

Ranked from PRD's stated priority and journeys.

1. **Investigate a specific claim — trace who alleged what, by whom, with what evidence.** (Journalist; the demo story)
   > Maya asks: *"What allegations have been made about [X], and who made them?"* — `prd.md §7.2`

2. **Get fast, sourced, verifiable answers and evidence trails citeable in their own work.** (Journalist)
   > "need fast, sourced answers and evidence trails they can verify and cite in their own work. Trust the *provenance* more than the *opinion*." — `prd.md §4.2`

3. **Navigate structure, timelines, and entity relationships for analysis and publication.** (Researcher)
   > "need navigable structure, timelines, and entity relationships for analysis and publication." — `prd.md §4.2`

4. **Map claims against evidence and compare framing for advocacy/litigation support.** (Legal/Civil-Society)
   > "need claim-vs-evidence mapping and framing comparison to support advocacy, litigation support, or public-interest work." — `prd.md §4.2`

5. **Get plain-language, cited answers.** (Engaged citizen)
   > "need plain-language, cited answers; lower fidelity tolerance for nuance, but the integrity bar does not drop for them." — `prd.md §4.2`

6. **Operate ingestion: register/monitor sources, triage extraction quality, watch integrity.** (Intake Operator)

7. **Spot-check extraction integrity** — confirm citations resolve, no allegation tagged as fact.

8. **Trust the refusal to invent.** (Cross-cutting emotional job)
   > She asks an adversarial question the corpus can't support. The platform responds: **"No sourced answer found."** — and Maya's trust goes **up**, not down, because it refused to invent. — `prd.md §7.2`

---

## 4. Feature inventory

Grouped by theme. MVP = v1 (Phase 0 + Phase 1 core); Future = Phase 2/3/4+.

### Ingestion & provenance (operator-facing) — MVP
- Source registry (by type + crawl strategy + trust tier) — FR-1.1
- Lawful-access gate (paywall/login/CAPTCHA/robots respect; disable-not-bypass) — FR-1.2
- Discover, fetch, clean HTML/PDF to text — FR-1.3
- Content-checksum deduplication — FR-1.3
- Immutable raw snapshots — FR-1.4
- Per-artifact provenance (source doc + character span) — FR-1.5
- Idempotent, observable, resilient ingestion (retry, dead-letter queue) — FR-1.6
- Operator triage surface (failed/dead-lettered jobs, reprocess, spot-check) — FR-1.7

### Extraction & knowledge graph (operator-facing) — MVP
- Schema-validated, versioned extraction (entities, relationships, claims, evidence) — FR-2.1
- Substring-validation of quotes at extraction time (drops hallucinations, counted) — FR-2.1
- Claim & evidence modeling (type, stance, verification status) — FR-2.2
- Active extraction of supports/refutes/contextualizes evidence (with recall floor) — FR-2.2
- Conservative entity resolution (normalized-key → fuzzy → disambiguation; don't-merge-when-unsure) — FR-2.3
- Deterministic, rebuildable graph projection from canonical relational data — FR-2.4
- Fact-vs-claim tagging (100% of served assertions) + source-verb preservation — FR-2.5

### Investigative query & evidence (consumer-facing) — MVP
- Natural-language Q&A with citation-or-silence (no uncited-answer path) — FR-3.1
- Anti-hallucination substring gate at extraction and serving — FR-3.2
- Intent-aware retrieval (factual lookup, entity listing, evidence-for-claim, timeline, comparison) — FR-3.3
- Evidence explorer with honest support/refute/contextualize split + one-sided empty-state — FR-3.4
- Interactive graph explorer (one-hop expansion, type filters, capped rendering) — FR-3.5

### Temporal & entity views (consumer-facing) — MVP
- Timeline explorer (day/week/month/year; date-precision preserved) — FR-4.1
- Senator / entity dashboard — **early/lightweight v1 read-model** (statements, votes, participation, personal timeline; full version deferred to Phase 2) — FR-4.2

### Editorial integrity surface (cross-cutting) — MVP
- Inline clickable citation rendering — FR-5.1
- Visual distinction of attributed claims vs. established facts — FR-5.2
- Explicit "No sourced answer found" empty-state — FR-5.3
- Honest non-claims (no "verified"/"confirmed"/"true"/"no contradiction" labels) — FR-5.4
- Pre-External Presentation Gate (editorial + legal sign-off, recorded) — FR-5.5
- Citation-quality display (trust tier visible; low-tier/single-source markers) — FR-5.6
- Retraction/correction hook (supersession recorded, affected answers flagged) — FR-5.7

### Demo & presentation readiness — MVP
- Demo corpus across all v1 surfaces — DR-1
- Adversarial demo script (includes unanswerable questions) — DR-2
- Provenance-on-demand drill-down (assertion → citation → evidence → raw source) — DR-3
- Honest framing (state deferred features plainly) — DR-4
- Pre-External Gate execution record — DR-5
- Live retraction scenario demo — DR-6

### Future / deferred (not MVP)
- Narrative explorer / story generation (Phase 2)
- Media framing comparison view (Phase 2)
- Contradiction detection engine + severity scoring (Phase 3)
- AI debate simulator / AI witnesses / adversarial-reasoning (Phase 3)
- Influence analytics (PageRank, betweenness, centrality) (Phase 3)
- Real-time sub-minute streaming ingestion (Phase 4+)
- Multi-tenant SaaS (billing, orgs, quotas, RBAC, SSO)
- Authoring/publishing political opinion
- Predictive features (vote/sentiment forecasting)
- Full senator dashboard (Phase 2)

---

## 5. Surfaces / screens implied

1. **Natural-language Q&A / chat surface** (FR-3.1, §7.2 step 1)
2. **Evidence explorer** — claim + supporting/refuting/contextualizing docs + passage links (FR-3.4, §7.2 step 3)
3. **Graph explorer** — entity neighborhoods, relationship expansion, type filters (FR-3.5, §7.2 step 4)
4. **Timeline explorer** — dated events at multiple granularities (FR-4.1, §7.2 step 5)
5. **Senator / entity dashboard (early/lightweight)** — statements, votes, participation, personal timeline (FR-4.2)
6. **Citation chip / citation drill-down view** — links to source passage (FR-5.1, §7.2 step 3)
7. **Source passage / raw source view** — the destination of provenance drill-down (DR-3)
8. **"No sourced answer found" empty-state** (FR-5.3)
9. **Operator: source registry** (FR-1.1, §7.1 step 1)
10. **Operator: ingestion dashboard / monitoring** — successes, failures, dead-letter queue, throughput (FR-1.6, FR-1.7, §7.1 step 5)
11. **Operator: extraction-quality spot-check surface** — verify citations resolve, no allegation-as-fact (FR-1.7, §7.1 step 6)
12. **Operator: dead-letter / failed-job triage surface** (FR-1.7)
13. **Pre-External Gate review surface** — demo corpus + answer samples for editorial/legal sign-off (FR-5.5)
14. **Retraction/correction display** — supersession flags on affected answers (FR-5.7, DR-6)

Implied REST endpoints (from addendum API surface summary, design-agnostic):
> "`POST /query`, `GET /entities`, `GET /entities/:id`, `GET /graph/neighbors/:id`, `GET /timeline`, `GET /evidence/:id`, `GET /senators/:id/dashboard`, `GET /documents/:id`, `GET /health`" — `addendum.md §Tech decisions`

---

## 6. Content model hints

**Document/source types:**
- Sources (government, court, media, press release, transcript) with trust tiers (1 primary → 3 aggregator)
- Documents (HTML/PDF cleaned to text) with `content_checksum`
- Document chunks with embeddings
- Immutable raw snapshots (stored in MinIO, off serving path)
- Ingestion jobs (idempotent, with state)

**Entity types (graph nodes):**
- Persons (e.g., senators, VP)
- Organizations
- Events
- Documents
- Claims
- Evidence
> "Entities | **≥1,500** | persons, orgs, events, documents, claims, evidence" — `addendum.md §Demo targets`

**Relationship types (graph edges):**
> "Relationships | **≥3,000** | typed (FILED, VOTED_*, SUPPORTED, OPPOSED, TESTIFIED_IN, etc.)" — `addendum.md §Demo targets`
- Also mentioned: FILED, TESTIFIED_IN, OPPOSED (§7.2 step 4)
- Relationships carry temporal `valid_from`/`valid_to` + `evidence_quote`

**Claim/evidence model:**
- Claim type: allegation, counterclaim, denial, factual assertion
- Claim stance: pro / anti / neutral
- Claim verification status
- Evidence relations: supports / refutes / contextualizes
- Claim ↔ Evidence (via `claim_evidence`)

**Timeline events:** dated, with date precision recorded (e.g., "March 2026" not shown as "March 1, 2026")

**Provenance on every artifact:** source document + character span

**Retraction/supersession records** against stored snapshots

**Extracted quote substring** — mechanically validated against source chunk

**Citation-quality metadata:** trust tier visible; single-source/low-tier markers for named persons

---

## 7. Constraints / non-functional requirements (UX-relevant)

**Editorial integrity (binding, non-negotiable):**
- **EI-1 Citation-or-silence:** every served factual assertion must carry ≥1 citation or not be returned. No uncited-answer path.
- **EI-2 Fact vs. attributed claim:** every served assertion tagged fact or attributed claim; visually marked; fact = tier-1 primary OR ≥2 independent sources. "An allegation stated as fact is a **P0 defect, equal in severity to a crash.**" Tag applied to 100% of served assertions (hard gate before serving).
- **EI-3 Source-verb preservation:** verbs with legal/epistemic weight ("alleged," "testified," "voted," "denied," "claimed") preserved verbatim, never paraphrased stronger/weaker.
- **EI-4 Provenance everywhere:** every entity/relationship/claim/evidence traces to raw snapshot + character span.
- **EI-5 Conservative merge:** when unsure, do not merge (duplicate = cosmetic; wrong merge = corrupting).
- **EI-6 Anti-hallucination backstop:** substring validation at extraction AND serving; drops counted.
- **EI-7 Honest evidence split:** surface supporting AND refuting/contextualizing together; explicit one-sided empty-state, never silently empty.
- **EI-8 Citation-quality floor:** lone tier-3 allegation about a named person not served as established; low-tier/single-source markers shown.

**Performance:**
- Query latency p95 < 10s; p50 < 3s goal — NFR-P-1
- Graph neighborhood queries bounded by hop/count caps — NFR-P-3
- "Latency is never bought by dropping the citation gate or skipping the substring validation." — CM-2

**Local-first / deployment (binding constraint):**
> "The full stack runs on **a single workstation** with no proprietary cloud dependency required. `[ASSUMPTION]` This is a binding v1 constraint, not a preference" — NFR-D-1
- Local models default; cloud optional/pluggable — NFR-D-2
- Fully open-source stack — NFR-D-3
- v1 is single-node best-effort with graceful degradation — NFR-R-1

**Security & access:**
- v1 API is **read-only public**; no user write endpoints; ingestion internal-only — NFR-S-1
- Per-IP rate limiting (429 with Retry-After); payload-size caps — NFR-S-3
- No end-user accounts / RBAC / SSO in v1 (multi-tenant SaaS deferred)

**Legal/ethical (binding):**
- Ingest only public, lawfully accessible material; respect robots/terms; disable-not-bypass — NFR-L-1
- Philippine Data Privacy Act (RA 10173) posture: public-figure/public-capacity data only; formal compliance review open item — NFR-L-2
- **Cyberlibel/republication-aware (RA 10175 §4(c)(4), *Disini*):** surfacing a defamatory allegation can carry liability; mandatory legal review before any external presentation — NFR-L-3
- Retraction/correction handling: supersession recorded, affected answers flagged — NFR-L-5 / FR-5.7

**Language:**
- English primary; Filipino (`fil`) only if its eval fixture passes the same integrity gates — OQ-9
> "Languages covered | en (+ fil only if its eval fixture passes the integrity gates) | OQ-9" — `addendum.md §Demo targets`

**Neutrality / no-oversell mandate:**
- No verification claims ("verified," "confirmed," "true") — FR-5.4, §6.3
- No implication that absence of contradiction means consistency — §6.3
- No authoring/publishing political opinion; no predictive features — §5.2
- Demo must state what v1 does NOT do as clearly as what it does — DR-4

**Reproducibility/auditability:**
- Every served fact traces to stored raw snapshot + span — NFR-A-1
- Re-extraction and graph rebuild deterministic and versioned — NFR-A-2
- Idempotent upsert semantics — NFR-A-3

**Accessibility:** No explicit accessibility NFR is stated in either document. (Open gap — see §8.)

---

## 8. Open UX questions

1. **Visual language for fact vs. attributed claim.** EI-2/FR-5.2 require claims to be "visually marked" but no specific visual treatment is specified.
2. **Visual treatment of trust tiers / citation quality.** FR-5.6/EI-8 require trust tier to be "visible" but the exact affordance is undefined.
3. **Source-verb preservation surfacing.** EI-3 requires verbs preserved verbatim, but how the verb is visually emphasized is unspecified.
4. **Evidence explorer one-sided empty-state copy.** §6.3 gives explicit copy but broader interaction (tabs vs. columns vs. accordion) is unspecified.
5. **"No sourced answer found" experience.** Full UX (tone, suggested next steps, alternative queries) undefined.
6. **Graph explorer interaction model.** Layout, node sizing, edge styling, label truncation, "capped" behavior, mobile/large-graph fallbacks unspecified.
7. **Timeline explorer granularity UX.** How users switch granularity, how imprecise dates are displayed is undefined.
8. **Senator / entity dashboard scope for v1.** What exactly is "lightweight" vs. full Phase-2 dashboard is unresolved.
9. **Adversarial demo UX.** How the platform presents "I don't know" in a way that *earns* trust is a UX design problem.
10. **Multi-language UI posture.** Whether the UI itself is bilingual, whether answers may mix `en`/`fil` is undefined.
11. **Accessibility.** No WCAG, screen-reader, keyboard, or contrast NFRs appear.
12. **Mobile / responsive posture.** No explicit mobile NFR; device class is ambiguous.
13. **Provenance drill-down depth and breadcrumb.** Navigation pattern (modal stack, side panel, full-page) is unspecified.
14. **Operator dashboard layout.** Whether ingestion monitoring, dead-letter triage, and extraction spot-check are one console or separate is undefined.
15. **Pre-External Gate review UX.** Review tooling (side-by-side approve/reject, annotation, export) not specified.
16. **Retraction display.** How a retracted assertion is visually presented is undefined.
17. **Audience-tailoring for the "engaged citizen."** Whether v1 offers a simplified view tier is unresolved.
18. **Single-case framing.** v1 is single-case (Sara Duterte). Whether the UI surfaces case selection at all is unspecified.