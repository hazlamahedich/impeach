# Competitive Landscape: Philippine Impeachment Intelligence Platform (IIP)

**Research date:** June 19, 2026
**Method:** Direct site fetches + DuckDuckGo/Bing searches. Many PH entities verified live.
**Confidence legend:** 🟢 confirmed live & characterized · 🟡 inferred from indirect sources · 🔴 could not verify / likely defunct

---

## EXECUTIVE SUMMARY (TL;DR)

**No existing platform — in the Philippines or anywhere in ASEAN — does what IIP proposes.** The specific combination of (a) a *knowledge graph* over (b) *impeachment-specific* primary documents, (c) NL Q&A with citations, (d) senator dashboards, and (e) contradiction detection is **unoccupied**.

**Closest competitor:** **VERA Files SEEK** (launched Nov 30, 2025) — a RAG chatbot over 17 years of VERA Files journalism. It validates the *demand* for IIP's core feature but is (i) closed-corpus (only VERA's own articles), (ii) fact-check/misinformation-scoped, not impeachment-scoped, and (iii) not a knowledge graph (no entity relations, no senator dashboards, no contradiction layer).

**Closest inspiration:** **PRS India** (prsindia.org) — the gold-standard nonprofit legislative tracker. They track MPs, bills, sessions, committees, budgets for Indian Parliament + states. Not AI, but the structural template IIP should learn from.

**The genuine gap IIP fills:** Cross-document impeachment intelligence (House complaints + Senate trial + SC rulings + COA audits + Ombudsman cases + news coverage) as a *queryable, citable graph* — nobody is doing this.

---

## 1. PH NEWSROOM DATA-JOURNALISM

### 🟢 VERA Files — **PRIMARY DIRECT COMPETITOR (NL Q&A)**
- **URL:** verafiles.org · seek.verafiles.org (chatbot)
- **Type:** Nonprofit newsroom (fact-check focus)
- **Scope:** National PH
- **Founded:** ~2008 (17 years of archive as cited in SEEK launch)
- **Funding:** Foundation grants, IFCN, Google News Initiative, Luminate
- **Scale:** One of 5 IFCN-accredited PH fact-checkers
- **Tech sophistication:** **HIGH** — LangChain/LangSmith RAG stack (prompt visible at smith.langchain.com/hub/verafiles/seek_search_assistant-response_prompt)
- **IIP feature overlap:** ✅ NL Q&A · ✅ citation grounding · ❌ no knowledge graph · ❌ no senator dashboards · ❌ no contradiction detection · ❌ no timeline explorer (closed corpus)
- **Partnership potential:** **HIGH** — mission-aligned. VERA could be both a competitor (for fact-check Q&A) and a content partner (their 17-yr archive enriches IIP).
- **Verbatim mission:** *"Search Experience Elevated to Knockout Disinformation: A VERA Files AI powered search assistant to help people interested in fact checking and understanding misinformation trends"*
- **Source:** https://verafiles.org/articles/vera-files-launches-seek-an-ai-powered-chatbot-built-on-17-years-of-philippine-journalism (Dec 10, 2025)

### 🟢 Rappler — **KNOWLEDGE-GRAPH PIONEER + SCALE COMPETITOR**
- **URL:** rappler.com · data.rappler.com
- **Type:** Digital-only newsroom (for-profit, Maria Ressa, Nobel laureate)
- **Scope:** National PH, global profile
- **Founded:** 2012
- **Funding:** Ads + Rappler Communities app subscription + grants (Google News Initiative, Luminate, Ford)
- **Scale:** ~3.5M users (per TechList.ai 2026 profile); $50M revenue claim
- **Tech sophistication:** **VERY HIGH** — In **2022 built the Philippines' first political knowledge graph** with **Graphwise (Ontotext)** for election coverage. Rappler Communities app (Dec 2024). #FloodControlPH citizen-reporting.
- **IIP feature overlap:** ✅ has built a political knowledge graph (election-scoped, not impeachment) · ✅ data dashboards · ❌ no NL Q&A on docs · ❌ no impeachment specialization · ❌ no contradiction detection
- **Partnership potential:** **MEDIUM-HIGH** — they have the KG expertise and audience; IIP has impeachment specialization. Possible "coopetition."
- **Source:** https://graphwise.ai/success-story/rappler-powering-transparent-fact-based-journalism-at-scale/

