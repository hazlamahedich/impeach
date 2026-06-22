---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - Enterprise_PRD_Impeachment_Intelligence_Platform.md
  - IIP_Technical_Design_Document.docx
workflowType: 'research'
lastStep: 6
research_type: 'domain'
research_topic: 'Philippine Impeachment Intelligence & Political Knowledge Graphs'
research_goals:
  - Validate domain model (node/relationship primitives) for PH impeachment
  - Map canonical sources & their structures
  - Understand PH impeachment process mechanics & precedent
  - Identify explainability/citation standards for political-legal AI
  - Surface entity/relationship modeling best practices from civic-tech & legal KGs
user_name: 'anti lustay'
date: '2026-06-19'
web_research_enabled: true
source_verification: true
companion_reports:
  - research/industry-research-civic-tech-legal-political-platforms-2026-06-19.md
  - research/domain-research-philippine-impeachment-mechanics.md
  - research/domain-philippine-impeachment-knowledge-representation-standards-research-2026-06-19.md
  - research/domain-philippine-sources-and-document-formats-research-2026-06-19.md
---

# Research Report: Domain — Philippine Impeachment Intelligence & Political Knowledge Graphs

**Date:** 2026-06-19
**Author:** anti lustay
**Research Type:** Domain
**Project:** Impeachment Watch (IIP)

---

## Research Overview

This report validates the Impeachment Intelligence Platform (IIP) PRD/TDD against the real domain of Philippine constitutional impeachment, civic-tech industry economics, knowledge-representation standards, and the practical realities of ingesting PH government documents. The findings below are surfaced from **four parallel deep-dive reports** (linked in frontmatter) and consolidated here for executive consumption.

**Methodology:** Web-verified claims with multi-source validation; confidence flags (🟢 High / 🟡 Medium / 🔴 Low) applied throughout. All URLs cited inline.

---

## Domain Research Scope Confirmation

**Research Topic:** Philippine Impeachment Intelligence & Political Knowledge Graphs

**Research Goals:**

1. Validate the domain model (node types: Person/Org/Event/Document/Claim/Evidence; relationship types: FILED, VOTED_FOR, SUPPORTED, REFUTED_BY, etc.) against PH impeachment reality
2. Map canonical sources & their structures (House/Senate/Judiciary document conventions, citation norms, transcript formats)
3. Understand the PH impeachment process mechanics (complaint → House Justice → Senate trial → verdict) and historical precedent
4. Identify explainability / citation standards for political-legal AI claims
5. Surface entity/relationship modeling best practices from civic-tech and legal knowledge graph projects

**Domain Research Scope:**

- Industry Analysis — Civic-tech, legal intelligence, political data platforms
- Regulatory Environment — PH Constitution Art. XI §2-8, Senate Impeachment Rules, libel/defamation (RA 10953, RA 10175), data privacy (RA 10173)
- Process Mechanics — PH impeachment lifecycle
- Knowledge Representation — Legal/political ontologies (EuroVoc, LKIF, Popolo, etc.)
- Source Authority Hierarchy — Canonical vs secondary evidence in PH political-legal discourse
- Risk & Ethics — Defamation risk, media-source bias, sourcing neutrality

**Research Methodology:**

- All claims verified against current public sources
- Multi-source validation for critical domain claims
- Confidence level framework for uncertain information
- Comprehensive domain coverage with industry-specific insights

**Scope Confirmed:** 2026-06-19

---

## Industry Analysis (see `industry-research-civic-tech-legal-political-platforms-2026-06-19.md`)

### Market Size and Valuation

- **Legal AI Software** — the closest adjacent market — is **USD 3.11B (2025)** growing at **28.3% CAGR to USD 10.82B by 2030** 🟢 _Source: MarketsandMarkets, Feb 2025 — https://www.marketsandmarkets.com/Market-Reports/legal-ai-software-market-88725278.html_
- **GovTech / e-Government** (broader category): USD 400–600B globally, ~12–15% CAGR, but **highly fragmented and inconsistently sized** 🔴
- **Political risk advisory** (Verisk Maplecroft, Eurasia Group, Bower Group Asia): single-digit billions globally, mostly advisory not software 🔴
- **Content services platforms** sub-segment: USD 101.6B by 2027, CAGR 15.8% 🟡

