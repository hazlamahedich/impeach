---
title: 'Sprint Change Proposal — IIP Pre-Implementation Course Correction'
project: impeachment-watch
date: 2026-06-19
author: anti lustay
scope_classification: Major
triggered_by: 'BMad Research Streams (Domain, Technical, Market) + Perplexity Follow-up'
status: 'Awaiting Approval'
input_artifacts:
  - Enterprise_PRD_Impeachment_Intelligence_Platform.md (source PRD)
  - IIP_Technical_Design_Document.docx (source TDD)
  - 17 research documents in _bmad-output/planning-artifacts/research/
output_actions:
  - 'Update source PRD with 7 amendments'
  - 'Update source TDD with 17 amendments'
  - 'Create formal BMad PRD via /bmad-prd'
  - 'Create formal BMad Architecture via /bmad-create-architecture'
  - 'Create Epics & Stories via /bmad-create-epics-and-stories'
  - 'Begin Omidyar/Luminate grant application'
  - 'Time-critical: soft-launch prep for July 6, 2026 trial'
---

# Sprint Change Proposal — IIP Pre-Implementation Course Correction

**Date:** 2026-06-19
**Author:** anti lustay
**Project:** Impeachment Watch (IIP)
**Scope:** Major
**Mode:** Batch

---

## Section 1: Issue Summary

### 1.1 Triggering Event

Three BMad research streams (Domain, Technical, Market) plus a Perplexity follow-up pass produced **17 research documents (~410KB)** with **28+ specific findings** that diverge from the source PRD (`Enterprise_PRD_Impeachment_Intelligence_Platform.md`) and source TDD (`IIP_Technical_Design_Document.docx`).

### 1.2 Core Problem

The source PRD and TDD were drafted **before** empirical domain, technical, and market validation. The research reveals:

- **2 critical technical blockers** (ingestion strategy, OCR pipeline) that would prevent the platform from acquiring its primary documents
- **5 critical compliance/risk gaps** (NPC Advisory 2026-01, libel exposure, citation engine absence, FOI scope, trial obstruction risk)
- **1 time-critical market window** (Sara Duterte 2nd impeachment trial starts **July 6, 2026** — 17 days from today)
- **17 specific TDD amendments** required before implementation can begin
- **12 specific PRD schema gaps** requiring domain-model revision

### 1.3 Evidence

Evidence is fully documented in:
- `research/domain-philippine-impeachment-intelligence-political-knowledge-graphs-research-2026-06-19.md` (master) + 4 companions
- `research/technical-iip-technology-stack-validation-research-2026-06-19.md` (master) + 5 companions
- `research/market-philippine-political-intelligence-civic-tech-2026-06-19.md` (master) + 3 companions
- `research/perplexity-followup-targeted-gaps-2026-06-19.md`

Each finding is confidence-flagged (🟢/🟡/🔴) with inline source citations.

---

## Section 2: Impact Analysis

### 2.1 PRD Impact

The source PRD (`Enterprise_PRD_Impeachment_Intelligence_Platform.md`, 328 lines) requires the following:

| # | PRD Area | Current State | Required Change | Severity |
|---|---|---|---|---|
| **P1** | Domain model (§Graph Data Model) | 6 node types (Person/Org/Event/Document/Claim/Evidence) + 11 relationship types | Adopt **Popolo standard** (add Membership, Motion, VoteEvent, Vote, Speech, Area); add IBIS Issue node; reify SUPPORTED_BY/REFUTED_BY as AIF RA/CA nodes | 🟥 Critical |
| **P2** | Document schema (§Database Design) | 4 tables (documents/entities/relationships/ingestion_jobs) | Expand per ECLI mandatory metadata (creator, accessRights, language, doc-type, jurisdiction, references); add provenance layer (PROV-O); add ClaimReview schema for fact-check verdicts | 🟥 Critical |
| **P3** | Sources strategy (§Data Sources, §Ingestion Pipeline) | Single Firecrawl-based pipeline | **5-tier ingestion architecture**: (1) Firecrawl for scrapable, (2) Crawlee+stealth+residential proxy for WAF'd, (3) Alaveteli for FOI, (4) Manual upload UI, (5) Partnership/licensed | 🟥 Critical |
| **P4** | Compliance (absent from PRD) | Not mentioned | Add NPC Advisory 2026-01 compliance (mandatory PIA, lawful basis, data subject rights workflow); add libel risk mitigation (citation-or-silence as product invariant); add DPO requirement | 🟥 Critical |
| **P5** | Success metrics (§Success Metrics) | Query accuracy >90%, Citation coverage 100%, Graph extraction accuracy >85%, Response time <10s | Add: **Citation-fidelity rate** (% of claims passing NLI entailment); **Citation-or-silence compliance** (binary gate); **Libel red-team pass rate** | 🟧 High |
| **P6** | MVP scope (§MVP Roadmap) | Phase 1: Firecrawl ingestion, Entity extraction, Graphify integration, NL chat, Timeline | **Reorder Phase 1:** (1) Tier 1+2 ingestion + OCR pipeline FIRST, (2) domain-adapted extraction (Qwen3 + custom corpus) SECOND, (3) citation engine + eval harness THIRD, (4) NL Q&A + Timeline LAST. Pre-launch PIA is gate. | 🟥 Critical |
| **P7** | Business model (absent from PRD) | Not mentioned | Add: Nonprofit parent + LLC subsidiary structure; cross-subsidy model; pricing tiers (Free/Pro/Enterprise/Institutional); funding roadmap (Omidyar/Luminate priority) | 🟧 High |