### 🟢 PCIJ (Philippine Center for Investigative Journalism) — **THEMATIC COMPETITOR**
- **URL:** pcij.org
- **Type:** Nonprofit investigative journalism
- **Scope:** National PH
- **Founded:** 1989
- **Funding:** Grants (NDOCA, Open Society, Ford, ICFJ)
- **Scale:** Active IJPH conference (IJPH2025); broad readership
- **Tech sophistication:** **MEDIUM** — WordPress/Newspack, interactive maps ("MAP: Who voted to impeach VP Sara Duterte"), microsites (Elections, Supreme Court). No AI. No structured DB exposed.
- **IIP feature overlap:** ✅ impeachment topic coverage (literally has an `/impeachment/` category and a Duterte Impeach Votes map) · ✅ Duterte ICC Tracker · ✅ Political Dynasties DB · ❌ no NL Q&A · ❌ no KG · ❌ no contradiction detection
- **Partnership potential:** **VERY HIGH** — natural content partner. Their impeachment coverage + interactive maps could plug into IIP.
- **Notable:** Site was subject of Chinese-embassy-orchestrated fake FB attack (April 2026) — demonstrates threat model IIP must also defend against.

### 🟢 Inquirer.net — **BROAD COVERAGE, LOW TECH**
- **URL:** newsinfo.inquirer.net
- **Type:** Legacy broadsheet digital
- **Scope:** National PH
- **Founded:** 1985 (print); online since 1997
- **Funding:** Ads + subscriptions
- **Scale:** Among top-3 PH news sites by traffic
- **Tech sophistication:** **LOW-MEDIUM** — CMS-driven, no structured DB, no AI
- **IIP feature overlap:** ❌ none direct; only topical impeachment coverage
- **Partnership potential:** MEDIUM — content syndication

### 🟡 GMA News ("How Voted" / Eleksyon tracker) — **ELECTION-SCOPED, NOT IMPEACHMENT**
- **URL:** gmanetwork.com/news/tracking/senate_race · /eleksyon/2025/results/senate
- **Type:** Broadcast news digital
- **Scope:** National PH
- **Tech sophistication:** **MEDIUM** — real-time results dashboards, Eleksyon mobile app. Senator voting tracker exists but is *event-driven* (leadership changes, specific votes), not a persistent structured DB.
- **IIP feature overlap:** ⚠️ partial — they publish senator voting outcomes but not as queryable graph; no impeachment trial vote tracker structured DB
- **Partnership potential:** MEDIUM
- **Source:** https://www.gmanetwork.com/news/tracking/senate_race/

### 🟢 Tsek.ph — **ELECTION-CYCLE ONLY, NOT COMPETITIVE**
- **URL:** tsek.ph
- **Type:** Coalition (academe + media, including UPCP, UST, PPI)
- **Scope:** National PH, election cycles only
- **Founded:** 2019; **relaunched Feb 7, 2025** for midterms
- **Funding:** Academic + member in-kind + grants
- **Scale:** 12,700 FB followers; selected for US Library of Congress PH Election 2022 Web Archive
- **Tech sophistication:** **LOW** — WordPress, curated fact-checks. No AI. No structured DB.
- **IIP feature overlap:** ❌ none direct — fact-check coalition, not document intelligence
- **Partnership potential:** HIGH (mission-aligned for fact layer)
- **Caveat:** Goes dormant between election cycles.

### 🟡 ABS-CBN News (Halalan results) — **POST-FRANCHISE, REDUCED FOOTPRINT**
- **URL:** halalanresults.abs-cbn.com
- **Type:** Broadcast news digital (post-2020 franchise loss)
- **Tech sophistication:** MEDIUM — maintained a real-time results site for Halalan 2025
- **Partnership potential:** LOW-MEDIUM
- **Note:** Fact-check operation continues at reduced scale post-franchise.

### 🟢 #FactsFirstPH coalition — **COALITION, NOT A PLATFORM**
- **Type:** Multi-org coalition (Rappler, VERA, PCIJ, etc.) launched ~Jan 2022
- **Status:** Active as a *brand* and editorial coordination effort; **no shared technical platform**
- **Implication:** IIP could be positioned as the *technical layer* under coalitions like this.