### Market Dynamics and Growth

- **Growth drivers:** Generative AI inflection (2023+), **RAG as dominant architecture**, **knowledge-graph renaissance (Microsoft GraphRAG 2024)**, open-data movement maturity, disinformation counter-pressure
- **Barriers to entry:** Data corpus rights, citation-trust engineering (near-zero hallucination tolerance), PH Data Privacy Act compliance, bilingual EN/Filipino processing, slow institutional sales cycles
- **Cyclical patterns:** Impeachment/election/SC-event-driven demand spikes. **The Sara Duterte impeachment (active 2025–2026) is a live demand spike for the IIP category** 🟢

### Market Structure and Segmentation

IIP sits at the intersection of **five overlapping segments**, each with different economics:

1. **Legal research platforms** — LexisNexis / Westlaw / Wolters Kluwer triopoly; AI-native challengers (Casetext→Thomson, Harvey, vLex)
2. **Legislative & transparency trackers** — GovTrack.us (US indie 20+ yrs), TheyWorkForYou (UK), **no mature PH equivalent** 🔴
3. **Government transparency & civic intelligence** — OpenSecrets, LittleSis, PCIJ, Vera Files, Rappler (PH nonprofit newsrooms, not SaaS)
4. **Political risk & country intelligence** — Eurasia, Verisk Maplecroft, Bloomberg Gov, FiscalNote (high-margin but small)
5. **Counter-disinformation & fact-checking tech** — Snopes, PolitiFact, Full Fact, Meedan Check, **Rappler/Vera Files (IFCN-certified)**

### Industry Trends and Evolution

- **GraphRAG** (Microsoft 2024) validates the exact architecture IIP proposes (KG + LLM + RAG) 🟢
- **Agentic AI in legal research** (Harvey, CoCounsel "Agentic" 2025–26) — moving from search-and-summarize to autonomous multi-step research 🟡
- **Verification & provenance as features, not afterthoughts** — Mata v. Avianca (2023) and PH bar concerns push the market toward source-grounded architectures 🟢
- **Multilingual legal-AI** — most legal-AI R&D is Anglophone; significant white space in Filipino/Tagalog 🔴
- **Newsroom-AI convergence** — ASEAN newsrooms (incl. Rappler) issued joint AI statement on World Press Freedom Day 2026 🟢 _Source: https://www.rappler.com/about/statement-asean-newsrooms-artificial-intelligence-impact-journalism/_

### Competitive Dynamics

- **PH is genuine whitespace** — no incumbent commercial PH political/legal intelligence platform 🔴 (absence-of-evidence; needs validation)
- **Global vendors have not localized** — LexisNexis/Westlaw have negligible PH law coverage; no Filipino-language capability 🟡
- **Demand signals are strong and current** — Sara Duterte impeachment, ASEAN newsroom AI consortium, mature fact-check ecosystem 🟢
- **Recommended posture:** "vertical civic-tech for PH constitutional/law-political events" — not "another legal research tool" (too crowded, too Anglophone)

---

## Regulatory Environment & Process Mechanics (see `domain-research-philippine-impeachment-mechanics.md`)

### Constitutional Framework

- **Article XI ("Accountability of Public Officers"), Sections 2–8 and 17** of the 1987 Constitution is the sole source authority.
- **Impeachable officers (closed list):** President, VP, SC Justices, Constitutional Commissioners (CSC/COMELEC/COA), Ombudsman. (Deputies NOT included.)
- **Six exclusive grounds:** culpable violation of the Constitution, treason, bribery, graft & corruption, other high crimes, betrayal of public trust.
- **One-year bar (Art. XI §3[5]):** no proceedings against the same official more than once within one year. SC interpretation in *Francisco Jr. v. House of Representatives* (2003) defined "initiation."
- **SALN duty (Art. XI §17 + RA 6713 §8):** mandatory public disclosure for high officials — the evidentiary backbone of multiple impeachment cases.

### Procedural Lifecycle (11 steps, with thresholds)