### 2.2 TDD Impact

The source TDD (`IIP_Technical_Design_Document.docx`, 1166 paragraphs, 18 sections) requires **17 specific amendments** (originally 11 from Technical Research + 6 added from Perplexity follow-up):

| # | TDD Area | Current State | Required Change | Severity |
|---|---|---|---|---|
| **T1** | §3 Tech Stack (PostgreSQL + AGE rationale) | Implies "PG17+ adds SQL:PGQ" as future alternative | **Strike** — SQL:PGQ has NOT landed in PG17 or PG18 (verified). Pin AGE ≥1.7.0 + PG16/18. Explicitly exclude Neo4j Community (AGPL + Commons Clause) | 🟨 Medium |
| **T2** | §3 Tech Stack (Crawler) | "Firecrawl (self-hosted)" as sole crawler | **Replace** with 5-tier ingestion architecture. Self-hosted Firecrawl is Tier 1 only (cannot handle Senate/House/SC/COA — verified per Firecrawl docs). Add Crawlee v3.17 + stealth + BrightData PH residential proxy for Tier 2 | 🟥 Critical |
| **T3** | §5 Data Layer (OCR) | Not specified | **Add OCR pipeline**: Docling (default) + PaddleOCR-VL-1.6 (tables/stamps) + Tesseract (fallback). >80% of PH primary docs are scanned images | 🟥 Critical |
| **T4** | §3 Tech Stack (LLM) | Qwen2.5-14B-Instruct / Llama-3.1-8B-Instruct | **Upgrade** to Qwen3-14B (primary) + Qwen3-30B-A3B (bulk). ⚠️ Qwen3 Filipino support is *claimed* but **unverified by any published benchmark** — budget for empirical validation + domain adaptation | 🟧 High |
| **T5** | §3 Tech Stack (Structured output) | Implicit JSON-mode + prompt | **Add XGrammar-constrained decoding** via vLLM (or Ollama native `format`). Guarantees 100% structural validity | 🟧 High |
| **T6** | §3 Tech Stack (Embeddings) | bge-m3 OR nomic-embed-text | **Drop nomic** (768-dim mismatch with 1024-dim requirement). Keep bge-m3 only. Add domain-adaptation fine-tune on PH legal pairs | 🟧 High |
| **T7** | §3 Tech Stack (Orchestration) | LangGraph.js | **Keep** — validated as correct choice for 7-agent stateful graph + HITL. Add Inngest as outer durable envelope | ✅ Confirmed |
| **T8** | §6 Domain Model (KG construction) | Not specified | **Port LightRAG algorithm to TypeScript** on AGE + pgvector (~1-2k LOC). Use GLiNER + RelEx (Apache-2.0) for schema-constrained extraction as primary path | 🟧 High |
| **T9** | §10 Retrieval (Fusion) | Hybrid (graph + vector) | Specify: **3-way RRF fusion** (pgvector ANN + AGE Cypher + BM25/paradedb). Add CRAG correction node (arXiv 2401.15884). Expose HippoRAG multi-hop as Query Planner tool | 🟧 High |
| **T10** | §10 Retrieval (Citation engine) | Not specified (only invariant stated) | **Add Anthropic Citations API** (custom-content blocks) + **NLI verification gate** (DeBERTa-v3-mnli-fever ≥0.6) + LLM self-verification. Sub-document span registry with Akoma Ntoso fragment URIs | 🟥 Critical |
| **T11** | §15 Testing (Eval harness) | "Eval harness" mentioned but unspecified | Specify: **DeepEval** (test runner) + **RAGAS** (metrics) + **Phoenix** (observability) + **Promptfoo/Inspect AI** (red-teaming). IIP-specific metrics: citation-fidelity rate, citation-or-silence compliance, libel red-team | 🟧 High |
| **T12** | §14 Frontend (Graph viz) | Cytoscape.js + React Flow | **Add tiered rendering**: Sigma.js + graphology for 5K-100K nodes; Cosmograph (WebGPU) for >100K/full-corpus. Cytoscape + React Flow insufficient at scale | 🟧 High |
| **T13** | §9 AGE Operations | Not mentioned | Add: AGE has no algorithm library (PageRank, betweenness). Add Kùzu (MIT) or networkx as batch companion. Operational note: `create_graph`/`create_vlabel` need explicit COMMIT in non-autocommit clients | 🟨 Medium |
| **T14** | §7 Ingestion (FOI/Manual track) | Not specified | Add Tiers 3-5: Alaveteli fork (FOI lifecycle) + DocumentCloud-style attachment storage + Manual upload UI with two-person review for sensitive docs | 🟥 Critical |
| **T15** ⚠️ NEW | §13 Cross-Cutting (Compliance) | Not specified | Add **NPC Advisory 2026-01 compliance**: PIA mandatory for all scraping; lawful basis (legitimate interest, Sec. 13[b] DPA) with documented balancing test; data subject rights workflow; privacy notice publication | 🟥 Critical |
| **T16** ⚠️ NEW | §8 Extraction (PH legal corpus) | Not specified | Add **Phase 0 workstream**: curate 0.5-1.5M tokens of PH legal-political text; label 10-20K sentences; budget ₱2-5M for annotation (or UP NCPAG/Arellano partnership). No "Philippine LegalBERT" exists — must build | 🟧 High |
| **T17** ⚠️ NEW | §17 Risks (Political) | Not specified | Add **trial obstruction scenario modeling**: ⚠️ **THREE Senate Presidents in 6 weeks** (Sotto → Cayetano [May 11] → **Gatchalian [June 17, 2026]**). Track presiding-officer Gatchalian's procedural rulings; SC intervention scenarios; Estrada-2001 "trial aborted" contingency. **Pre-trial conference held June 18, 2026 under Gatchalian.** | 🟥 Critical |