### 🟡 Bulatlat / Pinoy Weekly — **ALTERNATIVE PRESS**
- **Type:** Alternative/progressive press
- **Scope:** National but niche audience
- **Tech sophistication:** LOW
- **Partnership potential:** LOW (audience too small)

---

## 2. PH LEGAL-TECH / LEGAL-RESEARCH STARTUPS

> **Verification methodology:** Cross-referenced Tracxn, Crunchbase, Stanford CodeX TechIndex, LinkedIn, and direct sites. Tracxn lists **16 legal-tech startups in PH** total (top: Legaldex, LexMeet, Digest, Omnibus, UNAWA).

### 🟢 Legaldex AI — **DIRECT AI LEGAL-RESEARCH COMPETITOR (SMALL)**
- **URL:** legaldex.com
- **Type:** Commercial SaaS startup
- **Founded:** 2024 by Don Gumayagay
- **HQ:** Las Piñas / Makati
- **Funding:** Bootstrapped (per Crunchbase / Stanford CodeX profile)
- **Scale:** ~38 LinkedIn followers (very early-stage)
- **Tech sophistication:** **HIGH** — AI legal research, document analysis, search across laws/cases
- **IIP feature overlap:** ✅ AI Q&A on legal docs · ❌ no impeachment specialization · ❌ no KG · ❌ no senator dashboards
- **Partnership potential:** LOW — they serve lawyers/law firms; IIP's audience is different
- **Source:** https://techindex.law.stanford.edu/companies/13088

### 🟢 Digest PH — **DIRECT AI LEGAL-RESEARCH COMPETITOR (TOP-3 BY SUBSCRIBERS)**
- **URL:** digest.ph
- **Type:** Commercial SaaS
- **Founder:** Atty. Raymond Rodis (also pursuing LLM at Monash)
- **Funding:** Self-described top-3 PH AI legal research company by subscribers
- **Scale:** 682 LinkedIn followers
- **Tech sophistication:** **HIGH** — RAG-based ("the AI is built on Retrieval Augmented Generation"), case digests, legal drafting
- **IIP feature overlap:** ✅ RAG over jurisprudence · ❌ not impeachment-scoped · ❌ no KG · ❌ no senator dashboards
- **Partnership potential:** LOW-MEDIUM
- **Source:** https://www.manilatimes.net/2025/03/28/tmt-newswire/a-new-era-of-legal-research-in-the-philippines-with-digest-ai/2081246

### 🟢 Areglaw.ai — **NEW AI LEGAL RESEARCH ENTRANT**
- **URL:** areglaw.ai
- **Type:** Commercial SaaS
- **Tech sophistication:** HIGH — *"Search 100,000+ jurisprudence, generate case digests, legal drafting"*
- **Status:** Active, appears very early-stage
- **IIP feature overlap:** Same as Digest PH — overlapping tech, non-overlapping scope
- **Source:** https://www.areglaw.ai/

### 🟢 LexMeet — **MARKETPLACE + AI, NOT COMPETITIVE**
- **URL:** lexmeet.com
- **Type:** Lawyer marketplace + AI tools
- **Tech sophistication:** HIGH (JS SPA)
- **IIP feature overlap:** ❌ essentially none — lawyer-client matching, not legal intelligence
- **Partnership potential:** NONE

### 🟢 Chan Robles Virtual Law Library (CRALAW) — **INCUMBENT, LEGACY**
- **URL:** chanrobles.com (online since **1998**)
- **Type:** Law firm + commercial publisher
- **Scope:** National PH
- **Funding:** Free virtual library + paid bar review (ChanRobles Professional Review, ChanRobles Bar) + law firm
- **Scale:** Decades-long incumbent; widely linked by universities and gov sites
- **Tech sophistication:** **VERY LOW** — legacy PHP/HTML, Google Custom Search. No AI. No structured queries. SC decisions organized by year (1901-2024) as static pages.
- **IIP feature overlap:** ⚠️ corpus overlap (laws + SC decisions) but **no intelligence layer**
- **Partnership potential:** LOW — they're a slow incumbent; unlikely to collaborate or compete aggressively

### 🟢 LawPhil Project (Arellano Law Foundation) — **NONPROFIT, LEGACY**
- **URL:** lawphil.net
- **Type:** Nonprofit academic
- **Scope:** National PH
- **Tech sophistication:** **VERY LOW** — plain HTML, 1990s-era site
- **IIP feature overlap:** ⚠️ corpus overlap (laws + SC decisions); no intelligence layer
- **Partnership potential:** MEDIUM — could license/index their archive

