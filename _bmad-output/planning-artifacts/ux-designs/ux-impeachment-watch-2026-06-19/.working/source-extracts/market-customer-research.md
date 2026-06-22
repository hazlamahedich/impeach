# Source Extract — Market & Customer Research

> Source: 3 market research docs + industry research
> Extracted: 2026-06-19 by subagent

## Customer Segments

### Tier 1 — Build For First (Year 1)

**1. International Political-Risk Consultancies & Diplomatic/IFI Missions**
- **Role:** Analysts, country managers, political-economic officers (Bower Group Asia, Eurasia Group, Verisk Maplecroft, Control Risks; embassies US/EU/UK/Japan/Australia/Canada; USAID, UNDP, World Bank PH, ADB governance units, UN OHCHR, IFEX).
- **Motivation:** Country/political-risk briefings — impeachment trajectories, senator-voting-pattern forecasts, conflict-of-interest mapping for client due diligence.
- **Frequency:** Recurring/continuous — monthly briefings, ongoing monitoring.
- **Expertise:** High (domain experts; expect polished, English-only UI).
- **TAM:** ~50–100 seats.

**2. Big Philippine Law Firms**
- **Role:** Constitutional litigation lawyers, knowledge-management partners, firm librarians (SyCip, ACCRA, Romulo Mabanta, Villaraza Angangco/CVP, Puno & Puno, PECruz, Gorriceta, Angara Abello; constitutional-law boutiques).
- **Motivation:** Constitutional litigation prep + impeachment jurisprudence research.
- **Frequency:** Episodic but deep — driven by active cases and CLE.
- **Expertise:** Very high (legal specialists; "managing partners decide, not associates").
- **TAM:** ~300–600 seats.

**3. International Correspondents & Wire Services (Manila Bureaus)**
- **Role:** Foreign correspondents, fact-checkers (Reuters Manila, AFP Manila, AP, BBC, NHK, Bloomberg, FT, NYT stringers, dpa, Kyodo, Xinhua; AFP Fact Check PH, dpa fact-check).
- **Motivation:** Fact-checking claims + source verification + building timeline graphics for international audiences.
- **Frequency:** High during political events.
- **Expertise:** Medium-high (journalism, not technical).
- **TAM:** ~60–100 seats.

### Tier 2 — Expand Into (Years 2–3)

**4. Government (the paradoxical buyer)**
- **Role:** Researchers, lawyers, librarians (Senate PIO, House Committee on Justice, Ombudsman, COA Legal, COMELEC Law Dept, Supreme Court Library, OSG, DOJ).
- **Motivation:** Cross-agency reference + public-information service.
- **Frequency:** Daily/recurring institutional use.
- **Expertise:** Mixed.
- **TAM:** ~300–500 seats.

**5. Academia / Research / Think Tanks**
- **Role:** Faculty, PhD researchers, graduate/law students (UP NCPAG, Ateneo School of Government, DLSU Jesse Robredo School, UST Law, Arellano Law, Lyceum, San Beda; Makati Business Club, AER, IBON, Stratbase ADRi, Pulse Asia, SWS).
- **Motivation:** Peer-reviewed research + dissertation support + comparative-politics scholarship.
- **Frequency:** Episodic/semester-driven.
- **Expertise:** High (faculty); lower (students).
- **TAM:** ~300–500 paying faculty seats + 5,000–8,000 student occasional users.

**6. Philippine Major Newsrooms & Investigative Outlets** *(mission-critical, not revenue-critical)*
- **Role:** Investigative journalists, fact-checkers (Rappler, PCIJ, VERA Files, Inquirer.net, PhilStar, GMA News Online, ABS-CBN News, Manila Bulletin, SunStar network, PPI community papers ~60, CMFR, Bulatlat, Kodao, Pinoy Weekly).
- **Motivation:** Lead-finding, contradiction detection, fact-checking claims.
- **Frequency:** Daily/weekly editorial use.
- **Expertise:** Medium-high.
- **TAM:** ~300–400 journalism seats.

**7. Freelance / Newsletter / Podcast Journalists**
- **Role:** Solo producers (PumaPodcast, "Stand in the Truth," Pinas Forward, Substack writers, freelance investigators, independent fact-checkers).
- **Motivation:** Research/lead-finding for solo producers.
- **Frequency:** Episodic/production-driven.
- **Expertise:** Variable.
- **TAM:** ~200–500 seats (virtually all $0 payers).