### 2.3 Future Epics Impact (pre-implementation)

Since no formal Epics exist yet, this proposal recommends **net-new epic structure** rather than modifications. The research suggests the following epic breakdown (to be formalized via `/bmad-create-epics-and-stories`):

| Proposed Epic | Source Research | Priority |
|---|---|---|
| **Epic 0: Foundation & Compliance** | PIA, DPO appointment, privacy notice, Omidyar grant app, partnership MOUs (PCIJ/VERA/foi.gov.ph) | 🟥 P0 — Gate |
| **Epic 1: Ingestion Tier 1 + Manual Upload + OCR** | T2 (Tier-1 Firecrawl only), T3 — Firecrawl for scrapable sources + manual upload UI for blocked government/media sources; Docling+PaddleOCR pipeline; MinIO raw + Postgres cleaned | 🟥 P0 |
| **Epic 2: Domain-Adapted Extraction** | T4, T5, T16 — Qwen3-14B + XGrammar; PH legal corpus curation; GLiNER fine-tune; hybrid local+cloud routing | 🟥 P0 |
| **Epic 3: Knowledge Graph Construction** | T8, P1 — LightRAG-algorithm port to TS; Popolo entity model; AIF reified relations; AGE projection | 🟧 P1 |
| **Epic 4: Citation Engine & Eval Harness** | T10, T11, P5 — Anthropic Citations + NLI gate + AKN URIs; DeepEval+RAGAS+Phoenix; libel red-team | 🟥 P0 — Gate |
| **Epic 5: Hybrid Retrieval & NL Q&A** | T9 — RRF fusion + CRAG correction + HippoRAG multi-hop; intent detection; answer generation | 🟧 P1 |
| **Epic 6: Senator Dashboard + Timeline** | PRD §User Features — derived read models; Popolo VoteEvent/Vote/Speech | 🟧 P1 |
| **Epic 7: Frontend Graph Explorer (tiered)** | T12 — Cytoscape + React Flow + Sigma.js + Cosmograph; argument visualization (AIF/IBIS) | 🟨 P2 |
| **Epic 8: FOI/Partnership Ingestion + Tier-2 Stealth Crawl Spike** | T14, P3, T2 — Alaveteli fork (v1.x); SFTP partnership drops (v1.x); **Crawlee+stealth+residential proxy spike deferred to post-v1** pending legal review | 🟨 P2 |
| **Epic 9: Sara Duterte Trial Coverage** | Time-critical — pre-ingest 4 complaints + SC ruling + senator-judge records; live trial dashboard | 🟥 P0 — Time-boxed |

