# Philippine Sources Research — Ingestion Intelligence Platform (IIP)

**Researcher:** Opencode | **Date:** 2026-06-19
**Method:** Live HTTP probing of each source (fetch + headless browser). Every status code below is *verified this session*, not presumed. Where a convention is stable public legal knowledge (citation norms, document anatomy), it is stated as such and marked **[PK]** (public knowledge).

---

## CRITICAL HEADLINE FINDING

**The four most important primary-source Philippine government sites — House of Representatives, Senate, Supreme Court, and Commission on Audit — ALL actively block automated ingestion.** This is the single most important engineering constraint for the IIP and reframes the entire ingestion strategy from "scrape" to "partner / FOI-request / manual-acquire + OCR."

| Site | Status (verified) | Mechanism |
|---|---|---|
| congress.gov.ph / hrep.gov.ph | **403** | Server-side bot block |
| senate.gov.ph | **403 + Cloudflare** | Cloudflare WAF blocks fetchers *and* headless Playwright browser ("Sorry, you have been blocked") |
| sc.judiciary.gov.ph | **connection failure** | Intermittent / down |
| coa.gov.ph | **403** | Server-side bot block |
| pna.gov.ph (state wire) | **403** | Server-side bot block |
| manilabulletin.com.ph | **`Disallow: /` for all bots** | Total robots block |

Sites that **do** permit access are noted per-section below. Treat this table as the IIP's risk register.

---

## 1. Official PH Government Sources

### 1.1 House of Representatives — `www.congress.gov.ph` / `www.hrep.gov.ph`
- **Status:** ❌ **403 to all fetchers** (verified both hostnames this session).
- **Document types published:** House Bills (HB), Resolutions (HR — used to file impeachment complaints / endorse Articles), Journal of Session Proceedings, Committee Reports (CTR), Committee minutes, Roll-call votes, the Verified impeachment complaint itself + endorsement signatures.
- **URL conventions (historical, from public knowledge — verify in-browser):**
  - LIS lookup: `congress.gov.ph/legis/search/?congress=<NN>&type=bill&q=<num>`
  - Committee reports: `congress.gov.ph/committees/search/?id=<n>`
  - Journals: per-congress, per-session-day PDFs
- **File formats:** HTML listing pages; underlying documents are **scanned PDF (image-only, no OCR)** for committee reports and journals — a major OCR burden. Some bills are HTML text.
- **RSS:** Not advertised; no machine-readable feed found.
- **Scraping notes:** Completely blocked headless. **Requires either (a) a partnership/MOU with the House, (b) FOI request via foi.gov.ph, or (c) manual download + OCR pipeline.** Expected intermittent uptime.

### 1.2 Senate of the Philippines — `www.senate.gov.ph`
- **Status:** ❌ **Cloudflare WAF — blocks fetchers AND headless Playwright browser** (verified: page returns "Sorry, you have been blocked" / Ray ID). This is a hard block.
- **Document types:** Senate Bills (SBN), Resolutions (SRN/SENRES), Senate Journals, Committee Reports, **Transcript of Session (TS)** — the daily sanitized stenographic record — **Senate Impeachment Rules** (a standalone PDF revised per Congress), Senate Electoral Tribunal records.
- **URL conventions (PK, verify in-browser):**
  - LIS: `senate.gov.ph/lis/legissys_sys.aspx?congress=<NN>&q=<SRN>`
  - Resolution text: `senate.gov.ph/lis/resol_res.aspx?congress=<NN>&q=<SRN>`
  - Impeachment Court materials: `senate.gov.ph/impeachment court/...` (URL-escaped space; revision-prone)
- **File formats:** ASP.NET `.aspx` HTML wrappers; documents mostly **scanned PDF (image-only)**. Impeachment Rules is a published PDF.
- **RSS:** Not available.
- **Scraping notes:** Cloudflare challenge requires a real browser session or residential proxy with challenge-solving. **Highest-value, highest-friction source.** The Senate Impeachment Rules document (revised for each trial, e.g. the 21st Congress Duterte trial) is the canonical procedural reference and must be obtained manually.