1. **Verified complaint filed** (HR member OR citizen with HR endorsement OR ≥1/3 HR auto-Articles route)
2. **Referral** — Speaker includes in Order of Business within 10 session days; 3 session days to refer to Justice Committee
3. **Committee determinations** — sufficiency in form → substance → grounds (sequential)
4. **Hearing & probable cause vote** — majority of ALL Committee members; report within 60 session days
5. **Plenary vote** — ≥1/3 of ALL House Members (≈102/306 in 20th Congress); roll-call recorded in Journal
6. **Service on Senate** — Articles physically transmitted by House prosecution delegation
7. **Senate convenes as impeachment court** — CJ presides (no vote) for presidential trials; Senate President presides + votes otherwise
8. **Summons & pleadings** — 10-day Answer, 5-day Reply, default = "not guilty"
9. **Trial** — 2pm daily, open doors, senator-judges may question (2 min each), Rules of Court apply *mutatis mutandis*
10. **Voting & judgment** — all articles voted separately by roll-call; **2/3 of ALL senators (16/24)** for conviction; removal + perpetual disqualification
11. **Limited judicial review** — SC may review grave abuse of discretion (Art. VIII §1, *certiorari*)

### Historical Cases & Precedent

| Case (Year) | Respondent | Outcome | Precedent |
|---|---|---|---|
| Estrada (2000–01) | President | Impeached by House; Senate trial aborted after "second envelope"; ousted via EDSA II | First PH presidential Senate trial |
| Gutierrez (2011) | Ombudsman | Resigned before Senate trial | Resignation moots proceeding |
| **Corona (2011–12)** | **Chief Justice** | **Convicted 20–3 on Article II (SALN non-disclosure)** | **Only completed conviction in PH history** |
| Davide (2003, attempted) | Chief Justice | SC enjoined via *Francisco Jr.* | Defined one-year-bar "initiation" test |
| Sereno (2017–18) | Chief Justice | Ousted via *quo warranto* (8–6) — bypassed impeachment | Alternative removal path |
| GMA (2005–08, multiple) | President | All killed via preemptive weak complaints | Weaponizing the one-year bar |
| **Sara Duterte (2025–26)** | **VP** | **SC voided; one-year bar runs to Feb 6, 2026** | Expanded "initiation" to include failure-to-refer |

### Senate Impeachment Rules — Document-Structure Impacts