### 2.4 Artifact Conflict Summary

| Artifact | Conflict Level | Action |
|---|---|---|
| Source PRD (`Enterprise_PRD_...md`) | **Major** | 7 amendments (P1-P7); recommend formal BMad PRD creation via `/bmad-prd` |
| Source TDD (`IIP_Technical_Design_Document.docx`) | **Major** | 17 amendments (T1-T17); recommend formal BMad Architecture creation via `/bmad-create-architecture` |
| Formal BMad PRD | **Does not exist** | Create via `/bmad-prd` using source PRD + research as input |
| Formal BMad Architecture | **Does not exist** | Create via `/bmad-create-architecture` using source TDD + research as input |
| Epics & Stories | **Does not exist** | Create via `/bmad-create-epics-and-stories` |
| UX Design | **Does not exist** | Consider `/bmad-ux` after Architecture (PRD proposes substantial UI) |

---

## Section 3: Recommended Approach

### 3.1 Selected Path: **Major — Fundamental Replan**

Per Section 4.3 of the checklist, this is **Option 3 (PRD MVP Review)** combined with **Option 1 (Direct Adjustment)**:

- **Option 3 elements:** MVP scope must be reordered (PIA gate first; ingestion+OCR second; extraction third; citation+eval FOURTH before any NL Q&A). Original MVP roadmap is no longer viable as written.
- **Option 1 elements:** Within the new structure, the TDD's locked stack (PostgreSQL+AGE, LangGraph.js, Next.js, Cytoscape) is largely retained — amendments are surgical, not wholesale rewrites.

**Rejected alternatives:**
- Pure Direct Adjustment (Option 1 only) — insufficient; MVP roadmap is fundamentally misordered
- Rollback (Option 2) — N/A; no implementation work to roll back
- Restart from scratch — wasteful; source PRD/TDD are ~80% sound

### 3.2 Justification

The research validates the **spirit** of the source PRD/TDD (FOSS, local-first, citation-grounded, knowledge-graph-centric) but reveals that **execution details** require significant revision. The cost of replanning now (pre-implementation) is far lower than the cost of discovering these issues mid-sprint.

The platform's **strategic positioning** is unchanged: "vertical civic-tech for PH constitutional/law-political events" remains whitespace with no direct competitor.

### 3.3 Effort Estimate

| Workstream | Effort | Timeline |
|---|---|---|
| Update source PRD (P1-P7) | Medium | 1-2 days |
| Update source TDD (T1-T17) | Medium-High | 3-5 days |
| Create formal BMad PRD via `/bmad-prd` | Medium | 1-2 days |
| Create formal BMad Architecture via `/bmad-create-architecture` | High | 3-5 days |
| Create Epics & Stories via `/bmad-create-epics-and-stories` | Medium | 1-2 days |
| **Soft-launch prep for July 6 trial** (parallel) | High | **17 days (hard deadline)** |
| Omidyar/Luminate grant application (parallel) | Medium | 8-12 weeks |
| **Total planning-track effort** | ~2-3 weeks | |
| **Total implementation effort (all 9 epics)** | 6-9 months | 4-6 engineers |

### 3.4 Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| July 6 trial date slips or trial is aborted | 🟧 High | Maintain coverage regardless; expand to SC/Senate/budget content in Q1 2027 |
| Qwen3 Filipino performance materially below expectation | 🟧 High | Domain adaptation budget (₱2-5M); symbolic augmentation (gazetteers); hybrid local+cloud from day 1 |
| NPC Advisory 2026-01 enforcement action against IIP | 🟧 High | Commission PIA before any scraping begins; PH privacy counsel on retainer |
| Tier 1 ingestion (Firecrawl) fails on a target news site | 🟧 High | Manual upload fallback + verify robots.txt / access notes |
| Tier 2 ingestion (Crawlee+stealth+residential proxy) fails on Senate Cloudflare | 🟧 High | **Deferred from v1**; Tier-4 manual upload is the fallback for blocked government sources |
| OCR pipeline (Docling+PaddleOCR) quality insufficient for scanned PH docs | 🟥 Critical | Fallback to human transcription or upstream partnership for critical docs |
| Partisan backlash damages B2B sales | 🟥 Critical | Strict neutrality standards; multi-stakeholder governance; transparent methodology |