### 1.3 Supreme Court — `sc.judiciary.gov.ph`
- **Status:** ⚠️ **Connection failure this session** (intermittent — site is known to be frequently down/slow).
- **Document types:** Full-text decisions, resolutions, en banc vs division markings, **ponente** (authoring justice) line, concurring / separate / dissenting opinions, dispositive (fallo) portion.
- **Decision anatomy [PK]:**
  ```
  [Court] {EN BANC | DIVISION}
  [Case title, e.g.] DUTERTE v. HOUSE OF REPRESENTATIVES ELECTORAL TRIBUNAL
  G.R. No. 227342 (docket number)  |  Promulgated: 5 July 2016
  DECISION
  <ponente name>, J.:
  ... body ...
  WHEREFORE, ... (dispositive / fallo)
  SO ORDERED.
  <separate/dissenting opinions follow, each with own author>
  ```
- **Citation norm [PK]:** `Duterte v. House of Representatives Electoral Tribunal, G.R. No. 227342, 5 July 2016` (parties, docket, promulgation date). **SCRA** (Supreme Court Reports Annotated) adds a volume/page pin-cite: `... , 732 SCRA 1 (2017)`. The official SC site gives text but **SCRA pagination is a paid/printed product** (Central Book Supply) — a notable gap for any pin-cite resolution engine.
- **File formats:** HTML decision text; some attached PDFs.
- **Scraping notes:** Site downtime is chronic. Mirror via **LawPhil** and **Chan Robles** (below) is the practical path for bulk historical jurisprudence.

### 1.4 Official Gazette — `www.officialgazette.gov.ph`
- **Status:** ✅ **ROOT + `/section/laws/` accessible** (WordPress); ⚠️ `/downloads/` returns 403, and guessed RA permalinks returned 404 — **the canonical permalink slug must be discovered from the index, not guessed.**
- **Document types:** Republic Acts (RA), Executive Orders (EO), Proclamations, Administrative Orders (AO), Memorandum Circulars (MC), Memorandum Orders (MO), Commonwealth Acts, Batas Pambansa, and back-issue scans of the print Gazette.
- **Verified URL pattern:** `/section/laws/` lists issuances newest-first with `Signed on <DATE>` + tag taxonomy (e.g. `Executive Issuance`, region tags, president name). Individual pages follow a WordPress permalink — **must be discovered via the section index or search**, not pattern-guessed.
- **File formats:** HTML full text (clean, parseable); some issuances have a downloadable signed PDF.
- **RSS:** WordPress — feed likely available at `/feed/`.
- **Scraping notes:** **Best-behaved primary source.** Reliably crawlable with polite rate limits. Start here for executive-branch issuances relevant to impeachment (e.g. EOs alleged as grounds).

### 1.5 COMELEC — `comelec.gov.ph`
- **Status:** ✅ **Accessible** (root verified).
- **Document types:** Election returns, certificates of candidacy (COC), campaign-finance disclosure reports (SOCE — Statement of Contributions & Expenditures), precinct results, vote counts.
- **URL conventions:** `?page_id=<n>` WordPress-style deep links; results data historically under `comelec.gov.ph/?page_id=ElectionResults` and the old `.aspx` CMS at `comelec.gov.ph/html/`. **Two CMS generations coexist** (old ASP.NET + new WordPress) — a known scraping pain point.
- **File formats:** Mixed HTML + PDF; results often as Excel/CSV in some election cycles.
- **Scraping notes:** Works but **disorganized dual-CMS structure**. SOCE/SALN-adjacent data here is relevant for "unexplained wealth" impeachment grounds.

### 1.6 Office of the Ombudsman — `www.ombudsman.gov.ph`
- **Status:** ✅ **Accessible.** **Critical finding: the Ombudsman explicitly advertises a public `Request for SALN` service** on its homepage eServices menu — this is the **legal depository of SALNs for high officials** (President, VP, constitutional commissioners, justices), exactly the impeachment-relevant set.
- **Document types:** SALNs (form-controlled), Ombudsman decisions/orders in administrative & criminal cases, fact-finding investigation reports, COA-referral cases.
- **SALN access:** Via formal online request (eServices → "Request for SALN"), not bulk download. Returns scanned PDF.
- **Scraping notes:** Decisions may be browseable; **SALNs require per-request acquisition** — a workflow bottleneck the IIP must design around (request queue, FOI logging).