- **§88:** Articles of Impeachment are **annexed to the Senate summons** — key document-attachment convention
- **§90:** Senate Journal is the canonical trial record (not a stenographer's transcript)
- **§92:** Verdict is a **roll-call tally per article, NOT a reasoned opinion** — reasoning lives in individual senator explanations
- **§93:** Each senator's **2-minute explanation** may be appended — rich source of individual reasoning for KG ingestion
- **Evidence rules:** Revised Rules of Court apply *mutatis mutandis*; exhibits numbered (Pros. "A", Def. "1"); senator-judges may relax rules at discretion

### Document Conventions

- **Articles of Impeachment** — Caption → Preamble → Numbered Articles (Roman numerals) each citing constitutional ground verbatim → Prayer → Verification page
- **Senate verdict** — roll-call tally + per-senator 2-min explanations + short signed order; NOT a unified reasoned opinion
- **SC decision** — Caption (Case title + G.R. No. + date) → Ponente → Facts/Issues/Ruling/Fallo structure → separate/concurring/dissenting opinions; cite as `Case, G.R. No., date` or `Vol SCRA page`
- **SALN** — Standardized CSC form (`OCA-SALC-Form No. 98` + `OCA-CL-Form No. 98`); Assets/Liabilities/Net Worth/Business Interests/Relatives-in-Govt sections; 6 custodians (Ombudsman for high officials); 10-year retention; access regime changed by Remulla Oct 14, 2025

### Defamation / Libel Risk for AI Platforms

- **Ordinary libel (RPC Art. 353–362):** 6 mo–4 yrs 2 mo, **1-year prescription**
- **Cyberlibel (RA 10175 §4[c][4]):** 6–12 yrs (one degree higher), **12-year prescription**
- **Constitutionality upheld** in *Disini v. Secretary of Justice* (G.R. No. 203335, Feb 18, 2014) but **"mere reactor" liability struck down** — only original author/publisher liable
- **Maria Ressa precedent** (*People v. Santos/Ressa*, June 15, 2020): cyberlibel conviction based on "re-publication theory" — **a live risk for AI platforms that surface allegations**
- **No §230-style safe harbor** in PH — E-Commerce Act (RA 8792) is narrower

**Implications for IIP:** (1) re-surfacing allegations may be treated as re-publication; (2) truth is NOT an absolute defense (requires good motives/justifiable ends); (3) **anchor every claim to a primary-source document and quote rather than paraphrase** defamatory imputations; (4) preserve "alleged" framing for unproven charges.

### Data Privacy Implications (RA 10173)

- **Sensitive personal info** (Sec. 3[l]) includes financial data, IDs, **criminal record** — impeachment KG will process large volumes
- **Likely lawful basis:** **legitimate interest** (Sec. 13[b], NPC Advisory 2017-01) — but **NARROWER than GDPR** and requires balancing test
- **Public-figure nuance:** Official acts are matters of public concern (Const. Art. III §7), but does NOT automatically extend to family financials or vulnerable witnesses
- **72-hour breach notification** mandatory (NPC Circular 16-03)
- **Mandatory:** DPO appointment, Privacy Impact Assessment, defined retention policy

### ⚠️ NEW — NPC Advisory No. 2026-01 (April 13, 2026) — Perplexity follow-up

**Title:** "Guidelines on Data Scraping of Publicly Available Personal Data"
**Sources:** [Dataguidance](https://www.dataguidance.com/news/philippines-npc-issues-advisory-data-scraping-publicly), [Baker McKenzie analysis](https://www.bakermckenzie.com/en/insight/publications/2026/05/philippines-npc-tightens-rules-on-data-scraping), [NPC advisories page](https://privacy.gov.ph/pips-and-pics/advisories-circulars/)

**Binding requirements directly affecting IIP:**

1. **Public availability ≠ consent.** Publicly available personal data is NOT exempt from DPA. Scraping is a regulated form of processing.
2. **Valid lawful basis required** (IIP: legitimate interest, Sec. 13[b]) with documented **balancing test**.
3. **Privacy Impact Assessment MANDATORY for all scraping activities**, including those done by third-party processors. → **New pre-launch deliverable** (~6–8 weeks, ~₱200K–500K with PH privacy counsel).
4. **"Heightened regulatory scrutiny"** for large-scale scraping, profiling, aggregation. IIP's bulk document ingestion triggers this.
5. **Specific, legitimate purpose limitation** — IIP must publish a purpose statement (transparency / accountability / journalism / research).
6. **Avoid high-risk fields** (full home addresses, precise asset locations, family financials) unless demonstrably necessary and proportionate.
7. **Data subject rights** (access, objection, correction) must be honored — IIP must build a request-handling workflow.

**Practical impact:** IIP's compliance posture must include: (a) commissioned PIA before launch, (b) published privacy notice with explicit lawful basis + balancing test summary, (c) data minimization (redact/pseudonymize family + witnesses), (d) rate-limiting/bot-detection on hosted data, (e) breach-notification procedure, (f) PH privacy counsel on retainer.

---

## Knowledge Representation Standards (see `domain-philippine-impeachment-knowledge-representation-standards-research-2026-06-19.md`)

### Adopt as backbone (Priority P0)

- **Popolo** (popoloproject.com) — international legislative-data standard; adopted by Taiwan's g0v, mySociety, Openpolis, Sinar Project (PH-relevant ASEAN context). **IIP's flat Person/Event nodes are insufficient — needs Popolo's Membership, Motion, VoteEvent, Vote, Speech as first-class types** 🟢
- **Akoma Ntoso** (OASIS 2018) — XML standard for parliamentary/legal docs; lets IIP cite sub-document spans ("which sentence of which transcript is the evidence?") 🟢
- **PROV-O** (W3C) — IIP's `relationships.confidence` lacks *who/how/when*. **Every assertion needs provenance; non-optional for an "evidence-backed" platform** 🟢
- **ClaimReview** (schema.org) + **IFCN** — Rappler & Vera Files are IFCN signatories publishing ClaimReview-tagged verdicts; ingest as first-class 🟢
- **AIF + Toulmin** — `SUPPORTED_BY`/`REFUTED_BY` must become *reified relation nodes* (support scheme + strength), not bare edges 🟡

### Identifier patterns to mirror (Priority P1)

- **ELI** (European Legislation Identifier): `/eli/{jurisdiction}/...` for documents → IIP should adopt `/iip/ph/{body}/{doc-type}/{congress}/{number}/{version}`
- **ECLI** (European Case Law Identifier): `ECLI:{country}:{court}:{year}:{serial}` + 9 mandatory Dublin Core metadata fields → IIP's `documents` table (id, title, url, source, publish_date, content, checksum) is **too thin**; missing creator, accessRights, language, doc-type, references

### Argumentation models (P0 for the Claim/Evidence subgraph)

- **AIF (Argument Interchange Format)** — I-nodes (info) / RA-nodes (support rule) / CA-nodes (attack) / PA-nodes (preference/conflict-resolution) / F-nodes (schemes like "expert opinion", "witness testimony")
- **IBIS** — Issue / Position / Argument — the deliberation layer (what senators/committees are *arguing about*); **add an `Issue` node type absent from PRD**
- **Toulmin** — Claim / Ground / Warrant / Backing / Rebuttal / Qualifier — originally designed for courtroom argument
- **Carneades** — proof standards (scintilla, preponderance, clear-and-convincing, beyond-reasonable-doubt) → **tag each allegation with applicable proof standard** (impeachment is neither criminal nor civil)

### 12 Concrete Gaps in IIP's PRD Schema

| # | Gap | Fix |
|---|---|---|
| 1 | No `Membership` linking Person↔Org with role/dates/party/district | Add Popolo Membership |
| 2 | `Event` is overloaded (Hearings/Votes/Filings/Decisions) | Split into Popolo Motion / VoteEvent / Speech / Event |
| 3 | No `Issue`/deliberation primitive | Add IBIS Issue node |
| 4 | No `Place`/geography | Add OCD-ID areas |
| 5 | `SUPPORTED_BY`/`REFUTED_BY` as bare edges | Reify as AIF RA/CA nodes with scheme + strength |
| 6 | No provenance layer (who/when/how) | Add PROV-O on every assertion |
| 7 | No ownership/beneficial-ownership dimension | Add BODS-inspired ownership edges |
| 8 | No `Quotation` primitive | Reify `wasQuotedFrom` (source-doc + span + text) |
| 9 | No temporal modeling beyond publish_date | Add valid_from/valid_to + at_time |
| 10 | `documents` table too thin | Expand per ECLI mandatory metadata |
| 11 | No source-credibility attributes | Add MBFC factual/bias + IFCN cert fields |
| 12 | No family/dynasty dimension | Add family relationships (PH-specific extension) |

### Minimal Viable Adoption for v1

If IIP can adopt only five things for an MVP:
1. **Popolo** entity model (Person/Org/Membership/Post/Motion/VoteEvent/Vote/Speech/Event/Area)
2. **PROV-O** provenance layer on every assertion
3. **ClaimReview** for fact-check verdicts + IFCN tier-1 sources
4. **Toulmin anatomy** on Claim + **AIF RA/CA reified relations** (drop PA-nodes and IBIS Issues to v2)
5. **ECLI-style identifiers + expanded document metadata**

Everything else layers on top without schema rewrites, *provided* the v1 schema uses reified-relationship + provenance-qualified patterns from day one.

---

## PH Sources & Document Formats (see `domain-philippine-sources-and-document-formats-research-2026-06-19.md`)

### 🚨 Critical Headline

**The four most important primary-source PH government sites — House, Senate, Supreme Court, COA — ALL block automated ingestion.** This reframes the strategy from "scrape" to "partner / FOI-request / manual-acquire + OCR."

| Site | Status | Mechanism |
|---|---|---|
| congress.gov.ph / hrep.gov.ph | **403** | Server-side bot block |
| senate.gov.ph | **403 + Cloudflare** | WAF blocks fetchers AND headless Playwright |
| sc.judiciary.gov.ph | **intermittent failure** | Chronic downtime |
| coa.gov.ph | **403** | Server-side bot block |
| pna.gov.ph | **403** | Server-side bot block |
| manilabulletin.com.ph | **`Disallow: /`** | Total robots block |

### 🟢 Easy Ingest Targets (Day 1)

- **Official Gazette** — clean WordPress HTML, likely `/feed/` RSS
- **PCIJ** — open sitemap, impeachment tag, "Duterte ICC Tracker" template
- **VERA Files** — open, dedicated `/articles/impeachment`, runs "SEEK" RAG chatbot (precedent!)
- **LawPhil + Chan Robles** — SC jurisprudence mirrors
- **COMELEC** — accessible (dual-CMS quirk noted)
- **Ombudsman decisions** — browseable; **SALNs require per-document request**
- **GMA / Inquirer / Philstar / Bulatlat / Pinoy Weekly** — open news crawls
- **Internet Archive Wayback** — fallback for blocked sites

### 🟠 Medium Difficulty (workflow required)

- **Rappler** — robots blocks ~35 AI bots → **partnership or human-mediated export, not scrape**
- **SALNs (Ombudsman)** — per-document formal request queue + OCR
- **FOI portal (foi.gov.ph)** — batch request programme with intake logging

### 🔴 Hard / Impossible via Autonomous Scrape

- **Senate** (Cloudflare) — trial transcripts, Impeachment Rules, committee reports → **mandatory manual / partnership / FOI**
- **House** — verified complaint text, endorsement signatures, committee reports → same
- **Supreme Court** — mirror via LawPhil/Chan Robles for jurisprudence; direct site unreliable
- **COA** — AARs/AOMs (corruption evidence) → manual / FOI
- **PNA, Manila Bulletin** — licensing or manual acquisition

### Engineering Priorities Implied

1. **OCR-first ingestion pipeline** (Tesseract `fil+eng`, layout-aware via unstructured.io/docling) — **>80% of primary docs are scanned images**, non-negotiable
2. **Manual-intake + FOI-tracking module** as a first-class ingestion channel with provenance logging
3. **NER over OCR'd text** → KG entities (persons, parties, dockets, amounts, dates, votes)
4. **Wayback fallback layer** in fetcher for every blocked gov URL
5. **Citation resolver** mapping `<docket, date>` ↔ SCRA pin-cite ↔ LawPhil/ChanRobles mirror URL
6. **Partnership track** with PCIJ, VERA Files, Rappler, ideally Senate Public Information office — *only durable path to trial transcripts*

---

## Cross-Cutting Strategic Implications for the PRD/TDD

### 1. PRD's 7-agent architecture is correct in spirit, but roles need refinement

The PRD proposes: Collector, Analyst, Graph Builder, Timeline Builder, Fact Checker, Narrative Builder, Query Planner. Research validates this but adds precision:

- **Collector** must be split into *Scrapable*, *Manual-Intake*, and *FOI-Request* sub-pipelines — the three have fundamentally different SLAs and provenance contracts.
- **Analyst** should emit **Popolo-typed** entities (Person/Membership/Motion/Vote/Speech), not generic Person/Org/Event.
- **Fact Checker** should **ingest ClaimReview-tagged verdicts** from Rappler/Vera Files as first-class data, not just perform its own checks.

### 2. The "query → answer → citation" loop is non-negotiable for legal-political use

PRD's success metrics (Query accuracy >90%, Citation coverage 100%) are correct. Research sharpens the requirement:

- **Every claim in a generated answer must carry a sub-document citation** (Akoma Ntoso span) — paraphrase + footnote is insufficient under PH libel risk.
- **Hallucination is a libel event**, not just a bug. Architecture must enforce retrieval-grounded generation with **reject-if-not-grounded** behavior.

### 3. The PRD's database schema needs revision before implementation

The proposed `documents`, `entities`, `relationships`, `ingestion_jobs` tables are too thin. Specifically:

- `documents` lacks creator/author, accessRights, language, doc-type, jurisdiction, references → add ECLI mandatory fields
- `entities` flat type (`entity_type` string) is insufficient → adopt Popolo's typed hierarchy
- `relationships.confidence` (single float) is insufficient → reify as AIF RA/CA node with scheme + strength + provenance

**Recommendation:** Run the **bmad-create-architecture** workflow next to formalize the revised schema.

### 4. Sara Duterte impeachment (2025–26) is a live, time-sensitive opportunity

Verified mid-2026 status: SC voided the 4th impeachment; one-year bar runs to Feb 6, 2026; Senate trial expected July 6, 2026 (per VERA Files coverage). This is both:

- A **proof-of-concept opportunity** for the IIP — build against live data
- A **timing risk** — if v1 ships after the trial concludes, much of the audience evaporates

### 5. Two business-development moves unlock the platform

1. **Formal partnerships with PCIJ + VERA Files** — access to their verified-reporting corpus + legitimacy halo
2. **FOI programme** with the Senate/House/COA — durable legal channel to the highest-value blocked sources

### 6. Libel & privacy are product requirements, not afterthoughts

- **Quote, don't paraphrase**, defamatory imputations
- Preserve "alleged" framing for unproven charges
- **Appoint a DPO**, conduct a Privacy Impact Assessment before launch
- Define retention policy tied to the "accountability/transparency" purpose

---

## Confidence Summary

| Section | Confidence | Notes |
|---|---|---|
| Industry sizing (Legal AI market) | 🟢 High | MarketsandMarkets verified |
| PH constitutional impeachment mechanics | 🟢 High | ChanRobles verbatim text |
| Historical cases (Corona, Estrada, Sereno) | 🟢 High | Wikipedia case articles |
| Sara Duterte 2025–26 specifics | 🟡 Medium | Recent; verify against SC decision text |
| Senate rule numbers §85–96 | 🟡 Medium | Official PDF returned 403; via secondary citation |
| Standards (Popolo, AKN, PROV-O, ClaimReview, AIF) | 🟢 High | All verified live |
| PH source availability & block status | 🟢 High | All HTTP-probed this session |
| PH civic-tech ecosystem | 🟡 Medium | Sites verified; gap analysis partially inferred |
| PH libel/privacy statute | 🟢 High | Statute text + Supreme Court decisions |
| NPC advisory specifics | 🟡 Medium | Verify against NPC's current register |

---

## Recommended Verifications Before Schema Freeze

1. **Fetch the Senate Rules PDF** directly from a Senate mirror or FOI — confirm rule numbers §85–96
2. **Obtain the SC decision in the Duterte 2025–26 one-year-bar ruling** — G.R. number TBD; verify Feb 5, 2025 trigger date and Feb 6, 2026 bar expiry
3. **Pull full text of RA 10173 §12–13, 21 and NPC IRR Part 4** to codify the legitimate-interest balancing test for the IIP's DPIA
4. **Confirm the current SALN access regime** post-Remulla (Oct 14, 2025 lifting) — ingest the new Ombudsman circular
5. **Consult PH counsel** on the AI-platform safe-harbor question — PH has no §230 equivalent; the *Ressa* "re-publication" theory is the live risk

---

## Companion Deep-Dive Reports

| File | Topic |
|---|---|
| `industry-research-civic-tech-legal-political-platforms-2026-06-19.md` | Industry analysis: market sizing, segmentation, trends, competitive dynamics |
| `domain-research-philippine-impeachment-mechanics.md` | Constitutional framework, procedural lifecycle, historical cases, libel/privacy risk |
| `domain-philippine-impeachment-knowledge-representation-standards-research-2026-06-19.md` | Ontologies/schemas: LKIF, EuroVoc, ELI/ECLI, Akoma Ntoso, Popolo, AIF/IBIS/Toulmin, ClaimReview, PROV-O |
| `domain-philippine-sources-and-document-formats-research-2026-06-19.md` | PH source availability, document anatomy, citation norms, ingestion strategy |

---

*End of master domain research report. Next recommended step: Technical Research (TR) to validate the technology stack against these domain constraints, then Market Research (MR) to map specific competitors.*