**8. NGOs / Civil Society / Advocacy**
- **Role:** NGO researchers, legal staff (Transparency International PH, AER, Code4PH, NAMFREL, LENTE, PPCRV, Amnesty PH, HRW PH desk, Karapatan, FLAG, IBP human-rights committee, Alternative Law Groups network).
- **Motivation:** Advocacy materials + policy briefs + legal-action support.
- **Frequency:** Project/grant-driven.
- **Expertise:** Medium-high.
- **TAM:** ~250–500 seats (mostly donor-sponsored).

### Tier 3 — Nice To Have / Mission (Ongoing)

**9. Educated Citizens / Students / Diaspora**
- **Role:** Law students, pol-sci/public-admin students, engaged citizens, Fil-Am/Fil-Oz/Fil-Can diaspora.
- **Motivation:** Personal research, civic engagement, vote decisions.
- **Frequency:** Occasional/episodic.
- **Expertise:** Low-medium.
- **TAM:** Theoretically millions; realistically paying <1%.

## Primary Use Cases

Ranked by revenue-bearing priority:

1. **Country/political-risk briefings** (political-risk consultancies + IFIs)
2. **Constitutional litigation prep + impeachment jurisprudence research** (big law firms)
3. **Fact-checking claims + source verification + timeline graphics for international audiences** (international correspondents)
4. **Cross-agency reference + public-information service** (government)
5. **Peer-reviewed research + dissertation support** (academia)
6. **Lead-finding, contradiction detection, fact-checking** (PH newsrooms)
7. **Research/lead-finding for solo producers** (freelance journalists)
8. **Advocacy materials + policy briefs + legal-action support** (NGOs)
9. **Personal research, civic engagement, vote decisions** (citizens/students)

## Competitive Landscape

### Direct / Closest Competitors