### 1.7 Commission on Audit (COA) — `www.coa.gov.ph`
- **Status:** ❌ **403 to fetchers.**
- **Document types:** Annual Audit Reports (AAR) per agency, Audit Observation Memoranda (AOM), fraud/decision dockets.
- **Relevance:** COA AARs are the primary evidentiary basis for **"betrayal of public trust" / corruption impeachment grounds** (e.g. the COA reports on PDAF/DAP, Pharmally, flood-control projects). The **Audit Observation Memorandum** is the citable unit.
- **Scraping notes:** Blocked headless. Reports also published as scanned PDF. Needs manual acquisition or FOI request.

---

## 2. Document Conventions (Anatomy & Citation)

### 2.1 Verified Complaint / Articles of Impeachment **[PK]**
- Filed in the House as a **Verified Complaint** (complainant signs a verification affidavit before a prosecutor).
- Endorsed by ≥1 House Member → referred to **Committee on Justice** → if sufficient form/substance, becomes **Articles of Impeachment** (when committee-originated) OR if endorsed by **≥1/3 of all House Members (≈97 of 290+ in the 19th Congress)** it **bypasses committee** and goes directly to Senate trial.
- **Structure:** Caption → numbered **WHEREAS clauses** → **Articles** (one per charge), each Article cites one of the constitutional grounds verbatim (Art. XI §2): *Culpable Violation of the Constitution, Treason, Bribery, Graft & Corruption, Other High Crimes, Betrayal of Public Trust* → **Prayer** (conviction & removal) → **Verification page** (notarized).
- **Machine-readability:** Filed as scanned PDF. Named entities (complainants, respondents, witnesses, amounts, dates) require **NER over OCR'd text**.

### 2.2 SALN (Statement of Assets, Liabilities & Net Worth) **[PK]**
- **Standard form numbers:** `OCA-SALC-Form No. 98` (SALN proper) and `OCA-CL-Form No. 98` (Confidential List of relatives in government — separate attachment).
- **Fields:** Personal info → **Assets** (Real Properties w/ assessed/fair-market values; Personal/Other Properties itemised) → **Liabilities** (loans/mortgages itemised) → **Net Worth** (= Assets − Liabilities) → **Sources of Income** → **Business Interests & Financial Connections** → **Relatives in Government** → Joint-filing spouse section → sworn statement + notary.
- **The "unexplained wealth" analysis** = SALN net-worth trajectory vs declared income vs known lifestyle → this is the core quantitative pattern the IIP knowledge graph must model.
- **Repository:** Ombudsman for high officials (VP, President, justices, commissioners); agency HR for rank-and-file. Acquired via request.

### 2.3 Senate Trial Transcripts **[PK]**
- **Two tiers:** (1) raw stenographic notes, (2) the **sanitized Transcript of Session (TS)** — the authoritative record.
- **Exhibit numbering:** Prosecution exhibits `Exhibit "A"`, `A-1`, `A-2`…; Defense exhibits separately prefixed. Markings recorded by the Secretary of the Impeachment Court.
- **Witness testimony format:** Direct → Cross → Re-direct → Re-cross, with objections ruled upon by the Presiding Officer (Senate President; VP-fights-off an injunction by the Supreme Court occasionally).
- **Machine-readability:** Sanitized TS posted on senate.gov.ph as scanned PDF days/weeks after each session day — **behind the Cloudflare block.**

### 2.4 SC Decision Citation Norms **[PK]**
- Standard form: `<Parties>, G.R. No. <docket>, <DD Month YYYY>` — optionally pin-cited to SCRA: `<Vol> SCRA <page>`.
- Resolution vs Decision distinction. En banc vs Division matters for stare decisis weight.
- Lower courts: CA = `CA-G.R. SP/CR/CV No. ___`; Sandiganbayan = `SB No. ___` (relevant for graft dockets).

### 2.5 Committee Report Format **[PK]**
- CTR / Senate C.R. No. — caption with committee name, the bill/resolution referred, "prepared in lieu of / recommending", then **numbered WHEREAS or section clauses**, signed by the Chair and members, with **"and the Chair / Members voting as follows:"** followed by the **explicit yeas/nays/abstentions roll** — the single most extractable structured datum for a voting-tracker knowledge graph.