---

## Section 4: Detailed Change Proposals

### 4.1 PRD Changes (P1-P7) — Source: `Enterprise_PRD_Impeachment_Intelligence_Platform.md`

#### P1 — Domain Model Revision (PRD §Graph Data Model)

**OLD:**
```
## Node Types
### Person, Organization, Event, Document, Claim, Evidence
## Relationship Types
FILED, VOTED_FOR, VOTED_AGAINST, SUPPORTED, OPPOSED, TESTIFIED_IN,
PARTICIPATED_IN, REFERENCED, RESULTED_IN, SUPPORTED_BY, REFUTED_BY
```

**NEW:**
```
## Node Types (Popolo-aligned + AIF-extended)
### Person (with Membership links to Org/Post/Party)
### Organization (classification: party/legislature/committee/govt-body)
### Membership (reified: Person ↔ Org with role, dates, party, district)
### Post (defined position, e.g. "Senator, 19th Congress")
### Motion (proposal put to vote — Articles of Impeachment = Motion)
### VoteEvent (roll-call or division, with result)
### Vote (individual: voter, option, group)
### Speech (text + speaker + start/end within Event)
### Event (hearing, filing, press conference)
### Area (OCD-ID geographic jurisdiction)
### Document (ECLI-metadata-rich: creator, accessRights, language, type, references)
### Issue (IBIS — what is contested)
### Claim (Toulmin anatomy: claim/ground/warrant/backing/qualifier/rebuttal)
### Evidence (Claim-with-source per PROV-O hadPrimarySource)
### ClaimReview (schema.org — for IFCN fact-check verdicts)
### Quotation (reified: wasQuotedFrom with source-doc + span + text)

## Relationship Types
### Political (Popolo): FILED, VOTED_FOR, VOTED_AGAINST, MEMBERSHIP, PARTICIPATED_IN
### Argument (AIF reified as RA-node/CA-node/PA-node):
  - SUPPORTS (RA-node with scheme + strength)
  - ATTACKS (CA-node with conflict type)
  - PREFERRED_OVER (PA-node for conflict resolution)
### Documentary: REFERENCES, CITES, AMENDS, REPEALS, QUOTED_IN
### Provenance (PROV-O): wasAttributedTo, wasGeneratedBy, wasDerivedFrom, hadPrimarySource
```

**Rationale:** Domain Research identified **12 concrete schema gaps** vs international standards (Popolo, AIF, Toulmin, PROV-O, ECLI, ClaimReview). PRD's flat 6-node model is insufficient for the analytical affordances promised (senator intelligence, contradiction detection, evidence mapping).

#### P2 — Document Schema Expansion (PRD §Database Design)

**OLD:**
```
### documents
- id, title, url, source, publish_date, content, checksum

### entities
- id, entity_type, name, metadata

### relationships
- id, source_entity, target_entity, relationship_type, confidence
```

**NEW:** (per ECLI mandatory metadata + ELI versioning)
```
### documents (ECLI-expanded)
- id, ecli_identifier (PH:SC:2026:123456), title, url, source_id,
  creator (author/org), access_rights, language, doc_type,
  jurisdiction, publish_date, retrieved_at, content, content_checksum,
  raw_object_key (MinIO), extraction_status, akn_uri (Akoma Ntoso),
  references (cited docs), created_at, updated_at

### sources (new — provenance + credibility)
- id, name, source_type, base_url, crawl_strategy, trust_tier,
  robots_respect, mbfc_factual, mbfc_bias, ifcn_certified,
  ownership_transparency, enabled, last_crawled_at

### entities (Popolo-typed)
- id, entity_type (person|org|membership|post|motion|vote_event|vote|speech|event|area|document_ref|issue|claim|evidence|claim_review|quotation),
  canonical_name, normalized_key, aliases, metadata (JSONB),
  wikidata_id (reconciliation), mention_count, confidence,
  valid_from, valid_to, created_at, updated_at

### relationships (AIF-reified)
- id, source_entity, target_entity, relationship_type,
  reified_as (RA-node|CA-node|PA-node|bare),
  scheme (expert|documentary|hearsay|witness-testimony),
  strength (NUMERIC 4,3), provenance (PROV-O attributes),
  created_at, updated_at

### claims (Toulmin anatomy)
- id, headline_assertion, ground (evidence pointer),
  warrant (legal rule invoked), backing (authority),
  rebuttal (counter-claim pointer), qualifier (confidence),
  proof_standard (impeachment|criminal|civil),
  created_at, updated_at

### provenance_events (PROV-O)
- id, activity_type, started_at, ended_at, agent,
  used_entity, generated_entity
```