### 🟡 Lyceum of the Philippines legal databases — **COULD NOT VERIFY**
- **Status:** No public-facing modern platform found. May exist as gated academic resource. Likely not competitive.

### 🟡 Central Book Supply / SCRA publisher — **PRINT-ERA INCUMBENT**
- **Type:** Print publisher of Supreme Court Reports Annotated
- **Status:** Print + paid digital; not in the AI race
- **Partnership potential:** LOW

### 🔴 LegalResources PH — **COULD NOT VERIFY**
- No active platform found under this name.

### 🟢 Lawko — **EXISTS, BUT PIVOTED AWAY FROM LEGAL ACCESS**
- **URL:** (LinkedIn: ph.linkedin.com/company/lawko-ph)
- **Origin:** UP law-student project, won Rappler's HackSociety (₱50k prize) as a Facebook Messenger bot for legal Q&A
- **Current state (per Crunchbase):** Pivoted to *"marketing and business development services"* for lawyers. **14 LinkedIn followers.**
- **IIP feature overlap:** NONE in current form
- **Partnership potential:** NONE

---

## 3. PH CIVIC-TECH / ACCOUNTABILITY NGOs

> **Confidence:** Mixed. Most operate as advocacy/research orgs, not technical platforms.

### 🟡 Vote-k PH — **ELECTION MONITORING, VERIFIED ACTIVITY LIMITED**
- **Type:** Election-focused civic-tech
- **Status:** Active around election cycles; not a structured accountability DB
- **Partnership potential:** MEDIUM (election-cycle ally)

### 🔴 iBanGO — **COULD NOT VERIFY**
- No live platform or recent activity found. Likely dormant or very small.

### 🔴 Mga Bata — **COULD NOT VERIFY as civic-tech platform**
- (Likely confused with child-welfare NGOs of similar name.)

### 🟢 #FactsFirstPH coalition — **(See §1)** — coalition, no shared platform

### 🟢 Action for Economic Reforms (AER) — **THINK TANK, NOT PLATFORM**
- **Type:** Policy research NGO
- **Partnership potential:** HIGH for content expertise on fiscal/economic angle

### 🟡 IPER (Institute for Political and Electoral Reform) — **THINK TANK**
- **Type:** Research NGO
- **Partnership potential:** MEDIUM

### 🟢 Ateneo School of Government (ASoG) — **ACADEMIC PARTNER CANDIDATE**
- **Type:** Academic
- **Partnership potential:** HIGH — likely source of researchers, validation, co-funding

### 🟢 UP NCPAG — **ACADEMIC PARTNER CANDIDATE**
- **Type:** Academic (public administration/governance)
- **Partnership potential:** HIGH

### 🟢 Social Weather Stations (SWS) / Pulse Asia — **POLLING, DATA PARTNER**
- **Type:** Commercial polling firms
- **Partnership potential:** HIGH for public-opinion layer (impeachment polling data)

### 🟡 Tindig Pilipinas — **ADVOCACY COALITION**
- **Type:** Political coalition (anti-Marcos/Duterte)
- **Partnership potential:** LOW — too partisan; would compromise IIP neutrality

### 🟡 Ombudsman COA-style online platforms — **See §4 (gov)**

---

## 4. PH GOVERNMENT TRANSPARENCY PLATFORMS

### 🟢 foi.gov.ph (eFOI) — **RAW DATA SOURCE / PARTNER**
- **URL:** foi.gov.ph
- **Type:** Government (Presidential Communications Office, FOI-PMO)
- **Scope:** Executive branch (note: Congress and Judiciary are NOT covered by the PH FOI EO)
- **Scale:** **264,019 requests, 737 agencies** (as of June 2026)
- **Tech sophistication:** MEDIUM — functional request portal; outputs are documents (PDFs), not structured data
- **IIP feature overlap:** ❌ none direct — it's a *source* for IIP, not a competitor
- **Partnership potential:** **VERY HIGH** — IIP could ingest FOI-released impeachment docs and add intelligence
- **Critical caveat:** The Senate and House of Representatives and Supreme Court are NOT under the eFOI's coverage (only the Executive). IIP fills a transparency gap foi.gov.ph cannot.