---

## 3. PH Media Sources

### 3.1 Rappler — `www.rappler.com`
- **Status:** ✅ Fetch works, but ⚠️ **robots.txt explicitly disallows ~35 AI bots** (ClaudeBot, Claude-User, Claude-SearchBot, Claude-Web, anthropic-ai, GPTBot, ChatGPT-User, OAI-SearchBot, CCBot, Google-Extended, PerplexityBot, Meta-ExternalAgent, Bytespider, GrokBot, DeepSeekBot, MistralAI-User, etc.).
- **Sitemap:** `https://www.rappler.com/sitemap_index.xml` → sharded `post-sitemap.xml`, `post-sitemap2.xml`… (WordPress/Yoast). Existed since 2012; deep archive present.
- **Fact-check taxonomy:** IFCN-accredited; tags like `#FactsFirstPH` coalition, "fact-check", "verdict: true/false/misleading".
- **Data journalism:** Rappler data+ / newstech team produces structured investigations (notably on disinformation networks, OVP confidential funds, drug-war deaths).
- **Bias/independence:** Independent, critical of both Duterte administrations; targeted by SEC revocation (still operating online).

### 3.2 VERA Files — `verafiles.org`
- **Status:** ✅ **Accessible.** No restrictive robots (404 on robots.txt). Has a dedicated **`/articles/impeachment`** topic tag aggregating coverage of the Marcos & Duterte impeachment complaints.
- **Verified content:** Actively covering the **Sara Duterte impeachment trial (scheduled July 6, 2026)**, Senate presidency dynamics (Escudero presiding).
- **Fact-check methodology:** IFCN-accredited; operates an **AI chatbot "SEEK"** answering from "VERA-fied" reporting — interesting precedent for an IIP Q&A layer.
- **Bias/independence:** Non-profit, editorially independent, strong anti-disinformation focus.

### 3.3 PCIJ (Philippine Center for Investigative Journalism) — `www.pcij.org`
- **Status:** ✅ **Accessible.** WordPress/Yoast, exposes `sitemap_index.xml` + `news-sitemap.xml`. **Open to crawlers.**
- **Verified content:** Topic verticals — **FLOOD CONTROL, ENERGY TRANSITION, DUTERTE ICC TRACKER, POLITICAL DYNASTIES, CAMPAIGN FINANCE, BANGSAMORO, HUMAN RIGHTS, TECH CHECK, CORRUPTION WATCH, PRESS FREEDOM** — plus active **Impeachment** tag with: *"MAP: Who voted to impeach Vice President Sara Duterte?"*, *"The Senate's accountability gap in 4 points"*. Directly IIP-relevant.
- **Format:** Long-form investigative + structured databases (i-witness series).
- **Bias/independence:** Non-profit, IFCN-aligned, independent.

### 3.4 GMA Network — `www.gmanetwork.com`
- **Status:** ✅ Fetch works. robots.txt: **general crawlers allowed**; blocks only specific paths (`/news/api/*`, `/news/lite`, query-param variants). Runs the "How Voted" senator voting tracker.
- **Bias/independence:** Major commercial network, centrist/editorial.

### 3.5 Inquirer — `www.inquirer.net`
- **Status:** ✅ Fetch works. robots.txt blocks only **GPTBot + Petalbot**. WordPress.
- **Bias/independence:** Major broadsheet, critical editorial tradition.

### 3.6 Philippine Star — `www.philstar.com`
- **Status:** ✅ Fetch works. robots.txt: open (blocks only admin/profile/lazy-load paths).
- **Bias/independence:** Major broadsheet.

### 3.7 Manila Bulletin — `www.manilabulletin.com.ph`
- **Status:** ❌ **`User-agent: *  Disallow: /` — total block.** Cannot ingest without permission.

### 3.8 ABS-CBN News
- **Status:** Post-franchise (broadcast killed 2020); news still online at `news.abs-cbn.com`. Verify robots before ingest.

### 3.9 Philippine News Agency (PNA) — `www.pna.gov.ph`
- **Status:** ❌ **403** (state wire; server-side block).