**VERA Files SEEK** — *Primary direct NL-Q&A competitor*
- Strengths: LangChain/LangSmith RAG stack with citation grounding; mission framing.
- Weaknesses: Closed-corpus (only VERA's own articles); fact-check/misinformation-scoped; no KG, no senator dashboards, no contradiction detection, no timeline explorer.
- Borrow: RAG-with-citation-grounding UX; mission-led product naming/framing.
- Avoid: Closed-corpus limitation; single-publisher scope.

**Rappler** — *Knowledge-graph pioneer + scale competitor*
- Strengths: Built "the Philippines' first political knowledge graph" for election coverage; data dashboards; Rappler Communities app; ~3.5M users.
- Weaknesses: No NL Q&A on docs; no impeachment specialization; KG is election-scoped and dormant.
- Borrow: Political knowledge graph approach; data dashboards; citizen-reporting loops; app distribution.
- Avoid: Election-only scoping; letting KG features go dormant.

**PCIJ** — *Thematic competitor*
- Strengths: Interactive maps ("Who voted to impeach VP Sara Duterte"); microsites (Elections, Supreme Court); `/impeachment/` category; Duterte ICC Tracker; Political Dynasties DB.
- Weaknesses: WordPress/Newspack, no AI, no structured DB exposed, no NL Q&A, no KG, no contradiction detection.
- Borrow: Topic microsites; interactive vote maps; ICC-tracker-style timelines.
- Avoid: Static CMS-only approach; no exposed structured queries.

### PH Legal-Tech Startups (adjacent)

**Legaldex AI**, **Digest PH**, **Areglaw.ai** — AI legal research, case digests. Not impeachment-scoped, no KG. Borrow: AI Q&A on legal docs; case-digest UX.

**Chan Robles Virtual Law Library / CRALAW** — Incumbent, legacy. Decades-long incumbent; widely linked. Weaknesses: VERY LOW tech sophistication — legacy PHP/HTML, Google Custom Search, no AI. Borrow: Long-tail SEO authority; corpus breadth. Avoid: Static-page-by-year organization.

**LawPhil Project** — Nonprofit, legacy. Free corpus of laws + SC decisions. Weaknesses: VERY LOW — plain HTML, 1990s-era site. Borrow: Free-access ethos. Avoid: 1990s-era HTML UX.

### PH Government Transparency Platforms

**foi.gov.ph (eFOI)** — Raw data source / partner, not competitor. Functional request portal; 264,019 requests, 737 agencies. Outputs are PDFs, not structured data; does NOT cover Congress or Judiciary.

**data.gov.ph** — APPEARS DORMANT / PLACEHOLDER.

**transparency.gov.ph** — DOES NOT APPEAR TO EXIST.

**Senate/House portals** — Raw source documents for IIP, not competitors. Senate returns 403 (anti-bot). House publishes roll-call votes and journals as PDFs.

### ASEAN Regional Peers (inspiration)

**PRS Legislative Research (India, prsindia.org)** — *Gold-standard inspiration*
- Strengths: Comprehensive structured tracking — MPs/MLAs, Session Track, Parliament Diary, Committees, Bills, Acts, Budgets, Monthly/Annual Policy Reviews, Vital Stats. Creative Commons licensed. Industry-standard reference for Indian legislative tracking.
- Weaknesses: No AI, no NL Q&A, no KG.
- Borrow: **"Study PRS India's product taxonomy before designing IIP's IA — they've solved many of the structural problems IIP will face."** Structured MP/representative tracking; session diaries; committee tracking; Vital Stats; Creative Commons licensing.
- Avoid: None specifically; but absence of AI is a gap to fill.

**Watchout (Taiwan)** — Civic media reference. Member-funded via monthly subscriptions; 80k+ monthly users, 1M+ social reach; original reporting, FIMI defense projects. Borrow: Membership/subscription funding model; g0v ecosystem civic-tech product design.

**g0v (Taiwan)** — Decentralized civic-tech community. Produces budget visualizers, parliament trackers. Partnership potential for design mentorship.

### Global Impeachment / Accountability Trackers

**Just Security (US), Lawfare (US), C-SPAN impeachment archives, Congresso em Foco (Brazil), Animal Político (Mexico), South Korea impeachment precedent** — all "Conceptual inspiration only" / "not a sustained structured DB" / "Archival, not intelligence." No structured tracker competitors identified.

## Civic-Tech UX Conventions

Patterns common across civic-tech / legal-political platforms that users expect:

- **Track + alert + cross-reference** UX pattern (from GovTrack/PRS India lineage)
- **Representative/legislator profile pages** (PRS India MP Track; GovTrack legislator pages; TheyWorkForYou) — per-senator queryable vote/statement/relationship view
- **Structured legislative tracking taxonomy** — MPs/MLAs, Session Track, Parliament Diary, Committees, Bills, Acts, Budgets, Monthly/Annual Policy Reviews, Vital Stats (PRS India's full taxonomy is the template)
- **Citation grounding / source-provenance display** — non-negotiable for legal/political use; RAG-with-citations is now the standard
- **Interactive vote maps and timelines** (PCIJ's "Who voted to impeach VP Sara Duterte"; ICC Tracker)
- **Topic microsites** (PCIJ Elections/Supreme Court microsites)
- **Creative Commons / open licensing** of structured data (PRS India)
- **Fact-check coalition / partnership branding** (#FactsFirstPH, Tsek.ph) — users expect coalition-backed credibility signals
- **Document-request portal UX** (foi.gov.ph)
- **Membership/subscription funding UX** (Watchout 定期定額; Rappler Communities app subscription)

## Trust Signals

**Trust builders:**
- Non-partisan advisory board (CMFR, NCPAG, IBP)
- Published methodology and data sources
- Citation grounding on every AI output
- Referenceable byline citations (A Rappler/PCIJ byline citing IIP is worth more than ₱50K/yr in subscriptions)
- Peer-reviewed academic citations
- IFCN accreditation alignment
- Coalition endorsement (NUJP/CMFR/PPI)
- Source-grounded architecture (anti-hallucination)
- Protect the brand at all costs — "One partisan scandal kills the whole thing."

**Trust destroyers:**
- Being seen as partisan
- Being seen as a surveillance tool (NGOs fear red-tagging)
- Hallucinated citations
- Abuse of free journalism tier by state-aligned influencers
- State-aligned disinformation attacks
- Ownership concentration / political sensitivity

## Accessibility / Audience Considerations

- **Bilingual / multilingual requirement** — English + Filipino + regional languages; Filipino/English code-switching is a real NLP challenge.
- **Near-zero user tolerance for error** — legal/political users punish hallucination severely.
- **Mixed expertise levels** — Tier 1 users (lawyers, analysts) are domain experts expecting polished UIs; Tier 3 citizens/students need simpler flows.
- **Slow institutional adoption culture** — "library culture is slow to adopt"; "managing partners decide, not associates"; academia "resists paid tools"; government has 6–18 month procurement cycles.
- **Anti-bot / defensive infrastructure** — many sources paywalled (403/404) — affects data ingestion reliability.
- **Credential verification for free tiers** — "NUJP/IFCN credential verification; rate limits; abuse-report system" needed.

## Geographic / Cultural Context (Philippines-Specific)

- **English-language content advantage** — underserved by global legal-AI players; high political event density; vibrant fact-check ecosystem.
- **Filipino/Tagalog and regional languages still required** — for citizen/diaspora reach; code-switching common.
- **Mobile-first audience** — Rappler Communities app, GMA Eleksyon mobile app; mobile apps are the dominant PH distribution channel for civic content. (Implied: any public-facing tier must be mobile-first.)
- **Facebook/TikTok as primary distribution** — TikTok/Facebook organic distribution is the GTM channel for citizens/students; PCIJ attack was via fake FB pages. Facebook is the de-facto public square.
- **Political-event-driven demand** — Impeachments, elections, and Supreme Court confirmations create episodic demand surges.
- **Election cycles** — presidential every 6 years, midterm every 3.
- **Procurement via PhilGEPS / GAA** — government buys via PPMP/GAA, multi-year contracts.
- **Data Privacy Act (RA 10173)** — regulatory uncertainty for named-entity data on politicians.
- **Newsroom economic fragility** — RSF 2026: PH rank 114/180; economic indicator rank 131/180; regional newspapers struggling.
- **Red-tagging risk** — political/security threat to staff and NGO partners.
- **Sovereign AI narrative** — Several governments pushing domestic AI stacks; PH's DICT has signalled similar ambitions.

## Pricing / Access Model

**Cross-subsidy model is mandatory** — premium B2B seats (law firms + political risk + IFIs) fund free/subsidized access for journalists, NGOs, and the public.

**The three decisions that matter (verbatim):**
1. "Price for the top, give to the bottom. Premium B2B (law firms, political-risk, IFIs, government) funds free access for journalism, NGOs, and the public. There is no other sustainable model for a transparency product in the Philippines."
2. "The legal-vertical and political-risk-vertical modules are the real product. NL Q&A over PDFs is a feature, not a business."
3. "Mission is the moat, not the model. The single largest long-term asset IIP can build is reputation."

**Pricing bands by segment (USD; FX $1 ≈ ₱56–58):**

| Segment | Pricing band |
|---|---|
| Political-risk consultancies | $2,000–$8,000/seat/yr |
| IFIs / diplomatic missions | $1,000–$3,000/seat/yr |
| Big PH law firms | $1,000–$5,000/seat/yr |
| Constitutional-law boutiques | $300–$1,000/seat/yr |
| Intl correspondent bureaus | $500–$2,000/seat/yr |
| PH major newsrooms | ₱0 (free) to ~₱500–₱2,000/seat/mo |
| Community/regional papers | $0 |
| Freelance journalists | ₱99–₱299/mo at best; mostly $0; verified-credential free tier |
| Fact-checkers | $0–$300 (grant-funded) |
| Government agencies | ₱3M–₱15M/yr per agency, multi-year GAA contracts |
| Academic faculty (individual) | $50–$300/seat/yr |
| Academic consortia | $5K–$25K/yr per consortium |
| Law/pol-sci students | $0–$30 (free via .edu.ph auth; cap queries) |
| NGOs | ₱0 (free) to ₱2K–₱10K/yr; donor-sponsored bundles |
| Engaged citizens | Freemium; ₱0–₱499/mo; ~1–2% conversion |
| Diaspora | Freemium; ₱299–₱499/mo; $40–$100/yr |

**Model type:** Freemium + cross-subsidy. Premium B2B paid; journalism/NGO/citizen tiers free or grant-subsidized.

## Gaps the Product Fills

1. **No existing platform does what IIP proposes** — the specific combination of KG + impeachment-specific primary documents + NL Q&A with citations + senator dashboards + contradiction detection is unoccupied. "No single platform combines more than 2 of IIP's 7 core features."
2. **Impeachment as a first-class domain** — nobody treats impeachment documents as a unified corpus.
3. **Cross-document contradiction detection** — "Zero competitors do this." Identified as "the defensible moat — nobody else in PH, ASEAN, or globally (in this domain) is doing it."
4. **Senator impeachment dashboards** — "PCIJ has a one-off map; nobody has a per-senator queryable vote/statement/relationship view."
5. **Open-corpus impeachment RAG** — VERA SEEK is closed-corpus; IIP would span primary + secondary sources.
6. **Live timeline explorer linked to the knowledge graph** — nobody currently offers this.
7. **Bridging foi.gov.ph's coverage gap** — IIP fills a transparency gap foi.gov.ph cannot (Senate, House, SC not under eFOI coverage).
8. **Filipino/PH-law localization** — global legal-AI vendors have not localized for Philippines.
9. **No incumbent PH-specific political/legal intelligence platform** — "genuine whitespace."
10. **The Sara Duterte impeachment wedge** — "the perfect wedge case — first VP ever impeached in PH history."
11. **Multilingual legal-AI white space** — "Most legal-AI R&D remains English-first."
12. **Technical layer under existing coalitions** — "#FactsFirstPH coalition... no shared technical platform."

**Strategic build order:** "Contradiction Detection + Evidence Mapping + Senator Dashboards + API should be the v1.5 features — these are the revenue-bearing wedges that distinguish IIP from 'yet another search box over PDFs.'"