**Rationale:** Source schema is too thin to support the analytical features promised. ECLI/ELI/PROV-O are international standards enabling citation interoperability.

#### P3 — Sources Strategy Revision (PRD §Data Sources, §Ingestion Pipeline)

**OLD:** Single Firecrawl pipeline: Sources → Firecrawl → Document Store → Entity Extraction → ...

**NEW:** 5-tier ingestion architecture:

```
Tier 1 (Scrapable): Self-hosted Firecrawl → news, blogs, Comelec, OSG, LGUs
Tier 2 (WAF'd): Crawlee v3.17 + Playwright + stealth + BrightData PH residential proxy
                → Senate, SC, COA, parts of House
Tier 3 (FOI): Forked Alaveteli (PH Commission-aware templates) + foi.gov.ph
              → SALN archives, special audits, anything not on website
Tier 4 (Manual): IIP upload UI with mandatory provenance form + two-person review
              → Leaked docs, partner-shared, paper scans
Tier 5 (Partnership): SFTP drop + license metadata per outlet
              → Inquirer/Star archives, PCIJ, VERA Files, Rappler

All tiers → OCR pipeline (Docling default, PaddleOCR-VL for tables/stamps)
         → MinIO raw (immutable, sha256-keyed) + Postgres cleaned markdown
         → Analyst extraction
```

**Rationale:** Self-hosted Firecrawl cannot reach the 4 most important sources (Senate, House, SC, COA) per Firecrawl's own docs (Fire-engine is cloud-only). >80% of PH primary docs are scanned images requiring OCR.

#### P4 — Compliance Section Addition (NEW PRD section)

**NEW section after §System Architecture:**
```
# Compliance & Risk

## Privacy (RA 10173 + NPC Advisory 2026-01)
- Lawful basis: Legitimate interest (Sec. 13[b] DPA) for transparency/accountability purpose
- Mandatory: Privacy Impact Assessment (PIA) BEFORE any scraping begins
- Data minimization: Scrape only name/position/asset fields; redact/pseudonymize family + witnesses
- Data subject rights workflow: access, objection, correction (UI + SLA)
- Privacy notice: Prominently published; explicit lawful basis + balancing test summary
- Breach notification: 72-hour NPC notification per NPC Circular 16-03
- DPO appointment required

## Libel Risk Mitigation (RPC Arts. 353-362, RA 10175 §4[c][4])
- Citation-or-silence invariant: Any factual assertion MUST carry ≥1 document-backed citation, or it is not returned
- Quote, don't paraphrase, defamatory imputations
- Preserve "alleged" framing for unproven charges
- Anchor every claim to a primary-source document via sub-document span (Akoma Ntoso URI)
- NLI verification gate: Claim-without-entailment ⇒ suppress
- PH counsel on retainer for ongoing review
```

**Rationale:** NPC Advisory 2026-01 (April 13, 2026) is brand-new binding regulation. *People v. Santos/Ressa/Rappler* (2020) cyberlibel precedent creates real exposure for AI platforms that surface allegations. These are product requirements, not afterthoughts.

#### P5 — Success Metrics Expansion (PRD §Success Metrics)

**OLD:**
```
- Query accuracy > 90%
- Citation coverage 100%
- Graph extraction accuracy > 85%
- Average response time < 10 seconds
```

**NEW:**
```
- Query accuracy > 90%
- Citation coverage 100%
- Graph extraction accuracy > 85%
- Average response time < 10 seconds
- Citation-fidelity rate > 90% (% of claims passing NLI entailment vs cited span)
- Citation-or-silence compliance = 100% (binary gate; any violation is P0 defect)
- Libel red-team pass rate > 95% (Promptfoo + Inspect AI adversarial suite)
- Domain-adapted extraction F1 > 0.80 on held-out PH legal-political test set
```