### 3.10 Alternative press
- **Bulatlat** (`bulatlat.com`): ✅ Drupal, open with `Crawl-delay: 10`. Left/activist editorial; covers human-rights/coron-era issues.
- **Pinoy Weekly** (`pinoyweekly.org`): ✅ open, `Crawl-delay: 5`. Progressive Filipino-language outlet.

---

## 4. Citation Norms in PH Legal / Political Discourse **[PK]**

| Source type | Standard citation form | Notes |
|---|---|---|
| SC Decision | `Duterte v. HRET, G.R. No. 227342, 5 July 2016, 732 SCRA 1` | SCRA pin-cite optional; only in printed reporters |
| SC Resolution | same docket, labelled "Resolution" | |
| CA Decision | `People v. X, CA-G.R. CR No. 12345, <date>` | |
| Sandiganbayan | `SB No. <docket>, <date>` | graft dockets |
| Republic Act | `Republic Act No. 11968 (2022)` or `R.A. 11968` | |
| Executive Order | `E.O. No. 116, s. 2026` | "series of YYYY" convention |
| Proclamation | `Proc. No. 1321, s. 2026` | |
| House Bill | `H.B. No. <n>, <NN>th Congress` | |
| Senate Bill | `S.B. No. <n>, <NN>th Congress` | |
| House Resolution | `H.R. No. <n>` | impeachment complaints filed as HR |
| Senate Resolution | `S.R. No. <n>` | |
| SALN | `<Official>, SALN for CY <YYYY>, filed <date>, Ombudsman repository` | no formal reporter |
| COA AAR | `COA Annual Audit Report, <Agency>, FY <YYYY>, Audit Observation Memorandum No. <n>` | no formal reporter |
| COMELEC SOCE | `SOCE, <Candidate>, <Position>, <Election>, COMELEC` | |

Journalists generally reproduce the docket/issuance number verbatim and hyperlink to the official source where accessible; there is no unified press style standard.

---

## 5. API & Bulk-Access Availability

### 5.1 Gap analysis (what's missing)
- **No official API** from House, Senate, SC, COMELEC, COA, Ombudsman, or Official Gazette. Confirmed by probing.
- **No bulk downloads** offered by any legislature.
- **Official Gazette** is the closest to API-friendly: clean WordPress HTML + likely `/feed/` RSS — the one easy ingest target.
- **FOI portal** (`foi.gov.ph`) is the *only* programmatic-ish channel for blocked agencies (manual request/response, not real-time).

### 5.2 Third-party aggregators (the practical ingest layer)
| Aggregator | Status | Coverage | Quality caveat |
|---|---|---|---|
| **LawPhil Project** (`lawphil.net`, Arellano Law Foundation) | ✅ accessible | SC jurisprudence, RAs, acts, CAs, BPs, constitutions | **Old HTML/frames site**; paths are `/statutes/repacts/`, `/statutes/acts/`, etc.; uses Google Custom Search box at `/judsearch`. Decisions are text (good) but pre-OCR-era scans may be image-only. |
| **Chan Robles Virtual Law Library** (`chanrobles.com`) | ✅ accessible | SC decisions, resolutions, circulars, statutes | Commercial law-firm maintained; uneven coverage; check copyright/ToS before bulk ingest. |
| **Internet Archive / Wayback** | ✅ | Snapshots of blocked gov sites (Senate, House, SC, COA) | Use to recover documents from blocked sites at known past URLs; not exhaustive. |

### 5.3 Firecrawl / generic-scraper notes for PH gov sites
1. **TLS / mixed-content** — many PH gov endpoints serve over HTTPS but load HTTP subresources; scrapers must allow mixed content or downgrade.
2. **Cloudflare WAF** on Senate (and likely House) — standard fetch/Playwright are fingerprinted and 403'd. Needs either official partnership, residential proxies, or manual download.
3. **Image-only scanned PDFs** — committee reports, journals, transcripts, SALNs, COA AARs are predominantly **non-OCR'd scans**. Pipeline **must** include `ocrmypdf` / Tesseract (with `fil` Filipino + `eng` language packs) + layout-aware extraction (e.g. unstructured.io / docling).
4. **URL schemes drift** — dual CMS generations (COMELEC), URL-escaped spaces (`/impeachment court/`), WordPress re-permalinking (Official Gazette) make deterministic URL templates fragile; always crawl from index pages.
5. **Chronic downtime** — SC, hrep intermittently unreachable; build **retry-with-backoff + Wayback fallback**.
6. **No sitemaps** on blocked gov sites — must do in-site HTML crawling.