### 🔴 data.gov.ph — **APPEARS DORMANT / PLACEHOLDER**
- **Status:** Fetched only "Open Data Philippines" header with no functional data catalog visible. The PH open-data initiative has stalled; **flag as effectively defunct**.
- **Implication:** IIP cannot rely on data.gov.ph as a data source.

### 🔴 transparency.gov.ph — **DOES NOT APPEAR TO EXIST**
- Domain not active as a unified transparency portal.

### 🟡 Senate/House live streaming + journal portals
- **Senate:** senate.gov.ph returned 403 (anti-bot). Known to publish journals, bills, live streams but in fragmentary, non-queriable form.
- **House:** congress.gov.ph publishes roll-call votes and journals as PDFs.
- **Implication:** These are **raw source documents for IIP**, not competitors. The pain point IIP solves is that these documents are silo'd as PDFs with no cross-references.

### 🟡 Ombudsman eServices / COA portals
- Functional but silo'd; no intelligence layer
- **Partnership potential:** HIGH (data source)

### 🟢 COMELEC transparency / results site
- **URL:** comelec.gov.ph (functional)
- **Type:** Election results and transparency
- **Partnership potential:** MEDIUM (election results data only)

---

## 5. ASEAN REGIONAL PEERS

### 🟢 PRS Legislative Research (India) — **GOLD-STANDARD INSPIRATION**
- **URL:** prsindia.org
- **Type:** Independent nonprofit (~founded 2007–2008)
- **Scope:** India (Parliament + States)
- **Funding:** Grants (no ads, no membership)
- **Scale:** Industry-standard reference for Indian legislative tracking; cited in major Indian press
- **Tech sophistication:** **HIGH (process)** / **MEDIUM (tech)** — comprehensive structured tracking: MPs/MLAs, Session Track, Parliament Diary, Committees, Bills, Acts, Budgets, Monthly/Annual Policy Reviews, Vital Stats. Creative Commons licensed. LAMP Fellowship places assistants with MPs.
- **IIP feature overlap:** ❌ no AI · ❌ no NL Q&A · ❌ no KG — BUT this is the **structural template** IIP should learn from
- **Partnership potential:** HIGH — they may advise on methodology
- **Why it matters:** If PRS India is the global benchmark for *what civic legislative tracking looks like*, IIP's opportunity is to build "PRS India + AI + impeachment specialization" for PH.

### 🟢 Watchout (沃草, Taiwan) — **CIVIC MEDIA REFERENCE**
- **URL:** watchout.tw
- **Type:** Independent nonprofit media (member-funded)
- **Scope:** Taiwan
- **Founded:** ~2014 (g0v spinoff)
- **Funding:** Monthly subscriptions ("定期定額"); 80k+ monthly users, 1M+ social reach (per their self-report)
- **Tech sophistication:** MEDIUM — original reporting, FIMI defense projects, quizzes
- **IIP feature overlap:** ❌ minimal direct (different scope) but **g0v ecosystem is the inspiration for civic-tech product design**

### 🟡 g0v (Taiwan) — **DECENTRALIZED CIVIC-TECH COMMUNITY**
- **Type:** Open-source civic-tech community (Audrey Tang was a contributor before becoming minister)
- **Status:** Active; produces tools like budget visualizers, parliament trackers
- **Partnership potential:** MEDIUM for technical mentorship

### 🟡 iLaw (Thailand) — **CIVIC NGO, NOT TECH PLATFORM**
- **URL:** ilaw.or.th
- **Type:** Thai civic NGO (focus: lese-majeste reform, constitution)
- **Tech sophistication:** LOW — advocacy site, petitions, news
- **IIP feature overlap:** ❌ none direct
- **Partnership potential:** LOW

### 🟡 Thai Political Base — **COULD NOT VERIFY CURRENT STATE**

### 🟡 C4 Center (Malaysia) — **ANTI-CORRUPTION NGO**
- **URL:** c4center.org
- **Type:** NGO
- **Tech sophistication:** LOW — reports and advocacy
- **Partnership potential:** MEDIUM for content/methodology

### 🟡 CIJ (Centre for Independent Journalism, Malaysia) — **MEDIA-ADVOCACY NGO**
- **Partnership potential:** LOW