**Rationale:** Original metrics don't capture the libel-risk dimensions. Citation-fidelity and citation-or-silence are machine-enforceable gates.

#### P6 — MVP Roadmap Reorder (PRD §MVP Roadmap)

**OLD Phase 1:** Firecrawl ingestion → Entity extraction → Graphify integration → NL chat → Timeline

**NEW Phase 0 (GATE — must complete before any ingestion):**
- Commission PIA per NPC Advisory 2026-01
- DPO appointment
- Privacy notice publication
- Omidyar/Luminate grant application submitted
- Anchor media partner MOU (PCIJ > VERA > Rappler)

**NEW Phase 1:**
- Tier 1 ingestion (Firecrawl for scrapable sources: Official Gazette, GMA, Rappler, Reuters, Lawphil)
- **Tier 4 manual upload UI for blocked government/media sources** (House, Senate, SC, PNA, ABS-CBN)
- OCR pipeline (Docling + PaddleOCR-VL on real SALN/impeachment PDFs)
- Domain-adapted extraction spike (Qwen3-14B + XGrammar on PH legal-political text)
- Citation engine spike (Anthropic Citations + NLI gate)
- Eval harness baseline (DeepEval + RAGAS on golden Q&A)

**Deferred to post-v1:** Tier 2 (Crawlee+stealth+residential proxy) spike pending legal review; Tier 3 (FOI Alaveteli) and Tier 5 (partnership SFTP drops) are v1.x/v2.

**NEW Phase 2:**
- KG construction (LightRAG port to TS + GLiNER fine-tune)
- Hybrid retrieval (3-way RRF + CRAG)
- NL Q&A + Timeline (original Phase 1 features)

**Rationale:** Original Phase 1 puts the riskiest components (ingestion on blocked sources, extraction over Filipino code-switching) last. They must be first — if these fail, the rest doesn't matter.

#### P7 — Business Model Addition (NEW PRD section)

**NEW section after §Future Enhancements:**
```
# Business Model & Sustainability

## Structure: Nonprofit Parent + LLC Subsidiary
(Mozilla / Wikimedia Enterprise model)
- Nonprofit parent: SEC-registered non-stock non-profit, BIR tax-exempt, PCNC-certified
- LLC subsidiary: enables enterprise B2B revenue without jeopardizing nonprofit status

## Pricing Tiers
- Citizen/Free: ₱0 — full read access for citizens, journalists, students
- Pro: $500/yr — individual lawyers, academics, freelance journalists (API + bulk export)
- Enterprise: $2K-8K/seat/yr — law firms, political-risk firms, embassies, IFIs
- Institutional: ₱3M-15M/contract — government agencies, university consortia

## Funding Trajectory
- Year 1: $300K budget (90% grants / 10% earned), 4-6 staff
- Year 3: $800K-1.2M (55% grants / 30% earned / 15% other), 8-12 staff
- Year 5: $1-2M (PCIJ-scale sustainability), 12-20 staff

## Top Funding Targets (Year 1)
1. Omidyar Network / Luminate (PH ties, $367M assets) — PRIORITY
2. NED (proven PCIJ funder) — confirm FY26 appropriation
3. Google News Initiative + ICFJ combo (~$80K, reputational gateway)
4. Open Society Foundations, Ford, MacArthur, Hewlett
5. UNDEF, EU IHRD, USAID/UK Aid/Canada Fund
```

**Rationale:** Civic-tech economics require grant funding (ProPublica, PCIJ, OpenSecrets all grant-funded). Earned revenue alone is insufficient. Nonprofit+LLC structure protects mission while enabling enterprise revenue.

### 4.2 TDD Changes (T1-T17)

The 17 TDD amendments are detailed in Section 2.2 above. Each is sourced from the Technical Research master report with confidence-flagged evidence. Key patterns:

- **Stack corrections:** T1 (SQL:PGQ doesn't exist), T4 (Qwen3 not Qwen2.5), T6 (drop nomic)
- **Architecture additions:** T2 (tiered ingestion), T3 (OCR pipeline), T10 (citation engine), T11 (eval harness), T14 (FOI/manual track), T15 (NPC compliance)
- **Refinements:** T5 (XGrammar), T8 (LightRAG port), T9 (RRF+CRAG), T12 (tiered viz), T13 (AGE operations), T16 (PH corpus), T17 (political-risk modeling)

### 4.3 New Workstreams

| Workstream | Source | Owner | Timeline |
|---|---|---|---|
| PIA commission (NPC Advisory 2026-01) | P4, T15 | PH privacy counsel | 6-8 weeks |
| PH legal corpus curation (10-20K labeled sentences) | T16 | Data engineering + UP NCPAG/Arellano partnership | 8-12 weeks |
| Anchor media partner MOU | P6, Market Research | Founder + counsel | 2-4 weeks |
| Omidyar/Luminate grant application | P7, Market Research | Founder | 8-12 weeks |
| Sara Duterte trial pre-ingestion | Epic 9, time-critical | Engineering | 17 days (hard deadline) |

---

## Section 5: Implementation Handoff

### 5.1 Scope Classification: **MAJOR**

This is a fundamental replan requiring PM/Architect involvement. Handoff recipients:

| Role | Responsibility | Recommended BMad Skill |
|---|---|---|
| **Product Manager** | Update source PRD (P1-P7); create formal BMad PRD | `/bmad-prd` |
| **Architect** | Update source TDD (T1-T17); create formal BMad Architecture | `/bmad-create-architecture` |
| **PM + Architect** | Create Epics & Stories from revised PRD + Architecture | `/bmad-create-epics-and-stories` |
| **PM + Architect** | Verify implementation readiness | `/bmad-check-implementation-readiness` |
| **Founder** (parallel) | Commission PIA; submit Omidyar grant; negotiate PCIJ/VERA MOU | External |
| **Engineering** (parallel, time-critical) | Sara Duterte trial pre-ingestion + soft-launch prep | Epic 9 |

### 5.2 Success Criteria for This Course Correction

- [ ] Source PRD updated with P1-P7 amendments (or superseded by formal BMad PRD)
- [ ] Source TDD updated with T1-T17 amendments (or superseded by formal BMad Architecture)
- [ ] Formal BMad PRD exists in `_bmad-output/planning-artifacts/`
- [ ] Formal BMad Architecture exists in `_bmad-output/planning-artifacts/`
- [ ] Epics & Stories exist in `_bmad-output/planning-artifacts/`
- [ ] Implementation readiness check passed
- [ ] PIA commissioned (external counsel engaged)
- [ ] Omidyar/Luminate grant submitted
- [ ] Anchor media partner MOU signed
- [ ] Sara Duterte trial pre-ingestion complete by July 6, 2026

### 5.3 Immediate Next Actions (Priority Order)

1. **🚨 TIME-CRITICAL:** Authorize Epic 9 (Sara Duterte trial pre-ingestion) — 17-day hard deadline
2. Approve this Sprint Change Proposal
3. Run `/bmad-prd` to create formal BMad PRD (using source PRD + P1-P7 amendments + research as input)
4. Run `/bmad-create-architecture` to create formal BMad Architecture (using source TDD + T1-T17 amendments + research as input)
5. Run `/bmad-create-epics-and-stories` to break revised design into executable units
6. Commission PIA (external PH privacy counsel)
7. Submit Omidyar/Luminate grant application
8. Negotiate PCIJ or VERA Files MOU

### 5.4 Parallel Tracks

| Track | Runs in parallel with | Dependency |
|---|---|---|
| PIA commission | Steps 3-5 above | Blocks any scraping in production |
| Omidyar grant app | Steps 3-5 above | Independent |
| PCIJ/VERA MOU | Steps 3-5 above | Blocks Tier 5 ingestion |
| Sara Duterte pre-ingestion (Epic 9) | All planning steps | Hard deadline July 6, 2026 |

---

## Approval

**Anti lustay**, this Sprint Change Proposal recommends:

1. Updating the source PRD with 7 amendments (P1-P7)
2. Updating the source TDD with 17 amendments (T1-T17)
3. Creating formal BMad PRD, Architecture, and Epics using research as input
4. Treating PIA, Omidyar grant, and PCIJ MOU as parallel external workstreams
5. Authorizing time-critical Epic 9 (Sara Duterte trial pre-ingestion) immediately

**Scope:** Major (fundamental replan, PM/Architect involvement required)

**Do you approve this Sprint Change Proposal for implementation?**

- **yes** → I will route to PM/Architect workflows (run `/bmad-prd` next)
- **revise** → Tell me what to adjust
- **partial approve** → Tell me which amendments to accept/reject