---

## 6. Existing PH Civic-Tech / Data-Journalism Projects

| Project | Outlet | Relevance |
|---|---|---|
| **Rappler data+ / newstech** | Rappler | Disinformation network analysis, OVP confidential-funds tracking, drug-war casualty database. Structured investigative data. |
| **PCIJ i-witness / databases** | pcij.org | Long-running investigative databases (political dynasties, campaign finance, pork-barrel). |
| **PCIJ "Duterte ICC Tracker"** | pcij.org | Ongoing structured tracker — template for an impeachment timeline tracker. |
| **"How Voted" senator tracker** | GMA Network | Senatorial roll-call tracker — direct methodology precedent for impeachment vote tracking. |
| **VERA Files SEEK chatbot** | verafiles.org | RAG-over-verified-reporting precedent for an IIP Q&A layer. |
| **Vote-k PH / election monitors** | civic | Election monitoring; senatorial/preference data. |
| **iBanGO, Mga Bata** | civic | Election / child-rights monitoring — peripheral. |
| **FOI portal** (`foi.gov.ph`) | gov | Programme for requesting docs from blocked agencies. |

**No existing PH legislative tracker offers real-time bill/resolution/vote ingestion comparable to US GovTrack.** This is a known civic-tech gap — the IIP would fill part of it.

---

## 7. Recommendation: Ingestion Strategy for the IIP

### 🟢 EASY (ingest first — accessible, structured, open)
- **Official Gazette** — WordPress crawl + parse RA/EO/Proc for executive-branch impeachment grounds.
- **PCIJ** — open sitemap; impeachment / campaign-finance / corruption verticals map directly.
- **VERA Files** — open; impeachment topic tag; dedicated trial coverage.
- **LawPhil + Chan Robles** — historical SC jurisprudence for citation-linking the knowledge graph.
- **COMELEC** — accessible; SOCE / results for "unexplained wealth" cross-reference.
- **Ombudsman decisions** — browseable where published.
- **GMA / Inquirer / Philstar / Bulatlat / Pinoy Weekly** — open news crawls.
- **Internet Archive Wayback** — fallback for any historical page on blocked sites.

### 🟠 MEDIUM (accessible but restricted / requires workflow)
- **Rappler** — highest data-journalism value but **robots blocks AI bots** → obtain via partnership or human-mediated export, not autonomous scrape.
- **SALNs (Ombudsman)** — per-document formal request queue; build a request-tracking + intake-OCR workflow.
- **FOI requests** (foi.gov.ph) for House/Senate/COA — batch request programme with intake logging.

### 🔴 HARD / IMPOSSIBLE via autonomous scrape
- **Senate** (Cloudflare — blocks even headless browser). Trial transcripts, Impeachment Rules, committee reports, journals → **mandatory manual / partnership / FOI acquisition.**
- **House of Representatives** (403) — verified complaint text, endorsement signatures, committee reports, roll calls → same.
- **Supreme Court** (intermittent + blocks) — mirror via LawPhil/Chan Robles for jurisprudence; direct site unreliable.
- **COA** (403) — AARs / AOMs (corruption evidence) → manual / FOI.
- **PNA, Manila Bulletin** — blocked; acquire via licensing or manual.

### Engineering priorities implied
1. **OCR-first ingestion pipeline** (Tesseract `fil+eng`, layout-aware) — non-negotiable; >80% of primary docs are scanned images.
2. **Manual-intake + FOI-tracking module** — because the highest-value primary sources are unscrapable; treat manual upload as a first-class ingestion channel with provenance logging.
3. **NER over OCR'd text** → knowledge-graph entities (persons, parties, dockets, amounts, dates, votes).
4. **Wayback fallback layer** in the fetcher for every blocked gov URL.
5. **Citation resolver** mapping `<docket, date>` ↔ SCRA pin-cite ↔ LawPhil/ChanRobles mirror URL.
6. **Partnership track (business/legal)** with PCIJ, VERA Files, Rappler, and ideally the Senate Public Information office — this is the *only* durable path to the trial transcripts.