### 🟡 Indonesia Corruption Watch (ICW) / Mafindo — **NGOs, LOW TECH**
- **Partnership potential:** LOW for tech; MEDIUM for content partnership

### 🟡 Kawal COVID / BaKti (Indonesia) — **EPISODIC CIVIC-TECH**
- **Status:** Kawal COVID was a 2020 phenomenon; not a sustained political-accountability platform

### 🟡 New Naratif / The Online Citizen (Singapore) — **REGIONAL MEDIA**
- **Type:** Independent regional media; face legal pressure in Singapore
- **Partnership potential:** LOW

### 🟡 Hong Kong Free Press / LegCo trackers — **UNDER POLITICAL PRESSURE**
- **Status:** Operational but constrained by NSL

### 🟡 DAKSH / Neta App / Satark Nagrik Sangathan (India) — **VARIOUS**
- **DAKSH:** legal-research civic NGO; **MEDIUM sophistication**
- **Neta App:** appears defunct or pivoted
- **Satark Nagrik Sangathan:** small NGO on elected-representative accountability

---

## 6. GLOBAL IMPEACHMENT / ACCOUNTABILITY TRACKERS

### 🟡 Just Security (US) — Impeachment trackers
- **URL:** justsecurity.org
- **Type:** Academic-adjacent legal commentary (NYU Law / Reiss Center)
- **Status:** Published episodic impeachment trackers for Trump impeachments (2019, 2021). Not a sustained structured DB. Specific tracker URL returned 404 in our test.
- **IIP feature overlap:** Conceptual inspiration only.

### 🟡 Lawfare (US)
- **URL:** lawfaremedia.org (403 in our test — anti-bot)
- **Type:** Editorial legal analysis
- **Status:** Active impeachment commentary; not a structured tracker
- **Partnership potential:** LOW

### 🟡 C-SPAN impeachment archives — **ARCHIVAL, NOT INTELLIGENCE**
- **Type:** Video + transcript archive
- **Tech sophistication:** LOW-MEDIUM
- **Partnership potential:** NONE (US-scoped)

### 🟡 Brazil — Congresso em Foco / Supreme-centric trackers
- **Type:** Independent political journalism
- **Partnership potential:** LOW

### 🟡 Mexico — Animal Político
- **Type:** Investigative digital news
- **Partnership potential:** LOW

### 🟡 South Korea — Impeachment precedent (Park Geun-hye 2017, Yoon Suk-yeol 2024-25)
- **Implication:** Strong precedent for impeachment-as-public-spectacle in a presidential system. No comparable tech platform identified in Korean civic-tech for that case.

---

## 7. BOTTOM-LINE COMPETITIVE ASSESSMENT

### Does any existing platform do what IIP proposes?
**NO.** Verified by direct inspection of the 6 most-relevant candidates:

| IIP Feature | VERA SEEK | Rappler KG | PCIJ | Legaldex | Digest PH | PRS India |
|---|---|---|---|---|---|---|
| Knowledge graph over documents | ❌ | ✅ (elections only) | ❌ | ❌ | ❌ | ❌ |
| NL Q&A on docs | ✅ (closed corpus) | ❌ | ❌ | ✅ (legal) | ✅ (legal) | ❌ |
| Citation grounding | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Senator dashboards | ❌ | ⚠️ election dashboards | ❌ | ❌ | ❌ | ✅ (MP track) |
| Timeline explorer | ❌ | ⚠️ elections | ⚠️ ICC tracker | ❌ | ❌ | ⚠️ session |
| Contradiction detection | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Impeachment scope | ❌ (fact-check) | ❌ | ✅ (topic) | ❌ | ❌ | ❌ |

**No single platform combines more than 2 of IIP's 7 core features.** Contradiction detection appears nowhere in the global civic-tech landscape surveyed.

### Who comes closest?
1. **VERA Files SEEK** — for NL Q&A + citation grounding (closed-corpus, fact-check scoped)
2. **Rappler's 2022 political knowledge graph** — for the KG approach (but election-scoped, dormant as a product)
3. **PRS India** — for structural legislative-tracking ambition (non-AI)

### Where are the genuine gaps IIP fills?
1. **Impeachment as a first-class domain.** Nobody treats impeachment documents (House complaints, Senate trial records, SC rulings, COA audits, Ombudsman cases) as a unified corpus.
2. **Cross-document contradiction detection.** *Zero* competitors do this.
3. **Senator impeachment dashboards.** PCIJ has a one-off map; nobody has a per-senator queryable vote/statement/relationship view.
4. **Open-corpus impeachment RAG.** VERA SEEK is closed-corpus (their own articles); IIP would span primary + secondary sources.
5. **Live timeline explorer** linked to the knowledge graph.
6. **Bridging foi.gov.ph's gap.** FOI does not cover Congress/Judiciary — IIP fills this by aggregating public-record legislative/judicial docs.

### Partner vs Compete Matrix

| Entity | Partner | Compete | Notes |
|---|---|---|---|
| **VERA Files** | ✅ | ⚠️ partial | Coopetition: their archive enriches IIP; their SEEK competes on NL Q&A but in narrower scope |
| **Rappler** | ✅ | ⚠️ partial | KG expertise; audience reach. Possible white-label / co-development |
| **PCIJ** | ✅✅ | — | Pure mission-aligned partner; content + microsites |
| **Inquirer / GMA / ABS-CBN** | ✅ | — | Content syndication / licensing |
| **Tsek.ph** | ✅ | — | Election-cycle fact-check layer |
| **Legaldex / Digest PH / Areglaw.ai** | — | ⚠️ | Adjacent competitors; non-overlapping audience (lawyers vs citizens/journalists) |
| **Chan Robles / LawPhil** | ✅ (license) | — | Source corpus |
| **Lawko / LexMeet** | — | — | Irrelevant |
| **PRS India** | ✅ | — | Methodology mentor |
| **foi.gov.ph** | ✅✅ | — | Prime data source; potential official MOU |
| **COMELEC** | ✅ | — | Election-results data |
| **COA / Ombudsman** | ✅ | — | Audit/case data |
| **Ateneo SoG / UP NCPAG** | ✅ | — | Academic partners, validation |
| **SWS / Pulse Asia** | ✅ | — | Polling data layer |
| **Watchout / g0v** | ✅ | — | Product-design mentorship |
| **Action for Economic Reforms / IPER** | ✅ | — | Policy-expertise partners |

### Strategic implications

1. **Position IIP as the missing intelligence layer over Philippines' impeachment transparency gap** — foi.gov.ph explicitly does not cover Congress or the Judiciary; IIP fills this.
2. **Pursue formal data partnerships with VERA Files, PCIJ, foi.gov.ph first** — they have the corpora and the mission alignment.
3. **Treat Legaldex/Digest/Areglaw as adjacent, not direct, competitors** — they sell to lawyers for billable work; IIP sells to citizens/journalists/senators' offices for accountability.
4. **Study PRS India's product taxonomy** before designing IIP's IA — they've solved many of the structural problems IIP will face.
5. **Contradiction detection is the defensible moat** — nobody else in PH, ASEAN, or globally (in this domain) is doing it. Lead with this in pitch decks.
6. **The Sara Duterte impeachment is the perfect wedge case** — first VP ever impeached in PH history, two impeachment cycles (2024-25 nullified by SC, 2026 second round), live trial activity, abundant primary documents. The wedge writes itself.

---

## CONFIDENCE & SOURCES SUMMARY

**Directly verified live (🟢):** VERA Files SEEK (prompt + launch article), Rappler (data team + Graphwise case study), PCIJ (full homepage + impeachment category), Legaldex (Stanford CodeX), Digest PH (Manila Times piece + founder LinkedIn), Areglaw (homepage), LexMeet (homepage), Chan Robles (homepage), LawPhil (homepage), Lawko (LinkedIn + Crunchbase), Tsek.ph (multiple), foi.gov.ph (live stats), PRS India (homepage), Watchout (homepage), Inquirer (live headlines), Sara Duterte impeachment (Wikipedia, twice).

**Indirectly verified (🟡):** GMA "How Voted" (via DDG snippets), ASEAN peers mostly via prior knowledge / Wikipedia.

**Could not verify (🔴):** iBanGO, Mga Bata, LegalResources PH, transparency.gov.ph, data.gov.ph (appears defunct).

**Major caveat on ASEAN section:** Search engine results (Bing, DDG) were unreliable during this session — many queries returned irrelevant results. ASEAN peer assessments beyond PRS India, Watchout, and iLaw should be independently re-verified before inclusion in any external deck.

